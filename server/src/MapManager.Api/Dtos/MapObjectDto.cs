using MapManager.Api.Models;

namespace MapManager.Api.Dtos;

/// <summary>An object (marker or symbol) as returned by the API.</summary>
/// <param name="Id">Object id.</param>
/// <param name="Name">Display name.</param>
/// <param name="ObjectType">Object type, serialized as its id, for example "jeep".</param>
/// <param name="LayerId">Id of the layer the object belongs to.</param>
/// <param name="CreatedBy">Name of the user who created the object.</param>
/// <param name="Coordinates">GeoJSON position: [longitude, latitude].</param>
/// <param name="Center">The object's position as { lat, lon }. Derived, not stored.</param>
/// <param name="CreatedAt">Creation time (UTC).</param>
/// <param name="UpdatedAt">Last update time (UTC).</param>
public sealed record MapObjectDto(
    string Id,
    string Name,
    ObjectType ObjectType,
    string LayerId,
    string CreatedBy,
    double[] Coordinates,
    GeoPointDto Center,
    DateTime CreatedAt,
    DateTime UpdatedAt);
