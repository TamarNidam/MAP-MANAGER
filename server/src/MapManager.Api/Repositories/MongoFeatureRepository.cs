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

    private static readonly FilterDefinitionBuilder<FeatureDocument> Filter = Builders<FeatureDocument>.Filter;

    private readonly IMongoCollection<FeatureDocument> _features;

    public MongoFeatureRepository(MongoContext context)
    {
        _features = context.Features;
    }

    public async Task InsertManyAsync(IReadOnlyList<FeatureDocument> documents, CancellationToken cancellationToken)
    {
        if (documents.Count == 0)
        {
            return;
        }

        // Ids are generated here, before the insert, so a failed batch can be rolled back by id.
        foreach (var document in documents)
        {
            document.Id = ObjectId.GenerateNewId().ToString();
        }

        try
        {
            await _features.InsertManyAsync(documents, new InsertManyOptions { IsOrdered = true }, cancellationToken);
        }
        catch (MongoBulkWriteException ex)
        {
            // The local MongoDB is a standalone server, so multi-document transactions are not available and this insert is not atomic.
            // An ordered insert stops at the first error. This best-effort rollback removes the batch by id; if the delete
            // also fails, the documents inserted before the error stay stored.
            var ids = documents.Select(d => d.Id);
            await _features.DeleteManyAsync(Filter.In(f => f.Id, ids), CancellationToken.None);

            var geometryError = ex.WriteErrors.FirstOrDefault(e => e.Code == InvalidGeometryErrorCode);
            if (geometryError is not null)
            {
                throw new InvalidGeometryException($"Item {geometryError.Index} has an invalid geometry.", ex);
            }

            throw;
        }
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

        var set = Builders<FeatureDocument>.Update
            .Set(f => f.Geometry, update.Geometry)
            .Set(f => f.Properties.Name, update.Name)
            .Set(f => f.Properties.LayerId, update.LayerId)
            .Set(f => f.UpdatedAt, update.UpdatedAt);

        // Optional fields are removed instead of being stored as null, matching how new features are written.
        set = SetOrUnset(set, f => f.Properties.ObjectType, update.ObjectType);
        set = SetOrUnset(set, f => f.Properties.Color, update.Color);
        set = SetOrUnset(set, f => f.Properties.Shape, update.Shape);
        set = SetOrUnset(set, f => f.Properties.RadiusMeters, update.RadiusMeters);

        var options = new FindOneAndUpdateOptions<FeatureDocument> { ReturnDocument = ReturnDocument.After };

        try
        {
            return await _features.FindOneAndUpdateAsync(ByIdAndKind(id, kind), set, options, cancellationToken);
        }
        catch (MongoCommandException ex) when (ex.Code == InvalidGeometryErrorCode)
        {
            throw new InvalidGeometryException("The geometry is invalid.", ex);
        }
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
