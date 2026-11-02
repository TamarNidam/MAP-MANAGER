using MapManager.Api.Dtos;
using MapManager.Api.Mapping;
using MapManager.Api.Models;
using MapManager.Api.Repositories;

namespace MapManager.Api.Services;

/// <summary>Default implementation of <see cref="IPolygonService"/>.</summary>
public sealed class PolygonService : IPolygonService
{
    private readonly IFeatureRepository _repository;
    private readonly LayerReferenceValidator _layerReferences;
    private readonly TimeProvider _timeProvider;

    public PolygonService(IFeatureRepository repository, LayerReferenceValidator layerReferences, TimeProvider timeProvider)
    {
        _repository = repository;
        _layerReferences = layerReferences;
        _timeProvider = timeProvider;
    }

    public async Task<IReadOnlyList<PolygonDto>> CreateManyAsync(
        IReadOnlyList<CreatePolygonRequest> requests,
        CancellationToken cancellationToken)
    {
        var references = requests.Select((r, i) => ($"items[{i}].layerId", r.LayerId)).ToList();
        await _layerReferences.EnsureExistAsync(references, cancellationToken);

        // One timestamp for the whole batch: the items were saved together.
        var now = _timeProvider.GetStorageUtcNow();
        var documents = requests.Select(r => FeatureMapper.ToDocument(r, now)).ToList();

        var stored = await _repository.InsertManyAsync(documents, cancellationToken);
        return stored.Select(FeatureMapper.ToPolygonDto).ToList();
    }

    public async Task<IReadOnlyList<PolygonDto>> ListAsync(int limit, CancellationToken cancellationToken)
    {
        var documents = await _repository.ListAsync(FeatureKind.Polygon, limit, cancellationToken);
        return documents.Select(FeatureMapper.ToPolygonDto).ToList();
    }

    public async Task<PolygonDto?> GetByIdAsync(string id, CancellationToken cancellationToken)
    {
        var document = await _repository.GetByIdAsync(id, FeatureKind.Polygon, cancellationToken);
        return document is null ? null : FeatureMapper.ToPolygonDto(document);
    }

    public async Task<PolygonDto?> UpdateAsync(string id, UpdatePolygonRequest request, CancellationToken cancellationToken)
    {
        await _layerReferences.EnsureExistAsync(new[] { ("layerId", request.LayerId) }, cancellationToken);

        var update = FeatureMapper.ToUpdate(request, _timeProvider.GetStorageUtcNow());
        var document = await _repository.UpdateAsync(id, FeatureKind.Polygon, update, cancellationToken);
        return document is null ? null : FeatureMapper.ToPolygonDto(document);
    }

    public Task<bool> DeleteAsync(string id, CancellationToken cancellationToken) =>
        _repository.DeleteAsync(id, FeatureKind.Polygon, cancellationToken);

    public Task<long> DeleteAllAsync(CancellationToken cancellationToken) =>
        _repository.DeleteAllAsync(FeatureKind.Polygon, cancellationToken);
}
