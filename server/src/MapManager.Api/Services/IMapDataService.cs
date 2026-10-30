using MapManager.Api.Dtos;

namespace MapManager.Api.Services;

/// <summary>Read use case for the map and its table: objects and polygons together.</summary>
public interface IMapDataService
{
    /// <summary>Returns one page of matching features, or null when the "within" polygon does not exist.</summary>
    /// <exception cref="Errors.RequestValidationException">A query parameter is invalid.</exception>
    Task<MapDataPageDto?> QueryAsync(MapDataQueryRequest request, CancellationToken cancellationToken);
}
