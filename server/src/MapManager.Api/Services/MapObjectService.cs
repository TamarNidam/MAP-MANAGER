using MapManager.Api.Dtos;
using MapManager.Api.Mapping;
using MapManager.Api.Models;
using MapManager.Api.Repositories;

namespace MapManager.Api.Services;

/// <summary>Default implementation of <see cref="IMapObjectService"/>.</summary>
public sealed class MapObjectService : IMapObjectService
{
    private readonly IFeatureRepository _repository;
    private readonly LayerReferenceValidator _layerReferences;
    private readonly TimeProvider _timeProvider;

    public MapObjectService(IFeatureRepository repository, LayerReferenceValidator layerReferences, TimeProvider timeProvider)
    {
        _repository = repository;
        _layerReferences = layerReferences;
        _timeProvider = timeProvider;
    }

    public async Task<IReadOnlyList<MapObjectDto>> CreateManyAsync(
        IReadOnlyList<CreateMapObjectRequest> requests,
        CancellationToken cancellationToken)
    {
        var references = requests.Select((r, i) => ($"items[{i}].layerId", r.LayerId)).ToList();
        await _layerReferences.EnsureExistAsync(references, cancellationToken);

        // One timestamp for the whole batch: the items were saved together.
        var now = _timeProvider.GetStorageUtcNow();
        var documents = requests.Select(r => FeatureMapper.ToDocument(r, now)).ToList();

        var stored = await _repository.InsertManyAsync(documents, cancellationToken);
        return stored.Select(FeatureMapper.ToMapObjectDto).ToList();
    }

    public async Task<IReadOnlyList<MapObjectDto>> ListAsync(int limit, CancellationToken cancellationToken)
    {
        var documents = await _repository.ListAsync(FeatureKind.Object, limit, cancellationToken);
        return documents.Select(FeatureMapper.ToMapObjectDto).ToList();
    }

    public async Task<MapObjectDto?> GetByIdAsync(string id, CancellationToken cancellationToken)
    {
        var document = await _repository.GetByIdAsync(id, FeatureKind.Object, cancellationToken);
        return document is null ? null : FeatureMapper.ToMapObjectDto(document);
    }

    public async Task<MapObjectDto?> UpdateAsync(string id, UpdateMapObjectRequest request, CancellationToken cancellationToken)
    {
        await _layerReferences.EnsureExistAsync(new[] { ("layerId", request.LayerId) }, cancellationToken);

        var update = FeatureMapper.ToUpdate(request, _timeProvider.GetStorageUtcNow());
        var document = await _repository.UpdateAsync(id, FeatureKind.Object, update, cancellationToken);
        return document is null ? null : FeatureMapper.ToMapObjectDto(document);
    }

    public Task<bool> DeleteAsync(string id, CancellationToken cancellationToken) =>
        _repository.DeleteAsync(id, FeatureKind.Object, cancellationToken);
}
