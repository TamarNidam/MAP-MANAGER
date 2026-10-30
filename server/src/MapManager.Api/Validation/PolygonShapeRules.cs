using System.ComponentModel.DataAnnotations;
using MapManager.Api.Models;

namespace MapManager.Api.Validation;

/// <summary>Cross-field rule shared by the polygon create and update requests.</summary>
public static class PolygonShapeRules
{
    /// <summary>A radius is only accepted on a circle. A missing shape counts as a plain polygon.</summary>
    public static IEnumerable<ValidationResult> Validate(PolygonShape? shape, double? radiusMeters)
    {
        if (radiusMeters is not null && shape != PolygonShape.Circle)
        {
            yield return new ValidationResult("Only a circle can have a radius.", new[] { "radiusMeters" });
        }
    }
}
