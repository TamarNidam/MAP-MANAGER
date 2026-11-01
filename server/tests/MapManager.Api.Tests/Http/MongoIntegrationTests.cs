using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace MapManager.Api.Tests.Http;

[Collection(MongoDbCollection.Name)]
public sealed class MongoIntegrationTests(MongoDbFixture fixture)
{
    [Fact]
    public async Task Geo_within_returns_only_objects_inside_the_selected_polygon()
    {
        using var factory = fixture.CreateFactory();
        using var client = factory.CreateClient();
        var layerId = await GetDefaultLayerIdAsync(client);
        var polygonId = await CreatePolygonAsync(client, layerId, "Search area", Square());
        var response = await client.PostAsJsonAsync("/api/objects", new
        {
            items = new[]
            {
                NewObject("Inside", layerId, [34.5, 32.5]),
                NewObject("Outside", layerId, [10, 10])
            }
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var page = await GetJsonAsync(client, $"/api/map-data?within={polygonId}&type=jeep");
        var items = page.RootElement.GetProperty("items").EnumerateArray().ToArray();
        Assert.Equal("Inside", Assert.Single(items).GetProperty("name").GetString());
    }

    [Fact]
    public async Task Cursor_pages_are_stable_without_gaps_when_created_at_is_tied()
    {
        using var factory = fixture.CreateFactory();
        using var client = factory.CreateClient();
        var layerId = await GetDefaultLayerIdAsync(client);
        var createResponse = await client.PostAsJsonAsync("/api/objects", new
        {
            items = Enumerable.Range(0, 7).Select(index => NewObject($"Page item {index}", layerId, [34.5 + index / 1000d, 32.5])).ToArray()
        });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        using var created = JsonDocument.Parse(await createResponse.Content.ReadAsStringAsync());
        var timestamps = created.RootElement.EnumerateArray()
            .Select(item => item.GetProperty("createdAt").GetString())
            .Distinct()
            .ToArray();
        Assert.Single(timestamps);

        var ids = new List<string>();
        string? cursor = null;
        do
        {
            var path = "/api/map-data?type=jeep&limit=2"
                + (cursor is null ? string.Empty : $"&cursor={Uri.EscapeDataString(cursor)}");
            using var page = await GetJsonAsync(client, path);
            ids.AddRange(page.RootElement.GetProperty("items").EnumerateArray()
                .Select(item => item.GetProperty("id").GetString()!));
            cursor = page.RootElement.GetProperty("nextCursor").GetString();
        }
        while (cursor is not null);

        Assert.Equal(7, ids.Count);
        Assert.Equal(7, ids.Distinct().Count());
        Assert.Equal(ids.OrderByDescending(id => id, StringComparer.Ordinal), ids);
    }

    [Fact]
    public async Task Deleting_a_non_empty_layer_returns_conflict()
    {
        using var factory = fixture.CreateFactory();
        using var client = factory.CreateClient();
        using var layerResponse = await client.PostAsJsonAsync("/api/layers", new { name = "Occupied", color = "#123456" });
        Assert.Equal(HttpStatusCode.Created, layerResponse.StatusCode);
        using var layer = JsonDocument.Parse(await layerResponse.Content.ReadAsStringAsync());
        var layerId = layer.RootElement.GetProperty("id").GetString()!;
        var objectResponse = await client.PostAsJsonAsync("/api/objects", new { items = new[] { NewObject("Placed", layerId, [34.5, 32.5]) } });
        Assert.Equal(HttpStatusCode.Created, objectResponse.StatusCode);

        var deletion = await client.DeleteAsync($"/api/layers/{layerId}");

        Assert.Equal(HttpStatusCode.Conflict, deletion.StatusCode);
    }

    [Fact]
    public async Task Invalid_polygon_is_rejected()
    {
        using var factory = fixture.CreateFactory();
        using var client = factory.CreateClient();
        var layerId = await GetDefaultLayerIdAsync(client);
        var bowTie = new[]
        {
            new[] { new[] { 0d, 0d }, new[] { 1d, 1d }, new[] { 1d, 0d }, new[] { 0d, 1d }, new[] { 0d, 0d } }
        };

        var response = await client.PostAsJsonAsync("/api/polygons", new
        {
            items = new[] { NewPolygon("Invalid", layerId, bowTie) }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Polygon_batch_rolls_back_when_mongo_rejects_a_later_geometry()
    {
        using var factory = fixture.CreateFactory();
        using var client = factory.CreateClient();
        var layerId = await GetDefaultLayerIdAsync(client);
        var outsideHole = new[]
        {
            Square()[0],
            new[] { new[] { 20d, 20d }, new[] { 21d, 20d }, new[] { 21d, 21d }, new[] { 20d, 21d }, new[] { 20d, 20d } }
        };

        var response = await client.PostAsJsonAsync("/api/polygons", new
        {
            items = new[]
            {
                NewPolygon("First", layerId, Square()),
                NewPolygon("Rejected", layerId, outsideHole)
            }
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var list = await GetJsonAsync(client, "/api/polygons?limit=1000");
        Assert.Empty(list.RootElement.EnumerateArray());
    }

    [Fact]
    public async Task Circle_without_radius_is_rejected()
    {
        using var factory = fixture.CreateFactory();
        using var client = factory.CreateClient();
        var layerId = await GetDefaultLayerIdAsync(client);

        var response = await client.PostAsJsonAsync("/api/polygons", new
        {
            items = new[] { new { name = "Radius missing", layerId, createdBy = "integration", shape = "circle", coordinates = Square() } }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task<string> GetDefaultLayerIdAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/api/layers");
        response.EnsureSuccessStatusCode();
        using var layers = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return layers.RootElement.EnumerateArray()
            .Single(layer => layer.GetProperty("isDefault").GetBoolean())
            .GetProperty("id").GetString()!;
    }

    private static async Task<string> CreatePolygonAsync(HttpClient client, string layerId, string name, double[][][] coordinates)
    {
        var response = await client.PostAsJsonAsync("/api/polygons", new { items = new[] { NewPolygon(name, layerId, coordinates) } });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var created = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return created.RootElement[0].GetProperty("id").GetString()!;
    }

    private static async Task<JsonDocument> GetJsonAsync(HttpClient client, string path)
    {
        using var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    }

    private static object NewObject(string name, string layerId, double[] coordinates) => new
    {
        name,
        objectType = "jeep",
        layerId,
        createdBy = "integration",
        coordinates
    };

    private static object NewPolygon(string name, string layerId, double[][][] coordinates) => new
    {
        name,
        layerId,
        createdBy = "integration",
        coordinates
    };

    private static double[][][] Square() =>
    [
        [
            [34, 32], [35, 32], [35, 33], [34, 33], [34, 32]
        ]
    ];
}
