using System.ComponentModel.DataAnnotations;

namespace MapManager.Api.Validation;

/// <summary>
/// Validates that a string is a database id: 24 hexadecimal characters. Used on route ids (so a malformed id
/// returns 400 instead of 404) and on id fields in request bodies. A null value is left to [Required].
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class ObjectIdAttribute : ValidationAttribute
{
    /// <summary>Length of an id in its hexadecimal form.</summary>
    public const int Length = 24;

    public ObjectIdAttribute()
        : base("Must be a 24-character hex id.")
    {
    }

    public override bool IsValid(object? value) =>
        value is null || (value is string id && id.Length == Length && id.All(Uri.IsHexDigit));
}
