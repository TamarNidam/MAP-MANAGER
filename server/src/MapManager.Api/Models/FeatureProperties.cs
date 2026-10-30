using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MapManager.Api.Models;

/// <summary>The "properties" member of a GeoJSON Feature.</summary>
public sealed class FeatureProperties
{
    /// <summary>Object or polygon. Never changes after creation.</summary>
    [BsonElement("kind")]
    public FeatureKind Kind { get; set; }

    /// <summary>Only set when <see cref="Kind"/> is <see cref="FeatureKind.Object"/>.</summary>
    [BsonElement("objectType")]
    [BsonIgnoreIfNull]
    public ObjectType? ObjectType { get; set; }

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Id of the layer the feature belongs to. Every feature has one.</summary>
    [BsonElement("layerId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string LayerId { get; set; } = string.Empty;

    /// <summary>There is no authentication yet, so this is a plain user name.</summary>
    [BsonElement("createdBy")]
    public string CreatedBy { get; set; } = string.Empty;

    /// <summary>Optional hex color in the form "#RRGGBB".</summary>
    [BsonElement("color")]
    [BsonIgnoreIfNull]
    public string? Color { get; set; }

    /// <summary>Only set on polygons. Polygons stored before this field existed read as a plain polygon.</summary>
    [BsonElement("shape")]
    [BsonIgnoreIfNull]
    public PolygonShape? Shape { get; set; }

    /// <summary>Optional radius of a circle, in meters. Only set when <see cref="Shape"/> is a circle.</summary>
    [BsonElement("radiusMeters")]
    [BsonIgnoreIfNull]
    public double? RadiusMeters { get; set; }
}
