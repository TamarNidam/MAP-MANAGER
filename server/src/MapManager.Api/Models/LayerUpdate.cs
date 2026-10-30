namespace MapManager.Api.Models;

/// <summary>The fields of a layer that an update replaces. The id, default flag and creation time never change.</summary>
/// <param name="Name">New display name.</param>
/// <param name="Color">New hex color.</param>
/// <param name="UpdatedAt">Time of the update (UTC).</param>
public sealed record LayerUpdate(string Name, string Color, DateTime UpdatedAt);
