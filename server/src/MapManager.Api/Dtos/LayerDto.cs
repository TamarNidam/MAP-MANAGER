namespace MapManager.Api.Dtos;

/// <summary>A layer as returned by the API.</summary>
/// <param name="Id">Layer id.</param>
/// <param name="Name">Display name.</param>
/// <param name="Color">Hex color, for example "#1D5FD0".</param>
/// <param name="IsDefault">True for the default layer, which cannot be deleted.</param>
/// <param name="CreatedAt">Creation time (UTC).</param>
/// <param name="UpdatedAt">Last update time (UTC).</param>
public sealed record LayerDto(
    string Id,
    string Name,
    string Color,
    bool IsDefault,
    DateTime CreatedAt,
    DateTime UpdatedAt);
