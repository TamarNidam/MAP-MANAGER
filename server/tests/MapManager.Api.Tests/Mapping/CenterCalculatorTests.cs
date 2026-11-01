using MapManager.Api.Mapping;

namespace MapManager.Api.Tests.Mapping;

public sealed class CenterCalculatorTests
{
    [Fact]
    public void Square_centroid_is_its_center()
    {
        var ring = new[]
        {
            new[] { 0d, 0d }, new[] { 4d, 0d }, new[] { 4d, 4d }, new[] { 0d, 4d }, new[] { 0d, 0d }
        };

        var center = CenterCalculator.OfRing(ring);

        Assert.Equal(2, center.Lat, 9);
        Assert.Equal(2, center.Lon, 9);
    }

    [Fact]
    public void L_shape_centroid_is_area_weighted()
    {
        var ring = new[]
        {
            new[] { 34d, 32d }, new[] { 36d, 32d }, new[] { 36d, 33d }, new[] { 35d, 33d },
            new[] { 35d, 34d }, new[] { 34d, 34d }, new[] { 34d, 32d }
        };

        var center = CenterCalculator.OfRing(ring);

        Assert.Equal(32 + 5d / 6, center.Lat, 9);
        Assert.Equal(34 + 5d / 6, center.Lon, 9);
    }

    [Fact]
    public void Zero_area_ring_uses_mean_of_non_closing_vertices()
    {
        var ring = new[]
        {
            new[] { 0d, 0d }, new[] { 2d, 0d }, new[] { 1d, 0d }, new[] { 0d, 0d }
        };

        var center = CenterCalculator.OfRing(ring);

        Assert.Equal(0, center.Lat, 9);
        Assert.Equal(1, center.Lon, 9);
    }
}
