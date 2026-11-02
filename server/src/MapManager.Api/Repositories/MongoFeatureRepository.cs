using System.Linq.Expressions;
using MapManager.Api.Errors;
using MapManager.Api.Infrastructure;
using MapManager.Api.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace MapManager.Api.Repositories;

/// <summary>MongoDB implementation of <see cref="IFeatureRepository"/>.</summary>
public sealed class MongoFeatureRepository : IFeatureRepository
{
    /// <summary>MongoDB error code "Can't extract geo keys": the 2dsphere index rejected a geometry.</summary>
    private const int InvalidGeometryErrorCode = 16755;

    /// <summary>MongoDB error code "BadValue": a query geometry could not be used.</summary>
    private const int BadValueErrorCode = 2;

    /// <summary>How often a batch is retried after losing a race on a clientId before giving up.</summary>
    private const int MaxInsertAttempts = 3;

    private static readonly FilterDefinitionBuilder<FeatureDocument> Filter = Builders<FeatureDocument>.Filter;

    private readonly IMongoCollection<FeatureDocument> _features;

    public MongoFeatureRepository(MongoContext context)
    {
        _features = context.Features;
    }

    public async Task<IReadOnlyList<FeatureDocument>> InsertManyAsync(
        IReadOnlyList<FeatureDocument> documents,
        CancellationToken cancellationToken)
    {
        if (documents.Count == 0)
        {
            return documents;
        }

        // Ids are generated here, before the insert, so a failed batch can be rolled back by id.
        // They are always fresh, so a rollback by these ids can never touch a document that existed before.
        foreach (var document in documents)
        {
            document.Id = ObjectId.GenerateNewId().ToString();
        }

        var kind = documents[0].Properties.Kind;
        var existing = new Dictionary<string, FeatureDocument>(StringComparer.Ordinal);
        var inserted = new List<FeatureDocument>();
        var pending = documents.ToList();

        for (var attempt = 1; ; attempt++)
        {
            // Items whose clientId is already stored were saved by an earlier request: return them, do not insert again.
            await LoadExistingAsync(pending, kind, existing, cancellationToken);
            pending = pending.Where(d => d.ClientId is null || !existing.ContainsKey(d.ClientId)).ToList();
            if (pending.Count == 0)
            {
                break;
            }

            try
            {
                await _features.InsertManyAsync(pending, new InsertManyOptions { IsOrdered = true }, cancellationToken);
                break;
            }
            catch (MongoBulkWriteException ex)
            {
                var error = ex.WriteErrors.FirstOrDefault();
                var isClientIdDuplicate = error is not null && IsClientIdDuplicate(error);

                if (isClientIdDuplicate && attempt < MaxInsertAttempts)
                {
                    // Another request stored the same clientId between our lookup and our insert (or the batch repeats
                    // one). An ordered insert stopped at the duplicate, so everything before it was stored by us.
                    // Keep that, look the duplicates up again and insert the rest.
                    inserted.AddRange(pending.Take(error!.Index));
                    pending = pending.Skip(error.Index).ToList();
                    continue;
                }

                // The local MongoDB is a standalone server, so multi-document transactions are not available and this insert is not atomic.
                // This best-effort rollback removes only what this call may have stored (by its freshly generated ids);
                // documents that existed before are never deleted. If the delete also fails, some documents stay stored.
                var ids = inserted.Concat(pending).Select(d => d.Id);
                await _features.DeleteManyAsync(Filter.In(f => f.Id, ids), CancellationToken.None);

                var geometryError = ex.WriteErrors.FirstOrDefault(e => e.Code == InvalidGeometryErrorCode);
                if (geometryError is not null)
                {
                    throw new InvalidGeometryException($"Item {geometryError.Index} has an invalid geometry.", ex);
                }

                if (isClientIdDuplicate)
                {
                    throw new ConflictException("The clientId is already used by a different item.", ex);
                }

                throw;
            }
        }

        return documents
            .Select(d => d.ClientId is not null && existing.TryGetValue(d.ClientId, out var stored) ? stored : d)
            .ToList();
    }

