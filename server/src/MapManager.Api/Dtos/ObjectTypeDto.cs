namespace MapManager.Api.Dtos;

/// <summary>An object type as exposed to the client.</summary>
/// <param name="Id">Stable lowercase identifier, for example "jeep".</param>
/// <param name="Label">Human-readable name, for example "Jeep".</param>
public sealed record ObjectTypeDto(string Id, string Label);
