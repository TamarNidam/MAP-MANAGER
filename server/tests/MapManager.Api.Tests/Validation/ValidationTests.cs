using System.ComponentModel.DataAnnotations;
using MapManager.Api.Dtos;
using MapManager.Api.Validation;

namespace MapManager.Api.Tests.Validation;

public sealed class ValidationTests
{
    [Fact]
    public void Open_ring_is_rejected()
    {
        var rings = TestData.Square();
        rings[0][^1] = new[] { 34.0, 32.5 };

        Assert.Contains("closed", GeoJsonRules.ValidatePolygon(rings));
    }

    [Fact]
    public void Ring_with_fewer_than_four_positions_is_rejected()
    {
        var rings = new[] { new[] { new[] { 34.0, 32.0 }, new[] { 35.0, 32.0 }, new[] { 34.0, 32.0 } } };

        Assert.Contains("at least 4", GeoJsonRules.ValidatePolygon(rings));
    }

    [Theory]
    [InlineData(180.1, 32.0)]
    [InlineData(34.0, -90.1)]
    public void Position_out_of_range_is_rejected(double lon, double lat)
    {
        Assert.NotNull(GeoJsonRules.ValidatePosition(new[] { lon, lat }));
    }

    [Fact]
    public void Self_intersecting_polygon_is_rejected()
    {
        var bowTie = new[] { new[] { new[] { 0.0, 0.0 }, new[] { 1.0, 1.0 }, new[] { 1.0, 0.0 }, new[] { 0.0, 1.0 }, new[] { 0.0, 0.0 } } };

        Assert.Contains("crosses", GeoJsonRules.ValidatePolygon(bowTie));
    }

    [Fact]
    public void Batch_over_the_limit_is_rejected()
    {
        var request = new CreateMapObjectsRequest
        {
            Items = Enumerable.Range(0, ValidationLimits.MaxBatchSize + 1).Select(_ => TestData.CreateObject()).ToList()
        };

        Assert.False(Validator.TryValidateObject(request, new ValidationContext(request), null, validateAllProperties: true));
    }
}
