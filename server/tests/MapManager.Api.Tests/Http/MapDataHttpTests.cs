using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace MapManager.Api.Tests.Http;

/// <summary>GET /api/map-data through the whole pipeline, with the in-memory repository behind it.</summary>
public sealed class MapDataHttpTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public MapDataHttpTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    [Fact]
    public async Task Cursor_paging_returns_each_item_exactly_once()
    {
        // One batch shares one timestamp, so paging has to rely on the _id tie-breaker.
        await CreateObjectsAsync(Enumerable.Range(0, 25).Select(i => NewObject($"Item {i}")).ToArray());

        var ids = new List<string>();
        var pageSizes = new List<int>();
        string? cursor = null;
        do
        {
            var query = "limit=10" + (cursor is null ? string.Empty : $"&cursor={Uri.EscapeDataString(cursor)}");
            var page = await GetPageAsync(query);
            var items = page.GetProperty("items").EnumerateArray().ToList();
            pageSizes.Add(items.Count);
            ids.AddRange(items.Select(item => item.GetProperty("id").GetString()!));
            cursor = page.GetProperty("nextCursor").GetString();
        }
        while (cursor is not null);

        Assert.Equal(new[] { 10, 10, 5 }, pageSizes);
        Assert.Equal(25, ids.Distinct().Count());
    }

    [Fact]
    public async Task Type_filter_returns_only_that_type_and_rejects_unknown_values()
    {
        await CreateObjectsAsync(NewObject("A jeep", "jeep"), NewObject("A truck", "truck"));
        await CreatePolygonAsync();

        var jeeps = (await GetPageAsync("type=jeep")).GetProperty("items").EnumerateArray().ToList();
        var polygons = (await GetPageAsync("type=polygon")).GetProperty("items").EnumerateArray().ToList();
        var invalid = await _client.GetAsync("/api/map-data?type=tank");

        Assert.Equal("object", Assert.Single(jeeps).GetProperty("kind").GetString());
        Assert.Equal("A jeep", jeeps[0].GetProperty("name").GetString());
        Assert.Equal("polygon", Assert.Single(polygons).GetProperty("kind").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
    }

    [Fact]
    public async Task Within_returns_only_the_objects_inside_the_polygon()
    {
        var polygonId = await CreatePolygonAsync();
        await CreateObjectsAsync(NewObject("Inside"), NewObject("Outside", coordinates: new[] { 10.0, 10.0 }));

        var items = (await GetPageAsync($"within={polygonId}")).GetProperty("items").EnumerateArray().ToList();
        var unknown = await _client.GetAsync($"/api/map-data?within={TestData.LayerId}");

        Assert.Equal("Inside", Assert.Single(items).GetProperty("name").GetString());
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    [Theory]
    [InlineData("not-base64!")]
    [InlineData("bm90LWEtY3Vyc29y")] // Valid base64, but not a cursor.
    public async Task Malformed_cursor_returns_400(string cursor)
    {
        var response = await _client.GetAsync($"/api/map-data?cursor={cursor}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static object NewObject(string name, string type = "jeep", double[]? coordinates = null) => new
    {
        name,
        objectType = type,
        layerId = TestData.LayerId,
        createdBy = "tamar",
        coordinates = coordinates ?? TestData.Point()
    };

    private async Task CreateObjectsAsync(params object[] items)
    {
        var response = await _client.PostAsJsonAsync("/api/objects", new { items });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private async Task<string> CreatePolygonAsync()
    {
        var items = new[]
        {
            new { name = "Area", layerId = TestData.LayerId, createdBy = "tamar", coordinates = TestData.Square() }
        };
        var response = await _client.PostAsJsonAsync("/api/polygons", new { items });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var created = await response.Content.ReadFromJsonAsync<JsonElement>();
        return created[0].GetProperty("id").GetString()!;
    }

    private async Task<JsonElement> GetPageAsync(string query)
    {
        var response = await _client.GetAsync($"/api/map-data?{query}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
