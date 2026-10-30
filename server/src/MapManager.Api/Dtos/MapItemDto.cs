using System.Text.Json.Serialization;

namespace MapManager.Api.Dtos;

/// <summary>
/// One item of GET /api/map-data: an object or a polygon. The "kind" discriminator is only written when an item is
/// serialized through this base type, so the object and polygon endpoints keep their own response shapes.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(MapObjectDto), "object")]
[JsonDerivedType(typeof(PolygonDto), "polygon")]
public abstract record MapItemDto;
