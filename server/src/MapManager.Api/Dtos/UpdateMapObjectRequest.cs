using System.ComponentModel.DataAnnotations;
using MapManager.Api.Models;
using MapManager.Api.Validation;

namespace MapManager.Api.Dtos;

/// <summary>Replaces the editable fields of an existing object. The creator and creation time do not change.</summary>
public sealed class UpdateMapObjectRequest
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

    /// <summary>The object's "version" as last read. A different current version makes the update fail with 409.</summary>
    [Required]
    [Range(1, int.MaxValue - 1)]
    public int? Version { get; init; }

    /// <summary>Hex color in the form "#RRGGBB". Leaving it out removes the current color.</summary>
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
