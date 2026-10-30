using System.ComponentModel.DataAnnotations;
using MapManager.Api.Models;
using MapManager.Api.Validation;

namespace MapManager.Api.Dtos;

/// <summary>One polygon to create.</summary>
public sealed class CreatePolygonRequest : IValidatableObject
{
    [Required]
    [StringLength(ValidationLimits.MaxNameLength)]
    public string Name { get; init; } = string.Empty;

    /// <summary>Id of an existing layer, from GET /api/layers.</summary>
    [Required]
    [ObjectId]
    public string LayerId { get; init; } = string.Empty;

    /// <summary>Name of the user who creates the polygon. There is no authentication, so this is a plain string.</summary>
    [Required]
    [StringLength(ValidationLimits.MaxCreatedByLength)]
    public string CreatedBy { get; init; } = string.Empty;

    /// <summary>Optional hex color in the form "#RRGGBB", for example "#1D5FD0".</summary>
    [RegularExpression(ValidationLimits.HexColorPattern, ErrorMessage = ValidationLimits.HexColorMessage)]
    public string? Color { get; init; }

    /// <summary>"polygon" (the default when left out), "rectangle" or "circle".</summary>
    public PolygonShape? Shape { get; init; }

    /// <summary>Optional radius in meters. Only accepted when the shape is "circle".</summary>
    [Range(0d, ValidationLimits.MaxRadiusMeters, MinimumIsExclusive = true)]
    public double? RadiusMeters { get; init; }

    /// <summary>
    /// GeoJSON polygon coordinates: a list of closed rings of [longitude, latitude] positions.
    /// The first ring is the exterior ring, any further rings are holes.
    /// </summary>
    [Required]
    [GeoPolygon]
    public double[][][] Coordinates { get; init; } = Array.Empty<double[][]>();

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        PolygonShapeRules.Validate(Shape, RadiusMeters);
}
