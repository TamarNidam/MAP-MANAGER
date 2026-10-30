using MapManager.Api.Dtos;
using MapManager.Api.Errors;
using MapManager.Api.Mapping;
using MapManager.Api.Repositories;

namespace MapManager.Api.Services;

/// <summary>Default implementation of <see cref="ILayerService"/>.</summary>
public sealed class LayerService : ILayerService
{
    private readonly ILayerRepository _layers;
    private readonly IFeatureRepository _features;
    private readonly TimeProvider _timeProvider;

    public LayerService(ILayerRepository layers, IFeatureRepository features, TimeProvider timeProvider)
    {
        _layers = layers;
        _features = features;
        _timeProvider = timeProvider;
    }

    public async Task<IReadOnlyList<LayerDto>> ListAsync(CancellationToken cancellationToken)
    {
        var layers = await _layers.ListAsync(cancellationToken);
        return layers.Select(LayerMapper.ToDto).ToList();
    }

    public async Task<LayerDto> CreateAsync(LayerRequest request, CancellationToken cancellationToken)
    {
        var document = LayerMapper.ToDocument(request, _timeProvider.GetStorageUtcNow());
        await EnsureNameIsFreeAsync(document.Name, excludeId: null, cancellationToken);

        await _layers.InsertAsync(document, cancellationToken);
        return LayerMapper.ToDto(document);
    }

    public async Task<LayerDto?> UpdateAsync(string id, LayerRequest request, CancellationToken cancellationToken)
    {
        var update = LayerMapper.ToUpdate(request, _timeProvider.GetStorageUtcNow());
        await EnsureNameIsFreeAsync(update.Name, excludeId: id, cancellationToken);

        var document = await _layers.UpdateAsync(id, update, cancellationToken);
        return document is null ? null : LayerMapper.ToDto(document);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken)
    {
        var layer = await _layers.GetByIdAsync(id, cancellationToken);
        if (layer is null)
        {
            return false;
        }

        if (layer.IsDefault)
        {
            throw new ConflictException("The default layer cannot be deleted.");
        }

        // Checked before deleting; a feature added to the layer at the same moment is not detected (no transactions).
        if (await _features.AnyInLayerAsync(id, cancellationToken))
        {
            throw new ConflictException("The layer still has features. Move or delete them first.");
        }

        return await _layers.DeleteAsync(id, cancellationToken);
    }

    private async Task EnsureNameIsFreeAsync(string name, string? excludeId, CancellationToken cancellationToken)
    {
        // Gives a clear 409 in the normal case. The unique index still protects against two concurrent requests.
        if (await _layers.NameExistsAsync(name, excludeId, cancellationToken))
        {
            throw new ConflictException($"A layer named '{name}' already exists.");
        }
    }
}
