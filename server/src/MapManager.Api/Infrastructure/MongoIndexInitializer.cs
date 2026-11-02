using MapManager.Api.Models;
using MongoDB.Driver;

namespace MapManager.Api.Infrastructure;

/// <summary>
/// Creates the indexes at startup. Creating an index that already exists with the same definition is a no-op.
/// If MongoDB is unreachable the application stops here on purpose (fail fast) rather than running without indexes.
/// </summary>
public sealed class MongoIndexInitializer : IHostedService
{
    /// <summary>Name of the unique clientId index. The repository looks for it in duplicate-key errors.</summary>
    public const string ClientIdIndexName = "clientId_unique";

    private readonly MongoContext _context;
    private readonly ILogger<MongoIndexInitializer> _logger;

    public MongoIndexInitializer(MongoContext context, ILogger<MongoIndexInitializer> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var keys = Builders<FeatureDocument>.IndexKeys;

        var featureIndexes = new[]
        {
            // Geospatial queries: $geoWithin (objects inside a polygon) and bounding-box queries.
            new CreateIndexModel<FeatureDocument>(
                keys.Geo2DSphere(f => f.Geometry),
                new CreateIndexOptions { Name = "geometry_2dsphere" }),

            // Cursor pagination: newest first, with _id as the tie-breaker.
            new CreateIndexModel<FeatureDocument>(
                keys.Descending(f => f.CreatedAt).Descending(f => f.Id),
                new CreateIndexOptions { Name = "createdAt_id_desc" }),

            // Filtering by kind and object type.
            new CreateIndexModel<FeatureDocument>(
                keys.Ascending(f => f.Properties.Kind).Ascending(f => f.Properties.ObjectType),
                new CreateIndexOptions { Name = "kind_objectType" }),

            // Listing one kind (GET /api/objects, GET /api/polygons), newest first.
            new CreateIndexModel<FeatureDocument>(
                keys.Ascending(f => f.Properties.Kind).Descending(f => f.CreatedAt).Descending(f => f.Id),
                new CreateIndexOptions { Name = "kind_createdAt_id_desc" }),

            // Filtering by layer.
            new CreateIndexModel<FeatureDocument>(
                keys.Ascending(f => f.Properties.LayerId),
                new CreateIndexOptions { Name = "layerId" }),

            // Idempotent creation: a clientId can be stored once. Features without a clientId are not indexed.
            new CreateIndexModel<FeatureDocument>(
                keys.Ascending(f => f.ClientId),
                new CreateIndexOptions<FeatureDocument>
                {
                    Name = ClientIdIndexName,
                    Unique = true,
                    PartialFilterExpression = Builders<FeatureDocument>.Filter.Exists(f => f.ClientId)
                })
        };

        await _context.Features.Indexes.CreateManyAsync(featureIndexes, cancellationToken);

        var layerKeys = Builders<LayerDocument>.IndexKeys;
        var layerIndexes = new[]
        {
            // Layer names are unique ignoring case ("Roads" and "roads" conflict).
            new CreateIndexModel<LayerDocument>(
                layerKeys.Ascending(l => l.Name),
                new CreateIndexOptions
                {
                    Name = "name_unique_ci",
                    Unique = true,
                    Collation = MongoCollations.CaseInsensitive
                }),

            // At most one default layer, even if two instances seed it at the same time.
            new CreateIndexModel<LayerDocument>(
                layerKeys.Ascending(l => l.IsDefault),
                new CreateIndexOptions<LayerDocument>
                {
                    Name = "isDefault_unique",
                    Unique = true,
                    PartialFilterExpression = Builders<LayerDocument>.Filter.Eq(l => l.IsDefault, true)
                })
        };

        await _context.Layers.Indexes.CreateManyAsync(layerIndexes, cancellationToken);
        _logger.LogInformation("MongoDB indexes are in place on the features and layers collections.");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
