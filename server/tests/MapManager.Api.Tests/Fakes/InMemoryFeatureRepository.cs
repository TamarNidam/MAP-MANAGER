using MapManager.Api.Models;
using MapManager.Api.Repositories;

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

    private FeatureDocument? Find(string id, FeatureKind kind) =>
        _documents.TryGetValue(id, out var document) && document.Properties.Kind == kind ? document : null;
}
