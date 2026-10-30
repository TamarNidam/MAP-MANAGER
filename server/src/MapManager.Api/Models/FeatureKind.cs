namespace MapManager.Api.Models;

/// <summary>Discriminates the two kinds of GeoJSON features that share the "features" collection.</summary>
public enum FeatureKind
{
    Object,
    Polygon
}
