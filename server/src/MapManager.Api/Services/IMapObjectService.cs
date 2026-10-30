using MapManager.Api.Dtos;

namespace MapManager.Api.Services;

/// <summary>Use cases for objects (markers and symbols such as a Jeep).</summary>
public interface IMapObjectService
{
    /// <summary>Creates all objects in one batch and returns them with their ids, in request order.</summary>
    Task<IReadOnlyList<MapObjectDto>> CreateManyAsync(IReadOnlyList<CreateMapObjectRequest> requests, CancellationToken cancellationToken);

    /// <summary>Returns up to <paramref name="limit"/> objects, newest first.</summary>
    Task<IReadOnlyList<MapObjectDto>> ListAsync(int limit, CancellationToken cancellationToken);

    /// <summary>Returns the object, or null when it does not exist.</summary>
    Task<MapObjectDto?> GetByIdAsync(string id, CancellationToken cancellationToken);

    /// <summary>Replaces the editable fields and returns the updated object, or null when it does not exist.</summary>
    Task<MapObjectDto?> UpdateAsync(string id, UpdateMapObjectRequest request, CancellationToken cancellationToken);

    /// <summary>Deletes the object. Returns false when it does not exist.</summary>
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken);
}
