namespace MapManager.Api.Validation;

/// <summary>Upper bounds for request input, kept in one place so they are easy to review and tune.</summary>
public static class ValidationLimits
{
    public const int MaxBatchSize = 100;

    public const int MaxNameLength = 100;

    public const int MaxLayerNameLength = 50;

    /// <summary>A layer color: "#" followed by six hex digits.</summary>
    public const string HexColorPattern = "^#[0-9a-fA-F]{6}$";

    public const int MaxCreatedByLength = 50;

    /// <summary>Maximum number of rings in a polygon (one exterior ring plus holes).</summary>
    public const int MaxPolygonRings = 10;

    /// <summary>Minimum number of positions in a closed ring (a triangle plus the closing point).</summary>
    public const int MinRingPositions = 4;

    /// <summary>Maximum number of positions in one polygon, counted across all of its rings.</summary>
    public const int MaxPolygonPositions = 1000;

    public const int DefaultListLimit = 500;

    /// <summary>Maximum number of items a list endpoint returns in one response.</summary>
    public const int MaxListLimit = 1000;

    /// <summary>Maximum size of a request body in bytes (5 MB). Larger requests get 413.</summary>
    public const long MaxRequestBodyBytes = 5 * 1024 * 1024;
}
