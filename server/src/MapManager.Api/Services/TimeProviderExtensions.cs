namespace MapManager.Api.Services;

/// <summary>Helpers for producing timestamps that are stored in MongoDB.</summary>
public static class TimeProviderExtensions
{
    /// <summary>
    /// Returns the current UTC time truncated to whole milliseconds, which is the precision MongoDB stores.
    /// This way the timestamps returned right after a write equal the ones a later read returns.
    /// </summary>
    public static DateTime GetStorageUtcNow(this TimeProvider timeProvider)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        return now.AddTicks(-(now.Ticks % TimeSpan.TicksPerMillisecond));
    }
}
