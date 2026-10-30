using MapManager.Api.Dtos;
using MapManager.Api.Mapping;
using MapManager.Api.Models;
using MapManager.Api.Repositories;

namespace MapManager.Api.Services;

/// <summary>Default implementation of <see cref="IMapDataService"/>.</summary>
public sealed class MapDataService : IMapDataService
{
    private readonly IFeatureRepository _repository;
    private readonly TimeProvider _timeProvider;

    public MapDataService(IFeatureRepository repository, TimeProvider timeProvider)
    {
        _repository = repository;
        _timeProvider = timeProvider;
    }

    public async Task<MapDataPageDto?> QueryAsync(MapDataQueryRequest request, CancellationToken cancellationToken)
    {
        var query = MapDataQueryParser.Parse(request, _timeProvider.GetStorageUtcNow());

        if (request.Within is not null)
        {
            var polygon = await _repository.GetByIdAsync(request.Within, FeatureKind.Polygon, cancellationToken);
            if (polygon is null)
            {
                return null;
            }

            query = query with { Within = GeometryMapper.AsPolygon(polygon.Geometry) };
        }

        // One extra item tells whether another page exists, without a separate count.
        var documents = await _repository.QueryAsync(query, request.Limit + 1, cancellationToken);
        var page = documents.Take(request.Limit).ToList();

        var nextCursor = documents.Count > request.Limit
            ? MapDataCursor.Encode(new FeatureCursor(page[^1].CreatedAt, page[^1].Id!))
            : null;

        return new MapDataPageDto(page.Select(FeatureMapper.ToMapItemDto).ToList(), nextCursor);
    }
}