    public async Task<IReadOnlyList<FeatureDocument>> ListAsync(FeatureKind kind, int limit, CancellationToken cancellationToken)
    {
        // Served by the "kind_createdAt_id_desc" index.
        return await _features
            .Find(ByKind(kind))
            .SortByDescending(f => f.CreatedAt)
            .ThenByDescending(f => f.Id)
            .Limit(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<FeatureDocument>> QueryAsync(MapDataQuery query, int limit, CancellationToken cancellationToken)
    {
        try
        {
            return await _features
                .Find(MapDataFilterBuilder.Build(query))
                .SortByDescending(f => f.CreatedAt)
                .ThenByDescending(f => f.Id)
                .Limit(limit)
                .ToListAsync(cancellationToken);
        }
        catch (MongoCommandException ex) when (ex.Code == BadValueErrorCode)
        {
            // Filters are validated before they get here. What is left is a box too small for the 2dsphere engine.
            throw new InvalidGeometryException("The bounding box is too small to search.", ex);
        }
    }

    public async Task<FeatureDocument?> GetByIdAsync(string id, FeatureKind kind, CancellationToken cancellationToken)
    {
        if (!ObjectId.TryParse(id, out _))
        {
            return null;
        }

        return await _features.Find(ByIdAndKind(id, kind)).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<FeatureDocument?> UpdateAsync(
        string id,
        FeatureKind kind,
        FeatureUpdate update,
        CancellationToken cancellationToken)
    {
        if (!ObjectId.TryParse(id, out _))
        {
            return null;
        }

        // The new version is written explicitly instead of with $inc: a legacy document has no version field, and $inc
        // would turn the missing value into 1 instead of 2.
        var set = Builders<FeatureDocument>.Update
            .Set(f => f.Geometry, update.Geometry)
            .Set(f => f.Properties.Name, update.Name)
            .Set(f => f.Properties.LayerId, update.LayerId)
            .Set(f => f.Version, update.ExpectedVersion + 1)
            .Set(f => f.UpdatedAt, update.UpdatedAt);

        // Optional fields are removed instead of being stored as null, matching how new features are written.
        set = SetOrUnset(set, f => f.Properties.ObjectType, update.ObjectType);
        set = SetOrUnset(set, f => f.Properties.Color, update.Color);
        set = SetOrUnset(set, f => f.Properties.Shape, update.Shape);
        set = SetOrUnset(set, f => f.Properties.RadiusMeters, update.RadiusMeters);

        var options = new FindOneAndUpdateOptions<FeatureDocument> { ReturnDocument = ReturnDocument.After };

        // A document stored before versions existed has no version field and counts as version 1.
        var versionMatches = Filter.Eq(f => f.Version, update.ExpectedVersion);
        if (update.ExpectedVersion == 1)
        {
            versionMatches |= Filter.Exists(f => f.Version, false);
        }

        FeatureDocument? updated;
        try
        {
            updated = await _features.FindOneAndUpdateAsync(ByIdAndKind(id, kind) & versionMatches, set, options, cancellationToken);
        }
        catch (MongoCommandException ex) when (ex.Code == InvalidGeometryErrorCode)
        {
            throw new InvalidGeometryException("The geometry is invalid.", ex);
        }

        if (updated is not null)
        {
            return updated;
        }

        // Nothing matched: either the feature is gone (404) or somebody changed it since the client read it (409).
        var stillExists = await _features.Find(ByIdAndKind(id, kind)).Limit(1).AnyAsync(cancellationToken);
        return stillExists
            ? throw new ConflictException("The item was changed by someone else. Reload it and try again.")
            : null;
    }

    public async Task<bool> DeleteAsync(string id, FeatureKind kind, CancellationToken cancellationToken)
    {
        if (!ObjectId.TryParse(id, out _))
        {
            return false;
        }

        var result = await _features.DeleteOneAsync(ByIdAndKind(id, kind), cancellationToken);
        return result.DeletedCount == 1;
    }

    public async Task<bool> AnyInLayerAsync(string layerId, CancellationToken cancellationToken)
    {
        if (!ObjectId.TryParse(layerId, out _))
        {
            return false;
        }

        // Served by the "layerId" index.
        var options = new CountOptions { Limit = 1 };
        return await _features.CountDocumentsAsync(Filter.Eq(f => f.Properties.LayerId, layerId), options, cancellationToken) > 0;
    }

    public async Task<long> DeleteAllAsync(FeatureKind kind, CancellationToken cancellationToken)
    {
        var result = await _features.DeleteManyAsync(ByKind(kind), cancellationToken);
        return result.DeletedCount;
    }

    private async Task LoadExistingAsync(
        IReadOnlyList<FeatureDocument> documents,
        FeatureKind kind,
        Dictionary<string, FeatureDocument> existing,
        CancellationToken cancellationToken)
    {
        var clientIds = documents
            .Where(d => d.ClientId is not null)
            .Select(d => d.ClientId!)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (clientIds.Count == 0)
        {
            return;
        }

        // Served by the "clientId_unique" index. A clientId used by the other kind is not a match.
        var found = await _features
            .Find(Filter.In(f => f.ClientId, clientIds) & ByKind(kind))
            .ToListAsync(cancellationToken);
        foreach (var document in found)
        {
            existing[document.ClientId!] = document;
        }
    }

    private static bool IsClientIdDuplicate(BulkWriteError error) =>
        error.Category == ServerErrorCategory.DuplicateKey
        && error.Message.Contains(MongoIndexInitializer.ClientIdIndexName, StringComparison.Ordinal);

    private static UpdateDefinition<FeatureDocument> SetOrUnset<TField>(
        UpdateDefinition<FeatureDocument> update,
        Expression<Func<FeatureDocument, TField>> field,
        TField value) =>
        value is null
            ? update.Unset(new ExpressionFieldDefinition<FeatureDocument>(field))
            : update.Set(field, value);

    private static FilterDefinition<FeatureDocument> ByKind(FeatureKind kind) =>
        Filter.Eq(f => f.Properties.Kind, kind);

    private static FilterDefinition<FeatureDocument> ByIdAndKind(string id, FeatureKind kind) =>
        Filter.Eq(f => f.Id, id) & ByKind(kind);
}
