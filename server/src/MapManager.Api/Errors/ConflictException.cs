namespace MapManager.Api.Errors;

/// <summary>
/// Thrown when a request conflicts with the current state, for example a duplicate layer name or deleting a
/// layer that still has features. It is returned to the client as a 409 response with the message as detail.
/// </summary>
public sealed class ConflictException : Exception
{
    public ConflictException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}
