using MongoDB.Driver.GeoJsonObjectModel;

namespace MapManager.Api.Models;

/// <summary>Validated filters for one map-data page. A null member means "do not filter on this".</summary>
public sealed record MapDataQuery
{
    public FeatureKind? Kind { get; init; }

    public ObjectType? ObjectType { get; init; }

    /// <summary>Exact creator name.</summary>
    public string? Creator { get; init; }

    /// <summary>Only features created at or after this time (UTC).</summary>
    public DateTime? CreatedSince { get; init; }

    /// <summary>Plain text, matched case-insensitively anywhere in the name or creator. Not a pattern.</summary>
    public string? Search { get; init; }

    /// <summary>Only objects whose point lies inside this polygon.</summary>
    public GeoJsonPolygon<GeoJson2DGeographicCoordinates>? Within { get; init; }

    public IReadOnlyList<string>? LayerIds { get; init; }

    /// <summary>Only features that intersect this box.</summary>
    public BoundingBox? Bbox { get; init; }

    /// <summary>Only features sorted after this position.</summary>
    public FeatureCursor? After { get; init; }
}
