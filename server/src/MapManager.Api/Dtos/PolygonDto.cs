namespace MapManager.Api.Dtos;

/// <summary>A polygon as returned by the API.</summary>
/// <param name="Id">Polygon id.</param>
/// <param name="Name">Display name.</param>
/// <param name="LayerId">Id of the layer the polygon belongs to.</param>
/// <param name="CreatedBy">Name of the user who created the polygon.</param>
/// <param name="Coordinates">GeoJSON polygon coordinates: closed rings of [longitude, latitude] positions.</param>
/// <param name="Center">Area-weighted centroid of the exterior ring as { lat, lon }. Derived, not stored.</param>
/// <param name="CreatedAt">Creation time (UTC).</param>
/// <param name="UpdatedAt">Last update time (UTC).</param>
public sealed record PolygonDto(
    string Id,
    string Name,
    string LayerId,
    string CreatedBy,
    double[][][] Coordinates,
    GeoPointDto Center,
    DateTime CreatedAt,
    DateTime UpdatedAt);
