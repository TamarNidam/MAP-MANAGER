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
    /// Inserts the documents and assigns their ids. A document whose clientId is already stored is not inserted again:
    /// the stored one is returned in its place. The result has one document per input, in input order.
    /// Not atomic on standalone MongoDB: a rejected write triggers a best-effort rollback of this call's own inserts
    /// (never of documents that existed before) that can itself fail, and other failures (such as a lost connection)
    /// are not rolled back.
    /// </summary>
    /// <exception cref="Errors.InvalidGeometryException">MongoDB rejected one of the geometries.</exception>
    /// <exception cref="Errors.ConflictException">A clientId is already used by an item of the other kind.</exception>
    Task<IReadOnlyList<FeatureDocument>> InsertManyAsync(IReadOnlyList<FeatureDocument> documents, CancellationToken cancellationToken);

    /// <summary>Returns up to <paramref name="limit"/> features of one kind, newest first.</summary>
    Task<IReadOnlyList<FeatureDocument>> ListAsync(FeatureKind kind, int limit, CancellationToken cancellationToken);

    /// <summary>Returns up to <paramref name="limit"/> features of any kind that match the query, newest first.</summary>
    /// <exception cref="Errors.InvalidGeometryException">MongoDB rejected the bounding box.</exception>
    Task<IReadOnlyList<FeatureDocument>> QueryAsync(MapDataQuery query, int limit, CancellationToken cancellationToken);

    /// <summary>Returns the feature, or null when no feature of this kind has the id.</summary>
    Task<FeatureDocument?> GetByIdAsync(string id, FeatureKind kind, CancellationToken cancellationToken);

    /// <summary>
    /// Applies the update when the feature is still at <see cref="FeatureUpdate.ExpectedVersion"/>, increments its
    /// version and returns it. Returns null when the feature does not exist.
    /// </summary>
    /// <exception cref="Errors.InvalidGeometryException">MongoDB rejected the new geometry.</exception>
    /// <exception cref="Errors.ConflictException">The feature exists but its version is not the expected one.</exception>
    Task<FeatureDocument?> UpdateAsync(string id, FeatureKind kind, FeatureUpdate update, CancellationToken cancellationToken);

    /// <summary>Deletes the feature. Returns false when it does not exist.</summary>
    Task<bool> DeleteAsync(string id, FeatureKind kind, CancellationToken cancellationToken);

    /// <summary>Returns true when at least one feature (of any kind) belongs to the layer.</summary>
    Task<bool> AnyInLayerAsync(string layerId, CancellationToken cancellationToken);

    /// <summary>Deletes every feature of one kind and returns how many were deleted.</summary>
    Task<long> DeleteAllAsync(FeatureKind kind, CancellationToken cancellationToken);
}
