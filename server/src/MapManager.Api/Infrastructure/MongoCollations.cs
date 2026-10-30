using MongoDB.Driver;

namespace MapManager.Api.Infrastructure;

/// <summary>Collations shared by indexes and the queries that must use them.</summary>
public static class MongoCollations
{
    /// <summary>
    /// Case-insensitive comparison (strength 2 ignores case but not accents). A query only uses an index
    /// built with a collation when it passes the same collation.
    /// </summary>
    public static readonly Collation CaseInsensitive = new("en", strength: CollationStrength.Secondary);
}
