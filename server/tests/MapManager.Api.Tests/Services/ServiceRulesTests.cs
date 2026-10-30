using MapManager.Api.Dtos;
using MapManager.Api.Errors;
using MapManager.Api.Models;
using MapManager.Api.Services;
using MapManager.Api.Tests.Fakes;

namespace MapManager.Api.Tests.Services;

public sealed class ServiceRulesTests
{
    private readonly InMemoryFeatureRepository _features = new();
    private readonly InMemoryLayerRepository _layers = TestData.Layers();
    private readonly FixedTimeProvider _clock = new(new DateTimeOffset(2026, 10, 30, 12, 0, 0, TimeSpan.Zero));
    private readonly MapObjectService _objects;
    private readonly PolygonService _polygons;
    private readonly LayerService _layerService;

    public ServiceRulesTests()
    {
        var layerReferences = new LayerReferenceValidator(_layers);
        _objects = new MapObjectService(_features, layerReferences, _clock);
        _polygons = new PolygonService(_features, layerReferences, _clock);
        _layerService = new LayerService(_layers, _features, _clock);
    }

    [Fact]
    public async Task Unknown_layer_is_rejected_and_nothing_is_stored()
    {
        var unknownLayer = new CreateMapObjectRequest
        {
            Name = "Lost",
            ObjectType = ObjectType.Marker,
            LayerId = "65a1b2c3d4e5f6a7b8c9d0ff",
            CreatedBy = "tamar",
            Coordinates = TestData.Point()
        };

        var error = await Assert.ThrowsAsync<RequestValidationException>(() =>
            _objects.CreateManyAsync(new[] { TestData.CreateObject(), unknownLayer }, CancellationToken.None));

        Assert.Equal(new[] { "items[1].layerId" }, error.Errors.Keys);
        Assert.Empty(_features.All);
    }

    [Fact]
    public async Task Layer_with_features_cannot_be_deleted()
    {
        var onOtherLayer = new CreateMapObjectRequest
        {
            Name = "Jeep",
            ObjectType = ObjectType.Jeep,
            LayerId = TestData.OtherLayerId,
            CreatedBy = "tamar",
            Coordinates = TestData.Point()
        };
        await _objects.CreateManyAsync(new[] { onOtherLayer }, CancellationToken.None);

        await Assert.ThrowsAsync<ConflictException>(() => _layerService.DeleteAsync(TestData.OtherLayerId, CancellationToken.None));
    }

    [Fact]
    public async Task Default_layer_cannot_be_deleted()
    {
        await Assert.ThrowsAsync<ConflictException>(() => _layerService.DeleteAsync(TestData.LayerId, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAll_removes_polygons_and_keeps_objects()
    {
        await _objects.CreateManyAsync(new[] { TestData.CreateObject() }, CancellationToken.None);
        await _polygons.CreateManyAsync(new[] { TestData.CreatePolygon(), TestData.CreatePolygon() }, CancellationToken.None);

        var deleted = await _polygons.DeleteAllAsync(CancellationToken.None);

        Assert.Equal(2, deleted);
        Assert.Equal(FeatureKind.Object, Assert.Single(_features.All).Properties.Kind);
    }
}
