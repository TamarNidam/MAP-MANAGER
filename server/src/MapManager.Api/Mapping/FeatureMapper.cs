using MapManager.Api.Dtos;
using MapManager.Api.Models;

namespace MapManager.Api.Mapping;

/// <summary>
/// The single place where DTOs are mapped to feature documents and back.
/// Text fields are trimmed here, so stored values never carry leading or trailing spaces.
/// </summary>
public static class FeatureMapper
{
    /// <summary>Builds a new object document. The id is assigned by the repository.</summary>
    public static FeatureDocument ToDocument(CreateMapObjectRequest request, DateTime now) => new()
    {
        Geometry = GeometryMapper.ToPoint(request.Coordinates),
        Properties = new FeatureProperties
        {
            Kind = FeatureKind.Object,
            ObjectType = request.ObjectType!.Value,
            Name = request.Name.Trim(),
            LayerId = request.LayerId,
            CreatedBy = request.CreatedBy.Trim(),
            Color = request.Color
        },
        ClientId = request.ClientId,
        CreatedAt = now,
        UpdatedAt = now
    };

    /// <summary>Builds a new polygon document. The id is assigned by the repository.</summary>
    public static FeatureDocument ToDocument(CreatePolygonRequest request, DateTime now) => new()
    {
        Geometry = GeometryMapper.ToPolygon(request.Coordinates),
        Properties = new FeatureProperties
        {
            Kind = FeatureKind.Polygon,
            Name = request.Name.Trim(),
            LayerId = request.LayerId,
            CreatedBy = request.CreatedBy.Trim(),
            Color = request.Color,
            Shape = request.Shape ?? PolygonShape.Polygon,
            RadiusMeters = request.RadiusMeters
        },
        ClientId = request.ClientId,
        CreatedAt = now,
        UpdatedAt = now
    };

    /// <summary>Builds the field changes for an object update.</summary>
    public static FeatureUpdate ToUpdate(UpdateMapObjectRequest request, DateTime now) => new(
        GeometryMapper.ToPoint(request.Coordinates),
        request.Name.Trim(),
        request.ObjectType!.Value,
        request.LayerId,
        request.Color,
        Shape: null,
        RadiusMeters: null,
        request.Version!.Value,
        now);

    /// <summary>Builds the field changes for a polygon update.</summary>
    public static FeatureUpdate ToUpdate(UpdatePolygonRequest request, DateTime now) => new(
        GeometryMapper.ToPolygon(request.Coordinates),
        request.Name.Trim(),
        ObjectType: null,
        request.LayerId,
        request.Color,
        request.Shape ?? PolygonShape.Polygon,
        request.RadiusMeters,
        request.Version!.Value,
        now);

    /// <summary>Maps a document of either kind to its API shape.</summary>
    public static MapItemDto ToMapItemDto(FeatureDocument document) =>
        document.Properties.Kind == FeatureKind.Object ? ToMapObjectDto(document) : ToPolygonDto(document);

    /// <summary>Maps an object document to its API shape, including its derived center.</summary>
    public static MapObjectDto ToMapObjectDto(FeatureDocument document)
    {
        var position = GeometryMapper.ToPosition(document.Geometry);
        return new MapObjectDto(
            RequireId(document),
            document.Properties.Name,
            document.Properties.ObjectType ?? throw new InvalidOperationException("A stored object must have an object type."),
            document.Properties.LayerId,
            document.Properties.CreatedBy,
            document.Properties.Color,
            position,
            CenterCalculator.OfPosition(position),
            document.Version,
            document.CreatedAt,
            document.UpdatedAt);
    }

    /// <summary>Maps a polygon document to its API shape, including the centroid of its exterior ring.</summary>
    public static PolygonDto ToPolygonDto(FeatureDocument document)
    {
        var rings = GeometryMapper.ToRings(document.Geometry);
        return new PolygonDto(
            RequireId(document),
            document.Properties.Name,
            document.Properties.LayerId,
            document.Properties.CreatedBy,
            document.Properties.Color,
            document.Properties.Shape ?? PolygonShape.Polygon,
            document.Properties.RadiusMeters,
            rings,
            CenterCalculator.OfRing(rings[0]),
            document.Version,
            document.CreatedAt,
            document.UpdatedAt);
    }

    private static string RequireId(FeatureDocument document) =>
        document.Id ?? throw new InvalidOperationException("A stored feature must have an id.");
}
