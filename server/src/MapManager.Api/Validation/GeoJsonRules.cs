namespace MapManager.Api.Validation;

/// <summary>
/// Validation rules for GeoJSON coordinates. Each method returns an error message, or null when the input is valid.
/// Positions are in GeoJSON order: [longitude, latitude].
/// </summary>
public static class GeoJsonRules
{
    /// <summary>Checks a single position: exactly two finite numbers within longitude and latitude ranges.</summary>
    public static string? ValidatePosition(double[]? position)
    {
        if (position is null || position.Length != 2)
        {
            return "A position must have exactly two numbers: [longitude, latitude].";
        }

        // Written as negated range checks so that NaN (which fails every comparison) is rejected too.
        if (!(position[0] >= -180 && position[0] <= 180))
        {
            return "Longitude must be between -180 and 180.";
        }

        if (!(position[1] >= -90 && position[1] <= 90))
        {
            return "Latitude must be between -90 and 90.";
        }

        return null;
    }

    /// <summary>
    /// Checks polygon rings: 1 to <see cref="ValidationLimits.MaxPolygonRings"/> rings, each closed and with at least
    /// <see cref="ValidationLimits.MinRingPositions"/> valid positions, and at most
    /// <see cref="ValidationLimits.MaxPolygonPositions"/> positions in total.
    /// The first ring is the exterior ring and the others are holes. Rings must not cross or touch themselves
    /// or each other (see <see cref="PolygonTopology"/>). Whether a hole lies inside the exterior ring is
    /// left to MongoDB's 2dsphere index on write.
    /// </summary>
    public static string? ValidatePolygon(double[][][]? rings)
    {
        if (rings is null || rings.Length == 0)
        {
            return "A polygon must have at least one ring.";
        }

        if (rings.Length > ValidationLimits.MaxPolygonRings)
        {
            return $"A polygon can have at most {ValidationLimits.MaxPolygonRings} rings.";
        }

        if (rings.Sum(ring => ring?.Length ?? 0) > ValidationLimits.MaxPolygonPositions)
        {
            return $"A polygon can have at most {ValidationLimits.MaxPolygonPositions} positions across all rings.";
        }

        for (var r = 0; r < rings.Length; r++)
        {
            var error = ValidateRing(rings[r]);
            if (error is not null)
            {
                return $"Ring {r}: {error}";
            }
        }

        return PolygonTopology.FindProblem(rings);
    }

    private static string? ValidateRing(double[][]? ring)
    {
        if (ring is null || ring.Length < ValidationLimits.MinRingPositions)
        {
            return $"A ring must have at least {ValidationLimits.MinRingPositions} positions.";
        }

        for (var p = 0; p < ring.Length; p++)
        {
            var error = ValidatePosition(ring[p]);
            if (error is not null)
            {
                return $"Position {p}: {error}";
            }
        }

        var first = ring[0];
        var last = ring[^1];
        if (first[0] != last[0] || first[1] != last[1])
        {
            return "A ring must be closed: the first and last positions must be equal.";
        }

        return null;
    }
}
