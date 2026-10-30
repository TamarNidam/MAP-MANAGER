using MapManager.Api.Dtos;

namespace MapManager.Api.Mapping;

/// <summary>
/// Computes the center returned with every feature. The center is derived on each read and never stored.
/// Positions are GeoJSON [longitude, latitude]; the math is planar on degrees, which is accurate enough
/// for placing a label or centering the map on shapes of normal size.
/// </summary>
public static class CenterCalculator
{
    /// <summary>Below this area (in square degrees) a ring is treated as degenerate.</summary>
    private const double MinArea = 1e-12;

    /// <summary>The center of a point is the point itself.</summary>
    public static GeoPointDto OfPosition(double[] position) => new(Lat: position[1], Lon: position[0]);

    /// <summary>
    /// Returns the area-weighted centroid of a closed ring. When the ring has (almost) no area,
    /// the mean of its vertices is returned instead.
    /// </summary>
    public static GeoPointDto OfRing(double[][] ring)
    {
        // The last position repeats the first one, so it is not a separate vertex.
        var vertexCount = ring.Length - 1;

        // Coordinates are taken relative to the first vertex to reduce floating-point error.
        var originLon = ring[0][0];
        var originLat = ring[0][1];

        double twiceArea = 0, lonSum = 0, latSum = 0;
        for (var i = 0; i < vertexCount; i++)
        {
            var x1 = ring[i][0] - originLon;
            var y1 = ring[i][1] - originLat;
            var x2 = ring[i + 1][0] - originLon;
            var y2 = ring[i + 1][1] - originLat;

            var cross = x1 * y2 - x2 * y1;
            twiceArea += cross;
            lonSum += (x1 + x2) * cross;
            latSum += (y1 + y2) * cross;
        }

        if (Math.Abs(twiceArea / 2) < MinArea)
        {
            var vertices = ring.Take(vertexCount).ToList();
            return new GeoPointDto(Lat: vertices.Average(p => p[1]), Lon: vertices.Average(p => p[0]));
        }

        return new GeoPointDto(
            Lat: originLat + latSum / (3 * twiceArea),
            Lon: originLon + lonSum / (3 * twiceArea));
    }
}
