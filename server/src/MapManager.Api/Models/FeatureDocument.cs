using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver.GeoJsonObjectModel;

namespace MapManager.Api.Models;

/// <summary>
/// A GeoJSON Feature stored in MongoDB. The geometry is a Point for objects and a Polygon for polygons.
/// GeoJSON coordinate order is [longitude, latitude].
/// </summary>
public sealed class FeatureDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    /// <summary>Always "Feature", so each document is a valid GeoJSON Feature.</summary>
    [BsonElement("type")]
    public string Type { get; set; } = "Feature";

    /// <summary>A Point for objects, a Polygon for polygons. Indexed with 2dsphere.</summary>
    [BsonElement("geometry")]
    public GeoJsonGeometry<GeoJson2DGeographicCoordinates> Geometry { get; set; } = null!;

    [BsonElement("properties")]
    public FeatureProperties Properties { get; set; } = new();

    /// <summary>
    /// Client-generated id that makes creation idempotent (unique when present). Null for features created without one.
    /// </summary>
    [BsonElement("clientId")]
    [BsonIgnoreIfNull]
    public string? ClientId { get; set; }

    /// <summary>
    /// Optimistic concurrency token, incremented on every update. Documents stored before this field existed have no
    /// value in MongoDB and read as 1, because the property initializer is kept when the element is missing.
    /// </summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
