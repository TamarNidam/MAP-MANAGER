using MapManager.Api.Configuration;
using MapManager.Api.Models;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace MapManager.Api.Infrastructure;

/// <summary>Single entry point to the database and its collections.</summary>
public sealed class MongoContext
{
    public MongoContext(IMongoClient client, IOptions<MongoSettings> options)
    {
        Database = client.GetDatabase(options.Value.DatabaseName);
        Features = Database.GetCollection<FeatureDocument>("features");
        Layers = Database.GetCollection<LayerDocument>("layers");
    }

    public IMongoDatabase Database { get; }

    public IMongoCollection<FeatureDocument> Features { get; }

    public IMongoCollection<LayerDocument> Layers { get; }
}
