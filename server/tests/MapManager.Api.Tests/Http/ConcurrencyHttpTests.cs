using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MongoDB.Bson;
using MongoDB.Driver;

namespace MapManager.Api.Tests.Http;

[Collection(MongoDbCollection.Name)]
public sealed class ConcurrencyHttpTests(MongoDbFixture fixture)
{
    [Fact]
    public async Task Repeated_client_id_returns_the_saved_object_and_creates_no_second_one()
    {
        using var factory = fixture.CreateFactory();
        using var client = factory.CreateClient();
        var layerId = await GetDefaultLayerIdAsync(client);
        var clientId = Guid.NewGuid().ToString();

        var first = await CreateObjectAsync(client, layerId, clientId);
        var second = await CreateObjectAsync(client, layerId, clientId);

        Assert.Equal(first.GetProperty("id").GetString(), second.GetProperty("id").GetString());
        using var list = JsonDocument.Parse(await client.GetStringAsync("/api/objects?limit=1000"));
        Assert.Single(list.RootElement.EnumerateArray());
    }

    [Fact]
    public async Task Retried_batch_keeps_saved_items_and_only_inserts_the_missing_ones()
    {
        using var factory = fixture.CreateFactory();
        using var client = factory.CreateClient();
        var layerId = await GetDefaultLayerIdAsync(client);
        var firstId = Guid.NewGuid().ToString();
        var secondId = Guid.NewGuid().ToString();
        var saved = await CreateObjectAsync(client, layerId, firstId);

        var response = await client.PostAsJsonAsync("/api/objects", new
        {
            items = new[] { NewObject(layerId, firstId), NewObject(layerId, secondId) }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var batch = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var items = batch.RootElement.EnumerateArray().ToArray();
        Assert.Equal(saved.GetProperty("id").GetString(), items[0].GetProperty("id").GetString());
        Assert.NotEqual(items[0].GetProperty("id").GetString(), items[1].GetProperty("id").GetString());
        using var list = JsonDocument.Parse(await client.GetStringAsync("/api/objects?limit=1000"));
        Assert.Equal(2, list.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task Update_with_a_stale_version_returns_conflict()
    {
        using var factory = fixture.CreateFactory();
        using var client = factory.CreateClient();
        var layerId = await GetDefaultLayerIdAsync(client);
        var created = await CreateObjectAsync(client, layerId);
        var id = created.GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.OK, (await PutObjectAsync(client, id, layerId, "Renamed", 1)).StatusCode);

        var stale = await PutObjectAsync(client, id, layerId, "Stale write", 1);

        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
    }

    [Fact]
    public async Task Update_with_the_current_version_succeeds_and_increments_it()
    {
        using var factory = fixture.CreateFactory();
        using var client = factory.CreateClient();
        var layerId = await GetDefaultLayerIdAsync(client);
        var created = await CreateObjectAsync(client, layerId);
        Assert.Equal(1, created.GetProperty("version").GetInt32());
        var id = created.GetProperty("id").GetString()!;

        var response = await PutObjectAsync(client, id, layerId, "Renamed", 1);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var updated = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(2, updated.RootElement.GetProperty("version").GetInt32());
        Assert.Equal("Renamed", updated.RootElement.GetProperty("name").GetString());
    }

    [Fact]
    public async Task Update_of_a_missing_item_returns_not_found()
    {
        using var factory = fixture.CreateFactory();
        using var client = factory.CreateClient();
        var layerId = await GetDefaultLayerIdAsync(client);

        var response = await PutObjectAsync(client, "65a1b2c3d4e5f6a7b8c9d0e1", layerId, "Ghost", 1);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Legacy_item_without_a_version_reads_as_one_and_can_be_updated_once()
    {
        using var factory = fixture.CreateFactory();
        using var client = factory.CreateClient();
        var layerId = await GetDefaultLayerIdAsync(client);
        var created = await CreateObjectAsync(client, layerId);
        var id = created.GetProperty("id").GetString()!;
        var features = new MongoClient(factory.ConnectionString)
            .GetDatabase(factory.DatabaseName)
            .GetCollection<BsonDocument>("features");
        await features.UpdateOneAsync(
            Builders<BsonDocument>.Filter.Eq("_id", ObjectId.Parse(id)),
            Builders<BsonDocument>.Update.Unset("version"));

        using var legacy = JsonDocument.Parse(await client.GetStringAsync($"/api/objects/{id}"));
        Assert.Equal(1, legacy.RootElement.GetProperty("version").GetInt32());

        var first = await PutObjectAsync(client, id, layerId, "Migrated", 1);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        using var updated = JsonDocument.Parse(await first.Content.ReadAsStringAsync());
        Assert.Equal(2, updated.RootElement.GetProperty("version").GetInt32());

        var second = await PutObjectAsync(client, id, layerId, "Again with version 1", 1);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    private static async Task<JsonElement> CreateObjectAsync(HttpClient client, string layerId, string? clientId = null)
    {
        using var response = await client.PostAsJsonAsync("/api/objects", new { items = new[] { NewObject(layerId, clientId) } });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement[0].Clone();
    }

    private static Task<HttpResponseMessage> PutObjectAsync(HttpClient client, string id, string layerId, string name, int version) =>
        client.PutAsJsonAsync($"/api/objects/{id}", new
        {
            name,
            objectType = "jeep",
            layerId,
            coordinates = new[] { 34.5, 32.5 },
            version
        });

    private static object NewObject(string layerId, string? clientId) => new
    {
        clientId,
        name = "Concurrency item",
        objectType = "jeep",
        layerId,
        createdBy = "integration",
        coordinates = new[] { 34.5, 32.5 }
    };

    private static async Task<string> GetDefaultLayerIdAsync(HttpClient client)
    {
        using var layers = JsonDocument.Parse(await client.GetStringAsync("/api/layers"));
        return layers.RootElement.EnumerateArray()
            .Single(layer => layer.GetProperty("isDefault").GetBoolean())
            .GetProperty("id").GetString()!;
    }
}
