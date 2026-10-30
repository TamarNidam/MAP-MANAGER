using System.ComponentModel.DataAnnotations;
using MapManager.Api.Validation;

namespace MapManager.Api.Dtos;

/// <summary>Query parameters of GET /api/map-data. All are optional and combine with AND.</summary>
public sealed class MapDataQueryRequest
{
    /// <summary>"polygon" or an object type id from GET /api/object-types, for example "jeep".</summary>
    public string? Type { get; init; }

    /// <summary>Exact name of the creator.</summary>
    [StringLength(ValidationLimits.MaxCreatedByLength)]
    public string? Creator { get; init; }

    /// <summary>Only features created in the last N days (UTC).</summary>
    [Range(1, ValidationLimits.MaxCreatedWithinDays)]
    public int? CreatedWithinDays { get; init; }

    /// <summary>Case-insensitive "contains" search on the name and the creator. Taken as plain text.</summary>
    [StringLength(ValidationLimits.MaxNameLength)]
    public string? Q { get; init; }

    /// <summary>Id of a polygon. Returns the objects whose point lies inside it, not the polygon itself.</summary>
    [ObjectId]
    public string? Within { get; init; }

    /// <summary>Comma-separated layer ids.</summary>
    [StringLength(ValidationLimits.MaxLayerFilterLength)]
    public string? Layers { get; init; }

    /// <summary>minLon,minLat,maxLon,maxLat. Returns the features that intersect this box.</summary>
    [StringLength(ValidationLimits.MaxBboxLength)]
    public string? Bbox { get; init; }

    /// <summary>Page size.</summary>
    [Range(1, ValidationLimits.MaxMapDataLimit)]
    public int Limit { get; init; } = ValidationLimits.DefaultMapDataLimit;

    /// <summary>The "nextCursor" of the previous page.</summary>
    [StringLength(ValidationLimits.MaxCursorLength)]
    public string? Cursor { get; init; }
}
