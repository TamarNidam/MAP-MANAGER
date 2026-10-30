using MapManager.Api.Models;

namespace MapManager.Api.Repositories;

/// <summary>
/// Data access for the "layers" collection. Layer names are compared ignoring case.
/// An id that is not a valid ObjectId is treated as "not found".
/// </summary>
public interface ILayerRepository
{
    /// <summary>Returns every layer: the default layer first, then by name.</summary>
    Task<IReadOnlyList<LayerDocument>> ListAsync(CancellationToken cancellationToken);

    /// <summary>Returns the layer, or null when it does not exist.</summary>
    Task<LayerDocument?> GetByIdAsync(string id, CancellationToken cancellationToken);

    /// <summary>Returns which of the given ids belong to existing layers.</summary>
    Task<IReadOnlySet<string>> FindExistingIdsAsync(IReadOnlyCollection<string> ids, CancellationToken cancellationToken);

    /// <summary>Returns true when a layer other than <paramref name="excludeId"/> already has this name, ignoring case.</summary>
    Task<bool> NameExistsAsync(string name, string? excludeId, CancellationToken cancellationToken);

    /// <summary>Inserts the layer and assigns its id.</summary>
    /// <exception cref="Errors.ConflictException">Another layer has the same name.</exception>
    Task InsertAsync(LayerDocument layer, CancellationToken cancellationToken);

    /// <summary>Applies the update and returns the updated layer, or null when it does not exist.</summary>
    /// <exception cref="Errors.ConflictException">Another layer has the same name.</exception>
    Task<LayerDocument?> UpdateAsync(string id, LayerUpdate update, CancellationToken cancellationToken);

    /// <summary>Deletes the layer. Returns false when it does not exist.</summary>
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken);

    /// <summary>Inserts <paramref name="defaultLayer"/> unless a default layer already exists. Safe to call on every start.</summary>
    Task EnsureDefaultAsync(LayerDocument defaultLayer, CancellationToken cancellationToken);
}
