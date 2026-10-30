using MapManager.Api.Mapping;
using MapManager.Api.Models;
using MapManager.Api.Repositories;
using MongoDB.Driver.GeoJsonObjectModel;

namespace MapManager.Api.Tests.Fakes;

/// <summary>
/// In-memory <see cref="IFeatureRepository"/> for service tests. It follows the same contract as the
/// MongoDB repository: every operation is scoped to one kind, and unknown ids are "not found".
/// </summary>
public sealed class InMemoryFeatureRepository : IFeatureRepository
{
    private readonly Dictionary<string, FeatureDocument> _documents = new();
    private int _nextId = 1;

    /// <summary>Everything currently stored, for assertions.</summary>
    public IReadOnlyCollection<FeatureDocument> All => _documents.Values;

    public Task InsertManyAsync(IReadOnlyList<FeatureDocument> documents, CancellationToken cancellationToken)
    {
        foreach (var document in documents)
        {
            // Same 24-character hex shape as a real ObjectId.
            document.Id = (_nextId++).ToString("x24");
            _documents[document.Id] = document;
        }

        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<FeatureDocument>> ListAsync(FeatureKind kind, int limit, CancellationToken cancellationToken)
    {
        IReadOnlyList<FeatureDocument> result = _documents.Values
            .Where(d => d.Properties.Kind == kind)
            .OrderByDescending(d => d.CreatedAt)
            .ThenByDescending(d => d.Id, StringComparer.Ordinal)
            .Take(limit)
            .ToList();
        return Task.FromResult(result);
    }

    public Task<IReadOnlyList<FeatureDocument>> QueryAsync(MapDataQuery query, int limit, CancellationToken cancellationToken)
    {
        if (query.Bbox is not null)
        {
            throw new NotSupportedException("Bounding boxes need MongoDB's geo engine, so they are covered by the smoke check.");
        }

        IReadOnlyList<FeatureDocument> result = _documents.Values
            .Where(d => Matches(d, query))
            .OrderByDescending(d => d.CreatedAt)
            .ThenByDescending(d => d.Id, StringComparer.Ordinal)
            .Take(limit)
            .ToList();
        return Task.FromResult(result);
    }

    public Task<FeatureDocument?> GetByIdAsync(string id, FeatureKind kind, CancellationToken cancellationToken) =>
        Task.FromResult(Find(id, kind));

    public Task<FeatureDocument?> UpdateAsync(string id, FeatureKind kind, FeatureUpdate update, CancellationToken cancellationToken)
    {
        var document = Find(id, kind);
        if (document is not null)
        {
            document.Geometry = update.Geometry;
            document.Properties.Name = update.Name;
            document.Properties.ObjectType = update.ObjectType;
            document.Properties.LayerId = update.LayerId;
            document.Properties.Color = update.Color;
            document.Properties.Shape = update.Shape;
            document.Properties.RadiusMeters = update.RadiusMeters;
            document.UpdatedAt = update.UpdatedAt;
        }

        return Task.FromResult(document);
    }

    public Task<bool> DeleteAsync(string id, FeatureKind kind, CancellationToken cancellationToken) =>
        Task.FromResult(Find(id, kind) is not null && _documents.Remove(id));

    public Task<bool> AnyInLayerAsync(string layerId, CancellationToken cancellationToken) =>
        Task.FromResult(_documents.Values.Any(d => string.Equals(d.Properties.LayerId, layerId, StringComparison.OrdinalIgnoreCase)));

    public Task<long> DeleteAllAsync(FeatureKind kind, CancellationToken cancellationToken)
    {
        var ids = _documents.Values.Where(d => d.Properties.Kind == kind).Select(d => d.Id!).ToList();
        ids.ForEach(id => _documents.Remove(id));
        return Task.FromResult((long)ids.Count);
    }

    private static bool Matches(FeatureDocument document, MapDataQuery query)
    {
        var properties = document.Properties;
        return (query.Kind is null || properties.Kind == query.Kind)
            && (query.ObjectType is null || properties.ObjectType == query.ObjectType)
            && (query.Creator is null || properties.CreatedBy == query.Creator)
            && (query.CreatedSince is null || document.CreatedAt >= query.CreatedSince)
            && (query.Search is null
                || properties.Name.Contains(query.Search, StringComparison.OrdinalIgnoreCase)
                || properties.CreatedBy.Contains(query.Search, StringComparison.OrdinalIgnoreCase))
            && (query.Within is null || (properties.Kind == FeatureKind.Object && IsInside(document, query.Within)))
            && (query.LayerIds is null || query.LayerIds.Contains(properties.LayerId))
            && (query.After is null || IsSortedAfter(document, query.After));
    }

    private static bool IsSortedAfter(FeatureDocument document, FeatureCursor cursor) =>
        document.CreatedAt < cursor.CreatedAt
        || (document.CreatedAt == cursor.CreatedAt && string.CompareOrdinal(document.Id, cursor.Id) < 0);

    /// <summary>Flat ray casting over the exterior ring. Enough for the small test polygons.</summary>
    private static bool IsInside(FeatureDocument document, GeoJsonPolygon<GeoJson2DGeographicCoordinates> polygon)
    {
        var point = GeometryMapper.ToPosition(document.Geometry);
        var ring = GeometryMapper.ToRings(polygon)[0];
        var inside = false;
        for (int i = 0, j = ring.Length - 1; i < ring.Length; j = i++)
        {
            var crosses = (ring[i][1] > point[1]) != (ring[j][1] > point[1])
                && point[0] < ring[i][0] + ((point[1] - ring[i][1]) / (ring[j][1] - ring[i][1]) * (ring[j][0] - ring[i][0]));
            inside ^= crosses;
        }

        return inside;
    }

    private FeatureDocument? Find(string id, FeatureKind kind) =>
        _documents.TryGetValue(id, out var document) && document.Properties.Kind == kind ? document : null;
}
