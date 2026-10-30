using System.ComponentModel.DataAnnotations;
using MapManager.Api.Validation;

namespace MapManager.Api.Dtos;

/// <summary>Batch body for POST /api/objects.</summary>
public sealed class CreateMapObjectsRequest
{
    /// <summary>The objects to create, in order. Each item is validated on its own.</summary>
    [Required]
    [MinLength(1)]
    [MaxLength(ValidationLimits.MaxBatchSize)]
    public IReadOnlyList<CreateMapObjectRequest> Items { get; init; } = Array.Empty<CreateMapObjectRequest>();
}
