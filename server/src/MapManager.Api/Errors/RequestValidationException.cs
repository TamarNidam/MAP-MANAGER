namespace MapManager.Api.Errors;

/// <summary>
/// Thrown by a service when input is well-formed but invalid against stored data, for example a layer id that
/// does not exist. It is returned as a 400 validation ProblemDetails, in the same shape as model validation errors.
/// </summary>
public sealed class RequestValidationException : Exception
{
    /// <summary>Creates the exception from per-field error messages.</summary>
    /// <param name="errors">Field path (as the client sent it, for example "items[2].layerId") to its messages.</param>
    public RequestValidationException(IReadOnlyDictionary<string, string[]> errors)
        : base(string.Join(" ", errors.Select(e => $"{e.Key}: {string.Join(" ", e.Value)}")))
    {
        Errors = errors;
    }

    /// <summary>Field path to its error messages.</summary>
    public IReadOnlyDictionary<string, string[]> Errors { get; }
}
