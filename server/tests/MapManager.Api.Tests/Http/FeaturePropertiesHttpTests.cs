using System.Net;
using System.Text;
using System.Text.Json;

namespace MapManager.Api.Tests.Http;

/// <summary>Validation of the optional color, shape and radiusMeters fields on POST.</summary>
[Collection(MongoDbCollection.Name)]
public sealed class FeaturePropertiesHttpTests : IDisposable
{
    private const string ObjectsPath = "/api/objects";
    private const string PolygonsPath = "/api/polygons";

    private readonly MongoApiFactory _factory;
    private readonly HttpClient _client;

    public FeaturePropertiesHttpTests(MongoDbFixture fixture)
    {
        _factory = fixture.CreateFactory();
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    [Theory]
    [InlineData(ObjectsPath, "#1D5FD0", HttpStatusCode.Created)]
    [InlineData(PolygonsPath, "#1d5fd0", HttpStatusCode.Created)]
    [InlineData(ObjectsPath, "red", HttpStatusCode.BadRequest)]
    [InlineData(PolygonsPath, "#12345", HttpStatusCode.BadRequest)]
    public async Task Color_must_be_a_hex_color(string path, string color, HttpStatusCode expected)
    {
        var response = await PostAsync(path, $"\"color\":\"{color}\"");

        Assert.Equal(expected, response.StatusCode);
    }

    [Theory]
    [InlineData(PolygonsPath, "\"shape\":\"circle\",\"radiusMeters\":100", HttpStatusCode.Created)]
    [InlineData(PolygonsPath, "\"shape\":\"rectangle\"", HttpStatusCode.Created)]
    [InlineData(PolygonsPath, "\"shape\":\"hexagon\"", HttpStatusCode.BadRequest)]
    [InlineData(PolygonsPath, "\"shape\":\"circle\",\"radiusMeters\":0", HttpStatusCode.BadRequest)]
    [InlineData(PolygonsPath, "\"shape\":\"circle\",\"radiusMeters\":-5", HttpStatusCode.BadRequest)]
    [InlineData(PolygonsPath, "\"shape\":\"rectangle\",\"radiusMeters\":100", HttpStatusCode.BadRequest)]
    [InlineData(PolygonsPath, "\"radiusMeters\":100", HttpStatusCode.BadRequest)]
    [InlineData(ObjectsPath, "\"shape\":\"circle\"", HttpStatusCode.BadRequest)]
    public async Task Shape_and_radius_follow_the_rules(string path, string fields, HttpStatusCode expected)
    {
        var response = await PostAsync(path, fields);

        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task Updating_a_circle_without_a_radius_returns_problem_details()
    {
        var layerId = await GetDefaultLayerIdAsync();
        var body = $"{{\"name\":\"x\",\"layerId\":\"{layerId}\",\"shape\":\"circle\",\"version\":1,\"coordinates\":{JsonSerializer.Serialize(TestData.Square())}}}";

        var response = await _client.PutAsync(
            $"{PolygonsPath}/{layerId}",
            new StringContent(body, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("radiusMeters", await response.Content.ReadAsStringAsync());
    }

    private async Task<HttpResponseMessage> PostAsync(string path, string extraFields)
    {
        var layerId = await GetDefaultLayerIdAsync();
        var geometry = path == ObjectsPath
            ? $"\"objectType\":\"jeep\",\"coordinates\":{JsonSerializer.Serialize(TestData.Point())}"
            : $"\"coordinates\":{JsonSerializer.Serialize(TestData.Square())}";
        var item = $"\"name\":\"x\",\"createdBy\":\"tamar\",\"layerId\":\"{layerId}\",{geometry},{extraFields}";
        var body = $"{{\"items\":[{{{item}}}]}}";

        return await _client.PostAsync(path, new StringContent(body, Encoding.UTF8, "application/json"));
    }

    private async Task<string> GetDefaultLayerIdAsync()
    {
        using var response = await _client.GetAsync("/api/layers");
        response.EnsureSuccessStatusCode();
        using var layers = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return layers.RootElement.EnumerateArray()
            .Single(layer => layer.GetProperty("isDefault").GetBoolean())
            .GetProperty("id").GetString()!;
    }
}
