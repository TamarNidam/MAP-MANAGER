using MapManager.Api.Models;

namespace MapManager.Api.Repositories;

/// <summary>
/// Data access for the "features" collection. Every operation is scoped to one <see cref="FeatureKind"/>,
/// so an object id can never read, change or delete a polygon and the other way around.
/// An id that is not a valid ObjectId is treated as "not found".
/// </summary>
public interface IFeatureRepository
{
    /// <summary>
    /// Inserts all documents and assigns their ids. Either all documents are stored or none are.
    /// </summary>
    /// <exception cref="Errors.InvalidGeometryException">MongoDB rejected one of the geometries.</exception>
    Task InsertManyAsync(IReadOnlyList<FeatureDocument> documents, CancellationToken cancellationToken);

    /// <summary>Returns up to <paramref name="limit"/> features of one kind, newest first.</summary>
    Task<IReadOnlyList<FeatureDocument>> ListAsync(FeatureKind kind, int limit, CancellationToken cancellationToken);

    /// <summary>Returns the feature, or null when no feature of this kind has the id.</summary>
    Task<FeatureDocument?> GetByIdAsync(string id, FeatureKind kind, CancellationToken cancellationToken);

    /// <summary>Applies the update and returns the updated feature, or null when it does not exist.</summary>
    /// <exception cref="Errors.InvalidGeometryException">MongoDB rejected the new geometry.</exception>
    Task<FeatureDocument?> UpdateAsync(string id, FeatureKind kind, FeatureUpdate update, CancellationToken cancellationToken);

    /// <summary>Deletes the feature. Returns false when it does not exist.</summary>
    Task<bool> DeleteAsync(string id, FeatureKind kind, CancellationToken cancellationToken);

    /// <summary>Returns true when at least one feature (of any kind) belongs to the layer.</summary>
    Task<bool> AnyInLayerAsync(string layerId, CancellationToken cancellationToken);

    /// <summary>Deletes every feature of one kind and returns how many were deleted.</summary>
    Task<long> DeleteAllAsync(FeatureKind kind, CancellationToken cancellationToken);
}
