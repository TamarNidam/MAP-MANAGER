using MapManager.Api.Errors;
using MapManager.Api.Repositories;

namespace MapManager.Api.Services;

/// <summary>Checks that the layer ids referenced by objects and polygons belong to existing layers.</summary>
public sealed class LayerReferenceValidator
{
    private readonly ILayerRepository _layers;

    public LayerReferenceValidator(ILayerRepository layers)
    {
        _layers = layers;
    }

    /// <summary>
    /// Throws when any referenced layer does not exist, with one error per field, for example "items[2].layerId".
    /// All references are checked with a single query.
    /// </summary>
    /// <param name="references">The request field path of each reference, and the layer id it holds.</param>
    /// <param name="cancellationToken">Cancels the check.</param>
    /// <exception cref="RequestValidationException">At least one layer does not exist.</exception>
    public async Task EnsureExistAsync(
        IReadOnlyList<(string Field, string LayerId)> references,
        CancellationToken cancellationToken)
    {
        var ids = references.Select(r => r.LayerId).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var existing = await _layers.FindExistingIdsAsync(ids, cancellationToken);

        var errors = references
            .Where(r => !existing.Contains(r.LayerId))
            .ToDictionary(r => r.Field, r => new[] { $"Layer '{r.LayerId}' does not exist." });

        if (errors.Count > 0)
        {
            throw new RequestValidationException(errors);
        }
    }
}
