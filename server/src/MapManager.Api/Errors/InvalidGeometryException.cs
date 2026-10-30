namespace MapManager.Api.Errors;

/// <summary>
/// Thrown when MongoDB rejects a geometry that passed request validation, for example a self-intersecting polygon.
/// It is returned to the client as a 400 response.
/// </summary>
public sealed class InvalidGeometryException : Exception
{
    public InvalidGeometryException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}
