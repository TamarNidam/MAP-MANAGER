using MapManager.Api.Dtos;

namespace MapManager.Api.Services;

/// <summary>Use cases for layers.</summary>
public interface ILayerService
{
    /// <summary>Returns every layer: the default layer first, then by name.</summary>
    Task<IReadOnlyList<LayerDto>> ListAsync(CancellationToken cancellationToken);

    /// <summary>Creates a layer.</summary>
    /// <exception cref="Errors.ConflictException">Another layer has the same name (ignoring case).</exception>
    Task<LayerDto> CreateAsync(LayerRequest request, CancellationToken cancellationToken);

    /// <summary>Renames or recolors a layer. Returns null when it does not exist.</summary>
    /// <exception cref="Errors.ConflictException">Another layer has the same name (ignoring case).</exception>
    Task<LayerDto?> UpdateAsync(string id, LayerRequest request, CancellationToken cancellationToken);

    /// <summary>Deletes a layer. Returns false when it does not exist.</summary>
    /// <exception cref="Errors.ConflictException">The layer is the default layer, or it still has features.</exception>
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken);
}
