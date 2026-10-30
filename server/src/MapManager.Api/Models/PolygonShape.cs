namespace MapManager.Api.Models;

/// <summary>How a polygon was drawn. The stored geometry is always a GeoJSON Polygon, whatever the shape.</summary>
public enum PolygonShape
{
    Polygon,
    Rectangle,
    Circle
}
