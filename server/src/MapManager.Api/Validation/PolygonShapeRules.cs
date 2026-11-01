using System.ComponentModel.DataAnnotations;
using MapManager.Api.Models;

namespace MapManager.Api.Validation;

/// <summary>Cross-field rule shared by the polygon create and update requests.</summary>
public static class PolygonShapeRules
{
    /// <summary>
    /// A circle requires a radius, and only a circle can have one. A missing shape counts as a plain polygon.
    /// The request's [Range] attribute rejects a radius that is zero or negative.
    /// </summary>
    public static IEnumerable<ValidationResult> Validate(PolygonShape? shape, double? radiusMeters)
    {
        if (radiusMeters is null && shape == PolygonShape.Circle)
        {
            yield return new ValidationResult("A circle requires a radius greater than 0.", new[] { "radiusMeters" });
        }

        if (radiusMeters is not null && shape != PolygonShape.Circle)
        {
            yield return new ValidationResult("Only a circle can have a radius.", new[] { "radiusMeters" });
        }
    }
}
