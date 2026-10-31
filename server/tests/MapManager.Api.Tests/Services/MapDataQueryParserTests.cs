using MapManager.Api.Dtos;
using MapManager.Api.Services;

namespace MapManager.Api.Tests.Services;

public sealed class MapDataQueryParserTests
{
    [Fact]
    public void Parse_expands_a_submicrometer_bbox_around_its_center()
    {
        const double centerLongitude = 34.7818;
        const double centerLatitude = 32.0853;
        var query = MapDataQueryParser.Parse(new MapDataQueryRequest
        {
            Bbox = "34.7817999999995,32.0852999999995,34.7818000000005,32.0853000000005"
        }, DateTime.UtcNow);

        var bbox = Assert.IsType<MapManager.Api.Models.BoundingBox>(query.Bbox);
        var longitudeSpanMeters = (bbox.MaxLon - bbox.MinLon) * 111_320 * Math.Cos(centerLatitude * Math.PI / 180);
        var latitudeSpanMeters = (bbox.MaxLat - bbox.MinLat) * 111_320;

        Assert.InRange(longitudeSpanMeters, 0.0000009, 0.0000011);
        Assert.InRange(latitudeSpanMeters, 0.0000009, 0.0000011);
        Assert.InRange((bbox.MinLon + bbox.MaxLon) / 2, centerLongitude - 1e-12, centerLongitude + 1e-12);
        Assert.InRange((bbox.MinLat + bbox.MaxLat) / 2, centerLatitude - 1e-12, centerLatitude + 1e-12);
    }
}
