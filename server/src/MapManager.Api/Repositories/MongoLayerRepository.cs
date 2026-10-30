using MapManager.Api.Errors;
using MapManager.Api.Infrastructure;
using MapManager.Api.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace MapManager.Api.Repositories;

/// <summary>MongoDB implementation of <see cref="ILayerRepository"/>.</summary>
public sealed class MongoLayerRepository : ILayerRepository
{
    /// <summary>MongoDB error code for a unique index violation.</summary>
    private const int DuplicateKeyErrorCode = 11000;

    private const string DuplicateNameMessage = "A layer with this name already exists.";

    private static readonly FilterDefinitionBuilder<LayerDocument> Filter = Builders<LayerDocument>.Filter;

    private readonly IMongoCollection<LayerDocument> _layers;

    public MongoLayerRepository(MongoContext context)
    {
        _layers = context.Layers;
    }

    public async Task<IReadOnlyList<LayerDocument>> ListAsync(CancellationToken cancellationToken)
    {
        return await _layers
            .Find(Filter.Empty, new FindOptions { Collation = MongoCollations.CaseInsensitive })
            .SortByDescending(l => l.IsDefault)
            .ThenBy(l => l.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<LayerDocument?> GetByIdAsync(string id, CancellationToken cancellationToken)
    {
        if (!ObjectId.TryParse(id, out _))
        {
            return null;
        }

        return await _layers.Find(Filter.Eq(l => l.Id, id)).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlySet<string>> FindExistingIdsAsync(IReadOnlyCollection<string> ids, CancellationToken cancellationToken)
    {
        var validIds = ids.Where(id => ObjectId.TryParse(id, out _)).ToList();
        var found = await _layers
            .Find(Filter.In(l => l.Id, validIds))
            .Project(l => l.Id)
            .ToListAsync(cancellationToken);

        // ObjectIds come back in lowercase hex; callers may have sent uppercase.
        return found.Select(id => id!).ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public async Task<bool> NameExistsAsync(string name, string? excludeId, CancellationToken cancellationToken)
    {
        var filter = Filter.Eq(l => l.Name, name);
        if (excludeId is not null && ObjectId.TryParse(excludeId, out _))
        {
            filter &= Filter.Ne(l => l.Id, excludeId);
        }

        // The collation makes the comparison case-insensitive and lets the query use the unique name index.
        var options = new CountOptions { Collation = MongoCollations.CaseInsensitive, Limit = 1 };
        return await _layers.CountDocumentsAsync(filter, options, cancellationToken) > 0;
    }

    public async Task InsertAsync(LayerDocument layer, CancellationToken cancellationToken)
    {
        layer.Id = ObjectId.GenerateNewId().ToString();
        try
        {
            await _layers.InsertOneAsync(layer, cancellationToken: cancellationToken);
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            // Two requests with the same name raced past the service check; the unique index decides.
            throw new ConflictException(DuplicateNameMessage, ex);
        }
    }

    public async Task<LayerDocument?> UpdateAsync(string id, LayerUpdate update, CancellationToken cancellationToken)
    {
        if (!ObjectId.TryParse(id, out _))
        {
            return null;
        }

        var set = Builders<LayerDocument>.Update
            .Set(l => l.Name, update.Name)
            .Set(l => l.Color, update.Color)
            .Set(l => l.UpdatedAt, update.UpdatedAt);
        var options = new FindOneAndUpdateOptions<LayerDocument> { ReturnDocument = ReturnDocument.After };

        try
        {
            return await _layers.FindOneAndUpdateAsync(Filter.Eq(l => l.Id, id), set, options, cancellationToken);
        }
        catch (MongoCommandException ex) when (ex.Code == DuplicateKeyErrorCode)
        {
            throw new ConflictException(DuplicateNameMessage, ex);
        }
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken)
    {
        if (!ObjectId.TryParse(id, out _))
        {
            return false;
        }

        var result = await _layers.DeleteOneAsync(Filter.Eq(l => l.Id, id), cancellationToken);
        return result.DeletedCount == 1;
    }

    public async Task EnsureDefaultAsync(LayerDocument defaultLayer, CancellationToken cancellationToken)
    {
        // Upsert on { isDefault: true }: inserts only when no default layer exists, otherwise changes nothing.
        // The unique partial index on isDefault guarantees a single default layer even if two instances start at once.
        var insertOnly = Builders<LayerDocument>.Update
            .SetOnInsert(l => l.Name, defaultLayer.Name)
            .SetOnInsert(l => l.Color, defaultLayer.Color)
            .SetOnInsert(l => l.CreatedAt, defaultLayer.CreatedAt)
            .SetOnInsert(l => l.UpdatedAt, defaultLayer.UpdatedAt);

        await _layers.UpdateOneAsync(
            Filter.Eq(l => l.IsDefault, true),
            insertOnly,
            new UpdateOptions { IsUpsert = true },
            cancellationToken);
    }
}
