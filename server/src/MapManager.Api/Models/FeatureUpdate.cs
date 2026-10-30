using MongoDB.Driver.GeoJsonObjectModel;

namespace MapManager.Api.Models;

/// <summary>The fields of a feature that an update replaces. Kind, creator and creation time never change.</summary>
/// <param name="Geometry">New geometry. Must match the feature's kind (Point for objects, Polygon for polygons).</param>
/// <param name="Name">New display name.</param>
/// <param name="ObjectType">New object type. Null for polygons.</param>
/// <param name="LayerId">New layer id.</param>
/// <param name="Color">New color. Null removes it.</param>
/// <param name="Shape">New shape. Null for objects.</param>
/// <param name="RadiusMeters">New circle radius. Null removes it.</param>
/// <param name="UpdatedAt">Time of the update (UTC).</param>
public sealed record FeatureUpdate(
    GeoJsonGeometry<GeoJson2DGeographicCoordinates> Geometry,
    string Name,
    ObjectType? ObjectType,
    string LayerId,
    string? Color,
    PolygonShape? Shape,
    double? RadiusMeters,
    DateTime UpdatedAt);
