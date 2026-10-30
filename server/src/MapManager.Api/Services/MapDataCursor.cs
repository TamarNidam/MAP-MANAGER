using System.Globalization;
using System.Text;
using MapManager.Api.Models;
using MapManager.Api.Validation;
using Microsoft.AspNetCore.WebUtilities;

namespace MapManager.Api.Services;

/// <summary>
/// Converts a sort position to and from the opaque cursor string sent to clients: URL-safe base64 of
/// the creation time and the id, so it can be placed in a query string as it is.
/// </summary>
public static class MapDataCursor
{
    private const char Separator = '|';

    private const string DateFormat = "O";

    public static string Encode(FeatureCursor cursor)
    {
        var text = $"{cursor.CreatedAt.ToString(DateFormat, CultureInfo.InvariantCulture)}{Separator}{cursor.Id}";
        return WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(text));
    }

    /// <summary>Returns the sort position, or null when the text is not a cursor written by <see cref="Encode"/>.</summary>
    public static FeatureCursor? TryDecode(string text)
    {
        string decoded;
        try
        {
            decoded = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(text));
        }
        catch (FormatException)
        {
            return null;
        }

        var parts = decoded.Split(Separator);
        if (parts.Length != 2 || !new ObjectIdAttribute().IsValid(parts[1]))
        {
            return null;
        }

        var isDate = DateTime.TryParseExact(
            parts[0],
            DateFormat,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind,
            out var createdAt);

        return isDate && createdAt.Kind == DateTimeKind.Utc ? new FeatureCursor(createdAt, parts[1]) : null;
    }
}
