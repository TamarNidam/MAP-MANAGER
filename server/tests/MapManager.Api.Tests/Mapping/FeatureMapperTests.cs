using MapManager.Api.Mapping;
using MongoDB.Driver.GeoJsonObjectModel;

namespace MapManager.Api.Tests.Mapping;

public sealed class FeatureMapperTests
{
    private static readonly DateTime Now = new(2026, 10, 30, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Coordinates_stay_lon_lat_in_both_directions()
    {
        var document = FeatureMapper.ToDocument(TestData.CreateObject(), Now);
        document.Id = "65a1b2c3d4e5f6a7b8c9d0ff";

        var point = Assert.IsType<GeoJsonPoint<GeoJson2DGeographicCoordinates>>(document.Geometry);
        Assert.Equal(34.78, point.Coordinates.Longitude);
        Assert.Equal(32.08, point.Coordinates.Latitude);
        Assert.Equal(new[] { 34.78, 32.08 }, FeatureMapper.ToMapObjectDto(document).Coordinates);
    }

    [Fact]
    public void Center_of_an_object_is_its_position()
    {
        var document = FeatureMapper.ToDocument(TestData.CreateObject(), Now);
        document.Id = "65a1b2c3d4e5f6a7b8c9d0ff";

        var center = FeatureMapper.ToMapObjectDto(document).Center;

        Assert.Equal(32.08, center.Lat);
        Assert.Equal(34.78, center.Lon);
    }

    [Fact]
    public void Center_of_a_polygon_is_weighted_by_area()
    {
        // An L shape: a 2x1 block plus a 1x1 block on its left half. The vertex mean would be (35, 33).
        var ring = new[]
        {
            new[] { 34.0, 32.0 }, new[] { 36.0, 32.0 }, new[] { 36.0, 33.0 }, new[] { 35.0, 33.0 },
            new[] { 35.0, 34.0 }, new[] { 34.0, 34.0 }, new[] { 34.0, 32.0 }
        };

        var center = CenterCalculator.OfRing(ring);

        Assert.Equal(32.0 + 5.0 / 6, center.Lat, 9);
        Assert.Equal(34.0 + 5.0 / 6, center.Lon, 9);
    }
}
