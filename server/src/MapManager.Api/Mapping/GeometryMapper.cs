using MapManager.Api.Models;
using MongoDB.Driver.GeoJsonObjectModel;

namespace MapManager.Api.Mapping;

/// <summary>
/// Converts between plain coordinate arrays used by the DTOs and the MongoDB driver's GeoJSON types.
/// Both sides use GeoJSON order: [longitude, latitude]. Input is expected to be validated already.
/// </summary>
public static class GeometryMapper
{
    private const double MaxSearchLatitude = 89.9999;

    private const double MaxSearchColumnDegrees = 90;

    /// <summary>Builds a Point from a [longitude, latitude] position.</summary>
    public static GeoJsonPoint<GeoJson2DGeographicCoordinates> ToPoint(double[] position) =>
        new(ToCoordinates(position));

    /// <summary>Builds a Polygon from rings of positions. The first ring is the exterior, the rest are holes.</summary>
    public static GeoJsonPolygon<GeoJson2DGeographicCoordinates> ToPolygon(double[][][] rings)
    {
        var exterior = ToRing(rings[0]);
        var holes = rings.Skip(1).Select(ToRing);
        return new GeoJsonPolygon<GeoJson2DGeographicCoordinates>(
            new GeoJsonPolygonCoordinates<GeoJson2DGeographicCoordinates>(exterior, holes));
    }

    /// <summary>
    /// Builds the area to search for a bounding box. Wide boxes are split into columns, because a single polygon
    /// spanning 180 degrees or more has no unambiguous edges on a sphere. The poles are left out, because at a pole
    /// all corners of a box collapse into one point.
    /// </summary>
    public static GeoJsonMultiPolygon<GeoJson2DGeographicCoordinates> ToSearchArea(BoundingBox box)
    {
        var minLat = Math.Max(box.MinLat, -MaxSearchLatitude);
        var maxLat = Math.Min(box.MaxLat, MaxSearchLatitude);
        var columns = (int)Math.Ceiling((box.MaxLon - box.MinLon) / MaxSearchColumnDegrees);
        var width = (box.MaxLon - box.MinLon) / columns;

        var polygons = Enumerable.Range(0, columns).Select(i =>
        {
            var west = box.MinLon + (i * width);
            var east = i == columns - 1 ? box.MaxLon : west + width;
            var ring = new[]
            {
                new[] { west, minLat },
                new[] { east, minLat },
                new[] { east, maxLat },
                new[] { west, maxLat },
                new[] { west, minLat }
            };
            return ToPolygon(new[] { ring }).Coordinates;
        });

        return new GeoJsonMultiPolygon<GeoJson2DGeographicCoordinates>(
            new GeoJsonMultiPolygonCoordinates<GeoJson2DGeographicCoordinates>(polygons));
    }

    /// <summary>Returns a geometry as a Polygon.</summary>
    /// <exception cref="InvalidOperationException">The geometry is not a Polygon.</exception>
    public static GeoJsonPolygon<GeoJson2DGeographicCoordinates> AsPolygon(GeoJsonGeometry<GeoJson2DGeographicCoordinates> geometry) =>
        geometry as GeoJsonPolygon<GeoJson2DGeographicCoordinates>
            ?? throw new InvalidOperationException($"Expected a Polygon geometry but found {geometry.Type}.");

    /// <summary>Returns the [longitude, latitude] position of a Point geometry.</summary>
    /// <exception cref="InvalidOperationException">The geometry is not a Point.</exception>
    public static double[] ToPosition(GeoJsonGeometry<GeoJson2DGeographicCoordinates> geometry)
    {
        if (geometry is not GeoJsonPoint<GeoJson2DGeographicCoordinates> point)
        {
            throw new InvalidOperationException($"Expected a Point geometry but found {geometry.Type}.");
        }

        return ToPosition(point.Coordinates);
    }

    /// <summary>Returns the rings of a Polygon geometry, exterior ring first.</summary>
    /// <exception cref="InvalidOperationException">The geometry is not a Polygon.</exception>
    public static double[][][] ToRings(GeoJsonGeometry<GeoJson2DGeographicCoordinates> geometry)
    {
        var polygon = AsPolygon(geometry);

        return new[] { polygon.Coordinates.Exterior }
            .Concat(polygon.Coordinates.Holes)
            .Select(ring => ring.Positions.Select(ToPosition).ToArray())
            .ToArray();
    }

    private static GeoJsonLinearRingCoordinates<GeoJson2DGeographicCoordinates> ToRing(double[][] positions) =>
        new(positions.Select(ToCoordinates));

    private static GeoJson2DGeographicCoordinates ToCoordinates(double[] position) =>
        new(longitude: position[0], latitude: position[1]);

    private static double[] ToPosition(GeoJson2DGeographicCoordinates coordinates) =>
        new[] { coordinates.Longitude, coordinates.Latitude };
}
