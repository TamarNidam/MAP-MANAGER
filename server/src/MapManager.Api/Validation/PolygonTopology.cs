// One edge of a ring, from position Index to the next one.
using Edge = (int Ring, int Index, double[] Start, double[] End);

namespace MapManager.Api.Validation;

/// <summary>
/// Checks that polygon rings are simple: no ring crosses or touches itself, and no two rings cross or touch.
/// The check is planar on [longitude, latitude] degrees and runs before anything is written. MongoDB's 2dsphere
/// index (which uses geodesic edges) remains a fallback for rare edge cases this check does not catch.
/// Rings are expected to be closed and to contain valid positions already.
/// </summary>
public static class PolygonTopology
{
    /// <summary>Returns a description of the first topology problem found, or null when the rings are simple.</summary>
    public static string? FindProblem(double[][][] rings)
    {
        for (var r = 0; r < rings.Length; r++)
        {
            var ring = rings[r];
            for (var i = 0; i < ring.Length - 1; i++)
            {
                if (SamePoint(ring[i], ring[i + 1]))
                {
                    return $"Ring {r}: positions {i} and {i + 1} are the same point.";
                }
            }
        }

        var edges = rings
            .SelectMany((ring, r) => Enumerable.Range(0, ring.Length - 1).Select(i => (Edge)(r, i, ring[i], ring[i + 1])))
            .ToList();

        for (var e = 0; e < edges.Count; e++)
        {
            for (var f = e + 1; f < edges.Count; f++)
            {
                var problem = Check(edges[e], edges[f], rings);
                if (problem is not null)
                {
                    return problem;
                }
            }
        }

        return null;
    }

    private static string? Check(Edge first, Edge second, double[][][] rings)
    {
        if (first.Ring != second.Ring)
        {
            return SegmentsIntersect(first, second)
                ? $"Rings {first.Ring} and {second.Ring} cross or touch (edges {first.Index} and {second.Index})."
                : null;
        }

        var edgeCount = rings[first.Ring].Length - 1;
        if (!AreAdjacent(first.Index, second.Index, edgeCount))
        {
            return SegmentsIntersect(first, second)
                ? $"Ring {first.Ring} crosses or touches itself (edges {first.Index} and {second.Index})."
                : null;
        }

        // Adjacent edges share one vertex. They are only invalid when they fold back over each other.
        return FoldsBack(first, second)
            ? $"Ring {first.Ring} folds back on itself (edges {first.Index} and {second.Index})."
            : null;
    }

    /// <summary>Edges i &lt; j of one ring are adjacent when they follow each other, including last-to-first.</summary>
    private static bool AreAdjacent(int i, int j, int edgeCount) => j == i + 1 || (i == 0 && j == edgeCount - 1);

    private static bool FoldsBack(Edge first, Edge second)
    {
        // Find the shared vertex and the two outer ends.
        double[] shared, a, b;
        if (SamePoint(first.End, second.Start))
        {
            (shared, a, b) = (first.End, first.Start, second.End);
        }
        else
        {
            (shared, a, b) = (first.Start, first.End, second.Start);
        }

        // Collinear and pointing the same way from the shared vertex: the edges overlap.
        return Cross(shared, a, b) == 0 && Dot(shared, a, b) > 0;
    }

    private static bool SegmentsIntersect(Edge p, Edge q)
    {
        // Cheap bounding-box rejection first.
        if (Math.Max(p.Start[0], p.End[0]) < Math.Min(q.Start[0], q.End[0])
            || Math.Max(q.Start[0], q.End[0]) < Math.Min(p.Start[0], p.End[0])
            || Math.Max(p.Start[1], p.End[1]) < Math.Min(q.Start[1], q.End[1])
            || Math.Max(q.Start[1], q.End[1]) < Math.Min(p.Start[1], p.End[1]))
        {
            return false;
        }

        var d1 = Math.Sign(Cross(p.Start, p.End, q.Start));
        var d2 = Math.Sign(Cross(p.Start, p.End, q.End));
        var d3 = Math.Sign(Cross(q.Start, q.End, p.Start));
        var d4 = Math.Sign(Cross(q.Start, q.End, p.End));

        if (d1 * d2 < 0 && d3 * d4 < 0)
        {
            return true;
        }

        // Touching or collinear overlap: an endpoint lies on the other segment.
        return (d1 == 0 && OnSegment(p.Start, p.End, q.Start))
            || (d2 == 0 && OnSegment(p.Start, p.End, q.End))
            || (d3 == 0 && OnSegment(q.Start, q.End, p.Start))
            || (d4 == 0 && OnSegment(q.Start, q.End, p.End));
    }

    /// <summary>Cross product of (a - origin) and (b - origin). Zero means the three points are collinear.</summary>
    private static double Cross(double[] origin, double[] a, double[] b) =>
        (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);

    private static double Dot(double[] origin, double[] a, double[] b) =>
        (a[0] - origin[0]) * (b[0] - origin[0]) + (a[1] - origin[1]) * (b[1] - origin[1]);

    /// <summary>For a point known to be collinear with the segment, checks that it lies within the segment.</summary>
    private static bool OnSegment(double[] start, double[] end, double[] point) =>
        point[0] >= Math.Min(start[0], end[0]) && point[0] <= Math.Max(start[0], end[0])
        && point[1] >= Math.Min(start[1], end[1]) && point[1] <= Math.Max(start[1], end[1]);

    private static bool SamePoint(double[] a, double[] b) => a[0] == b[0] && a[1] == b[1];
}
