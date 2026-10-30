using System.ComponentModel.DataAnnotations;

namespace MapManager.Api.Validation;

/// <summary>Validates a <c>double[]</c> property as a GeoJSON position [longitude, latitude].</summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class GeoPositionAttribute : ValidationAttribute
{
    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        // A missing value is reported by [Required], not here.
        if (value is null)
        {
            return ValidationResult.Success;
        }

        var error = GeoJsonRules.ValidatePosition(value as double[]);
        return error is null
            ? ValidationResult.Success
            : new ValidationResult(error, MemberNames(validationContext));
    }

    private static string[]? MemberNames(ValidationContext context) =>
        context.MemberName is null ? null : new[] { context.MemberName };
}
