using MapManager.Api.Dtos;

namespace MapManager.Api.Services;

/// <summary>Use cases for polygons.</summary>
public interface IPolygonService
{
    /// <summary>Creates all polygons in one batch and returns them with their ids, in request order.</summary>
    Task<IReadOnlyList<PolygonDto>> CreateManyAsync(IReadOnlyList<CreatePolygonRequest> requests, CancellationToken cancellationToken);

    /// <summary>Returns up to <paramref name="limit"/> polygons, newest first.</summary>
    Task<IReadOnlyList<PolygonDto>> ListAsync(int limit, CancellationToken cancellationToken);

    /// <summary>Returns the polygon, or null when it does not exist.</summary>
    Task<PolygonDto?> GetByIdAsync(string id, CancellationToken cancellationToken);

    /// <summary>Replaces the editable fields and returns the updated polygon, or null when it does not exist.</summary>
    Task<PolygonDto?> UpdateAsync(string id, UpdatePolygonRequest request, CancellationToken cancellationToken);

    /// <summary>Deletes the polygon. Returns false when it does not exist.</summary>
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken);

    /// <summary>Deletes every polygon (objects are not touched) and returns how many were deleted.</summary>
    Task<long> DeleteAllAsync(CancellationToken cancellationToken);
}
