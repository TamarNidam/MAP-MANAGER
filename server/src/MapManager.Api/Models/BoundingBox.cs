namespace MapManager.Api.Models;

/// <summary>A longitude/latitude rectangle in degrees. Min is always less than max.</summary>
public sealed record BoundingBox(double MinLon, double MinLat, double MaxLon, double MaxLat);
