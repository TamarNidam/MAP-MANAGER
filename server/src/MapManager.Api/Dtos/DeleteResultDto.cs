namespace MapManager.Api.Dtos;

/// <summary>Result of a bulk delete.</summary>
/// <param name="DeletedCount">Number of records that were deleted.</param>
public sealed record DeleteResultDto(long DeletedCount);
