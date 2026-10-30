using System.Text.Json;
using System.Text.Json.Serialization;

namespace MapManager.Api.Infrastructure;

/// <summary>JSON settings for the API, shared by Program.cs and the tests so both use the same contract.</summary>
public static class JsonConfiguration
{
    /// <summary>
    /// Enums are written and read as camelCase strings ("jeep", "helicopter"), matching the ids from
    /// GET /api/object-types. Numeric enum values are rejected so an unknown number cannot slip through.
    /// </summary>
    public static void Configure(JsonSerializerOptions options)
    {
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
    }
}
