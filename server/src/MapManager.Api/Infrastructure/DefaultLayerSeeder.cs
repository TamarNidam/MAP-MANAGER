using MapManager.Api.Models;
using MapManager.Api.Repositories;
using MapManager.Api.Services;

namespace MapManager.Api.Infrastructure;

/// <summary>
/// Makes sure the default layer exists. Runs at startup after <see cref="MongoIndexInitializer"/>, and is
/// idempotent: restarting the API never creates a second default layer.
/// </summary>
public sealed class DefaultLayerSeeder : IHostedService
{
    private readonly ILayerRepository _layers;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<DefaultLayerSeeder> _logger;

    public DefaultLayerSeeder(ILayerRepository layers, TimeProvider timeProvider, ILogger<DefaultLayerSeeder> logger)
    {
        _layers = layers;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var now = _timeProvider.GetStorageUtcNow();
        await _layers.EnsureDefaultAsync(
            new LayerDocument
            {
                Name = DefaultLayer.Name,
                Color = DefaultLayer.Color,
                IsDefault = true,
                CreatedAt = now,
                UpdatedAt = now
            },
            cancellationToken);
        _logger.LogInformation("The default layer is in place.");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
