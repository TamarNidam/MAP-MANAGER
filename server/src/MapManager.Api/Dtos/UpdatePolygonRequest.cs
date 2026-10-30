using System.ComponentModel.DataAnnotations;
using MapManager.Api.Validation;

namespace MapManager.Api.Dtos;

/// <summary>Replaces the editable fields of an existing polygon. The creator and creation time do not change.</summary>
public sealed class UpdatePolygonRequest
{
    [Required]
    [StringLength(ValidationLimits.MaxNameLength)]
    public string Name { get; init; } = string.Empty;

    /// <summary>Id of an existing layer, from GET /api/layers.</summary>
    [Required]
    [ObjectId]
    public string LayerId { get; init; } = string.Empty;

    /// <summary>GeoJSON polygon coordinates: a list of closed rings of [longitude, latitude] positions.</summary>
    [Required]
    [GeoPolygon]
    public double[][][] Coordinates { get; init; } = Array.Empty<double[][]>();
}
