namespace MapManager.Api.Tests.Http;

[CollectionDefinition("MongoDB integration", DisableParallelization = true)]
public sealed class MongoDbCollection : ICollectionFixture<MongoDbFixture>
{
    public const string Name = "MongoDB integration";
}
