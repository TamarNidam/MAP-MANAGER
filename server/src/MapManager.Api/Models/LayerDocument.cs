using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MapManager.Api.Models;

/// <summary>A named group of features. Showing or hiding a layer is client-side state and is not stored.</summary>
public sealed class LayerDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    /// <summary>Display name. Unique, ignoring case.</summary>
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Hex color such as "#1D5FD0".</summary>
    [BsonElement("color")]
    public string Color { get; set; } = string.Empty;

    /// <summary>True only for the layer seeded at startup. That layer cannot be deleted.</summary>
    [BsonElement("isDefault")]
    public bool IsDefault { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
