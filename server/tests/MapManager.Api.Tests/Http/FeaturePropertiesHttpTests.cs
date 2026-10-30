using System.Net;
using System.Text;
using System.Text.Json;

namespace MapManager.Api.Tests.Http;

/// <summary>Validation of the optional color, shape and radiusMeters fields on POST.</summary>
public sealed class FeaturePropertiesHttpTests : IDisposable
{
    private const string ObjectsPath = "/api/objects";
    private const string PolygonsPath = "/api/polygons";

    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public FeaturePropertiesHttpTests()
    {
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
    [InlineData(PolygonsPath, "\"shape\":\"rectangle\",\"radiusMeters\":100", HttpStatusCode.BadRequest)]
    [InlineData(PolygonsPath, "\"radiusMeters\":100", HttpStatusCode.BadRequest)]
    [InlineData(ObjectsPath, "\"shape\":\"circle\"", HttpStatusCode.BadRequest)]
    public async Task Shape_and_radius_follow_the_rules(string path, string fields, HttpStatusCode expected)
    {
        var response = await PostAsync(path, fields);

        Assert.Equal(expected, response.StatusCode);
    }

    private Task<HttpResponseMessage> PostAsync(string path, string extraFields)
    {
        var geometry = path == ObjectsPath
            ? $"\"objectType\":\"jeep\",\"coordinates\":{JsonSerializer.Serialize(TestData.Point())}"
            : $"\"coordinates\":{JsonSerializer.Serialize(TestData.Square())}";
        var item = $"\"name\":\"x\",\"createdBy\":\"tamar\",\"layerId\":\"{TestData.LayerId}\",{geometry},{extraFields}";
        var body = $"{{\"items\":[{{{item}}}]}}";

        return _client.PostAsync(path, new StringContent(body, Encoding.UTF8, "application/json"));
    }
}
