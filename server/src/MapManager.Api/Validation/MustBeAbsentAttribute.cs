using System.ComponentModel.DataAnnotations;

namespace MapManager.Api.Validation;

/// <summary>
/// Rejects a request field that must not be sent. Unknown JSON fields are ignored by design, so a field
/// that has to be refused is declared on the DTO with this attribute.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class MustBeAbsentAttribute : ValidationAttribute
{
    public MustBeAbsentAttribute(string errorMessage)
        : base(errorMessage)
    {
    }

    public override bool IsValid(object? value) => value is null;
}
