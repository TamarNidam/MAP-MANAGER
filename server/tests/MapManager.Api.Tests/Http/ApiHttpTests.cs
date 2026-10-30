using System.Net;
using System.Text;

namespace MapManager.Api.Tests.Http;

/// <summary>Sends real HTTP requests through the whole pipeline (routing, validation, error handling).</summary>
public sealed class ApiHttpTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public ApiHttpTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    [Theory]
    [InlineData("GET", "/api/objects/not-an-id")]
    [InlineData("DELETE", "/api/polygons/123")]
    [InlineData("DELETE", "/api/layers/65a1b2c3d4e5f6a7b8c9d0fz")]
    public async Task Malformed_id_returns_400(string method, string path)
    {
        var response = await _client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("""{"items":[{"name":""")]
    [InlineData("""{"items":[{"name":"x","objectType":"tank","createdBy":"a","layerId":"65a1b2c3d4e5f6a7b8c9d0e1","coordinates":[1,1]}]}""")]
    public async Task Error_response_is_problem_details_without_internal_names(string body)
    {
        var response = await _client.PostAsync("/api/objects", new StringContent(body, Encoding.UTF8, "application/json"));

        var text = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.DoesNotContain("System.", text);
        Assert.DoesNotContain("MapManager", text);
        Assert.DoesNotContain("\"request\"", text);
    }
}
