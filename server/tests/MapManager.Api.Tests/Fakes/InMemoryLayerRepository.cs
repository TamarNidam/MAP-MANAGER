using MapManager.Api.Errors;
using MapManager.Api.Models;
using MapManager.Api.Repositories;

namespace MapManager.Api.Tests.Fakes;

/// <summary>
/// In-memory <see cref="ILayerRepository"/> for tests. Like the MongoDB repository it compares names ignoring
/// case, rejects duplicate names with <see cref="ConflictException"/>, and treats unknown ids as "not found".
/// </summary>
public sealed class InMemoryLayerRepository : ILayerRepository
{
    private readonly Dictionary<string, LayerDocument> _layers = new(StringComparer.OrdinalIgnoreCase);
    private int _nextId = 1;

    /// <summary>Adds a layer with a known id, for test setup.</summary>
    public LayerDocument Add(string id, string name, bool isDefault = false)
    {
        var layer = new LayerDocument { Id = id, Name = name, Color = "#000000", IsDefault = isDefault };
        _layers[id] = layer;
        return layer;
    }

    public Task<IReadOnlyList<LayerDocument>> ListAsync(CancellationToken cancellationToken)
    {
        IReadOnlyList<LayerDocument> result = _layers.Values
            .OrderByDescending(l => l.IsDefault)
            .ThenBy(l => l.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
        return Task.FromResult(result);
    }

    public Task<LayerDocument?> GetByIdAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(_layers.GetValueOrDefault(id));

    public Task<IReadOnlySet<string>> FindExistingIdsAsync(IReadOnlyCollection<string> ids, CancellationToken cancellationToken)
    {
        IReadOnlySet<string> result = ids.Where(_layers.ContainsKey).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return Task.FromResult(result);
    }

    public Task<bool> NameExistsAsync(string name, string? excludeId, CancellationToken cancellationToken) =>
        Task.FromResult(_layers.Values.Any(l => SameName(l.Name, name) && !string.Equals(l.Id, excludeId, StringComparison.OrdinalIgnoreCase)));

    public Task InsertAsync(LayerDocument layer, CancellationToken cancellationToken)
    {
        if (_layers.Values.Any(l => SameName(l.Name, layer.Name)))
        {
            throw new ConflictException("A layer with this name already exists.");
        }

        layer.Id = (_nextId++).ToString("x24");
        _layers[layer.Id] = layer;
        return Task.CompletedTask;
    }

    public Task<LayerDocument?> UpdateAsync(string id, LayerUpdate update, CancellationToken cancellationToken)
    {
        if (!_layers.TryGetValue(id, out var layer))
        {
            return Task.FromResult<LayerDocument?>(null);
        }

        layer.Name = update.Name;
        layer.Color = update.Color;
        layer.UpdatedAt = update.UpdatedAt;
        return Task.FromResult<LayerDocument?>(layer);
    }

    public Task<bool> DeleteAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(_layers.Remove(id));

    public Task EnsureDefaultAsync(LayerDocument defaultLayer, CancellationToken cancellationToken)
    {
        if (!_layers.Values.Any(l => l.IsDefault))
        {
            defaultLayer.Id = (_nextId++).ToString("x24");
            _layers[defaultLayer.Id] = defaultLayer;
        }

        return Task.CompletedTask;
    }

    private static bool SameName(string a, string b) => string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
}
