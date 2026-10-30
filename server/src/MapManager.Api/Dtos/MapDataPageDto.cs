namespace MapManager.Api.Dtos;

/// <summary>One page of GET /api/map-data, newest first.</summary>
/// <param name="Items">Objects and polygons, each with a "kind" discriminator.</param>
/// <param name="NextCursor">Pass as "cursor" to get the next page. Null on the last page.</param>
public sealed record MapDataPageDto(IReadOnlyList<MapItemDto> Items, string? NextCursor);
