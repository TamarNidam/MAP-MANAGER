namespace MapManager.Api.Models;

/// <summary>The sort position of the last item of a page. The next page starts right after it.</summary>
/// <param name="CreatedAt">Creation time of that item (UTC).</param>
/// <param name="Id">Id of that item.</param>
public sealed record FeatureCursor(DateTime CreatedAt, string Id);
