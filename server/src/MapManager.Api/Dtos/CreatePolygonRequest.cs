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

    /// <summary>
    /// Optional client-generated id (up to 36 characters). Sending the same id again returns the already saved
    /// polygon instead of creating a second one, so a retried request is safe.
    /// </summary>
    [StringLength(ValidationLimits.MaxClientIdLength, MinimumLength = 1)]
    public string? ClientId { get; init; }

    /// <summary>Name of the user who creates the polygon. There is no authentication, so this is a plain string.</summary>
    [Required]
    [StringLength(ValidationLimits.MaxCreatedByLength)]
    public string CreatedBy { get; init; } = string.Empty;

    /// <summary>Optional hex color in the form "#RRGGBB", for example "#1D5FD0".</summary>
    [RegularExpression(ValidationLimits.HexColorPattern, ErrorMessage = ValidationLimits.HexColorMessage)]
    public string? Color { get; init; }

    /// <summary>"polygon" (the default when left out), "rectangle" or "circle".</summary>
    public PolygonShape? Shape { get; init; }

    /// <summary>Radius in meters, greater than 0. Required when the shape is "circle" and rejected otherwise.</summary>
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
