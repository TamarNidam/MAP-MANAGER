using MapManager.Api.Infrastructure;
using MapManager.Api.Mapping;
using MapManager.Api.Models;
using MongoDB.Bson;

namespace MapManager.Api.Tests.Infrastructure;

public sealed class BsonSerializationTests
{
    static BsonSerializationTests()
    {
        MongoConventions.Register();
    }

    [Fact]
    public void Stored_kind_and_object_type_are_lowercase_ids()
    {
        var document = FeatureMapper.ToDocument(TestData.CreateObject(type: ObjectType.Helicopter), DateTime.UtcNow);

        var properties = document.ToBsonDocument()["properties"].AsBsonDocument;

        Assert.Equal("object", properties["kind"].AsString);
        Assert.Equal("helicopter", properties["objectType"].AsString);
    }
}
