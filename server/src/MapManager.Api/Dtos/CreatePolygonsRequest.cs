using System.ComponentModel.DataAnnotations;
using MapManager.Api.Validation;

namespace MapManager.Api.Dtos;

/// <summary>Batch body for POST /api/polygons.</summary>
public sealed class CreatePolygonsRequest
{
    /// <summary>The polygons to create, in order. Each item is validated on its own.</summary>
    [Required]
    [MinLength(1)]
    [MaxLength(ValidationLimits.MaxBatchSize)]
    public IReadOnlyList<CreatePolygonRequest> Items { get; init; } = Array.Empty<CreatePolygonRequest>();
}
