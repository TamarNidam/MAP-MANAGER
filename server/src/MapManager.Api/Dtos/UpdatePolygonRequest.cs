using System.ComponentModel.DataAnnotations;
using MapManager.Api.Models;
using MapManager.Api.Validation;

namespace MapManager.Api.Dtos;

/// <summary>Replaces the editable fields of an existing polygon. The creator and creation time do not change.</summary>
public sealed class UpdatePolygonRequest : IValidatableObject
{
    [Required]
    [StringLength(ValidationLimits.MaxNameLength)]
    public string Name { get; init; } = string.Empty;

    /// <summary>Id of an existing layer, from GET /api/layers.</summary>
    [Required]
    [ObjectId]
    public string LayerId { get; init; } = string.Empty;

    /// <summary>Hex color in the form "#RRGGBB". Leaving it out removes the current color.</summary>
    [RegularExpression(ValidationLimits.HexColorPattern, ErrorMessage = ValidationLimits.HexColorMessage)]
    public string? Color { get; init; }

    /// <summary>"polygon" (the default when left out), "rectangle" or "circle".</summary>
    public PolygonShape? Shape { get; init; }

    /// <summary>Radius in meters, greater than 0. Required when the shape is "circle" and rejected otherwise.</summary>
    [Range(0d, ValidationLimits.MaxRadiusMeters, MinimumIsExclusive = true)]
    public double? RadiusMeters { get; init; }

    /// <summary>GeoJSON polygon coordinates: a list of closed rings of [longitude, latitude] positions.</summary>
    [Required]
    [GeoPolygon]
    public double[][][] Coordinates { get; init; } = Array.Empty<double[][]>();

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        PolygonShapeRules.Validate(Shape, RadiusMeters);
}
