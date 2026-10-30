using System.ComponentModel.DataAnnotations;
using MapManager.Api.Validation;

namespace MapManager.Api.Dtos;

/// <summary>Body for POST /api/layers and PUT /api/layers/{id}. Both take the same fields.</summary>
public sealed class LayerRequest
{
    /// <summary>Display name. Unique, ignoring case. Leading and trailing spaces are removed.</summary>
    [Required]
    [StringLength(ValidationLimits.MaxLayerNameLength)]
    public string Name { get; init; } = string.Empty;

    /// <summary>Hex color in the form "#RRGGBB", for example "#1D5FD0".</summary>
    [Required]
    [RegularExpression(ValidationLimits.HexColorPattern, ErrorMessage = "Must be a hex color such as #1D5FD0.")]
    public string Color { get; init; } = string.Empty;
}
