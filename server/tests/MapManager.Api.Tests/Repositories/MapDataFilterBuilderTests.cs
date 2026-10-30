using System.Text.RegularExpressions;
using MapManager.Api.Infrastructure;
using MapManager.Api.Models;
using MapManager.Api.Repositories;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;

namespace MapManager.Api.Tests.Repositories;

public sealed class MapDataFilterBuilderTests
{
    static MapDataFilterBuilderTests()
    {
        MongoConventions.Register();
    }

    [Fact]
    public void Search_text_is_escaped_so_a_dot_only_matches_a_dot()
    {
        var filter = MapDataFilterBuilder.Build(new MapDataQuery { Search = "a.b" });

        var rendered = filter.Render(new RenderArgs<FeatureDocument>(
            BsonSerializer.SerializerRegistry.GetSerializer<FeatureDocument>(),
            BsonSerializer.SerializerRegistry));
        var regex = rendered["$or"][0]["properties.name"].AsBsonRegularExpression;

        Assert.Equal("i", regex.Options);
        Assert.Matches(new Regex(regex.Pattern), "xa.bx");
        Assert.DoesNotMatch(new Regex(regex.Pattern), "axb");
    }
}
