using System.Text.Json;

namespace MapManager.Api.Infrastructure;

/// <summary>
/// Converts enum values to and from their public ids ("jeep", "polygon"). The API (JSON) and the database (BSON)
/// both use these ids, so a value is spelled the same everywhere.
/// </summary>
public static class EnumIds
{
    /// <summary>Returns the id of an enum value: its name in camelCase, the same as the JSON converter writes.</summary>
    public static string ToId<TEnum>(TEnum value) where TEnum : struct, Enum =>
        JsonNamingPolicy.CamelCase.ConvertName(value.ToString());

    /// <summary>Finds the enum value whose id equals <paramref name="id"/> (case-sensitive).</summary>
    public static bool TryParse<TEnum>(string id, out TEnum value) where TEnum : struct, Enum
    {
        foreach (var candidate in Enum.GetValues<TEnum>())
        {
            if (string.Equals(ToId(candidate), id, StringComparison.Ordinal))
            {
                value = candidate;
                return true;
            }
        }

        value = default;
        return false;
    }
}
