namespace MapManager.Api.Tests.Fakes;

/// <summary>A clock that returns a set time, so timestamps in tests are predictable.</summary>
public sealed class FixedTimeProvider : TimeProvider
{
    public FixedTimeProvider(DateTimeOffset now)
    {
        Now = now;
    }

    /// <summary>The time returned by <see cref="GetUtcNow"/>. Tests can move it forward.</summary>
    public DateTimeOffset Now { get; set; }

    public override DateTimeOffset GetUtcNow() => Now;
}
