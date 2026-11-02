using System.ComponentModel.DataAnnotations;
using MapManager.Api.Models;
using MapManager.Api.Validation;

namespace MapManager.Api.Dtos;

/// <summary>One object (marker or symbol) to create.</summary>
public sealed class CreateMapObjectRequest
{
    [Required]
    [StringLength(ValidationLimits.MaxNameLength)]
    public string Name { get; init; } = string.Empty;

    /// <summary>Object type id from GET /api/object-types, for example "jeep".</summary>
    [Required]
    public ObjectType? ObjectType { get; init; }

    /// <summary>Id of an existing layer, from GET /api/layers.</summary>
    [Required]
    [ObjectId]
    public string LayerId { get; init; } = string.Empty;

    /// <summary>
    /// Optional client-generated id (up to 36 characters). Sending the same id again returns the already saved
    /// object instead of creating a second one, so a retried request is safe.
    /// </summary>
    [StringLength(ValidationLimits.MaxClientIdLength, MinimumLength = 1)]
    public string? ClientId { get; init; }

    /// <summary>Name of the user who creates the object. There is no authentication, so this is a plain string.</summary>
    [Required]
    [StringLength(ValidationLimits.MaxCreatedByLength)]
    public string CreatedBy { get; init; } = string.Empty;

    /// <summary>Optional hex color in the form "#RRGGBB", for example "#1D5FD0".</summary>
    [RegularExpression(ValidationLimits.HexColorPattern, ErrorMessage = ValidationLimits.HexColorMessage)]
    public string? Color { get; init; }

    /// <summary>Not accepted: only polygons have a shape.</summary>
    [MustBeAbsent("Objects do not have a shape.")]
    public string? Shape { get; init; }

    /// <summary>Location as a GeoJSON position: [longitude, latitude].</summary>
    [Required]
    [GeoPosition]
    public double[] Coordinates { get; init; } = Array.Empty<double>();
}
