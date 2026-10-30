using MapManager.Api.Errors;
using MapManager.Api.Validation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace MapManager.Api.Infrastructure;

/// <summary>
/// Turns the exceptions the API expects into 4xx ProblemDetails responses. They are logged at Warning with
/// their message only (no stack trace). Any other exception is logged as an error and left to the default
/// handler, which returns a generic 500 without details.
/// </summary>
public sealed class ApiExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetailsService;
    private readonly ILogger<ApiExceptionHandler> _logger;

    public ApiExceptionHandler(IProblemDetailsService problemDetailsService, ILogger<ApiExceptionHandler> logger)
    {
        _problemDetailsService = problemDetailsService;
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var problem = ToProblem(exception);
        if (problem is null)
        {
            _logger.LogError(exception, "Unhandled exception for {Method} {Path}.", httpContext.Request.Method, httpContext.Request.Path);
            return false;
        }

        _logger.LogWarning(
            "{Method} {Path} returned {Status}: {Message}",
            httpContext.Request.Method,
            httpContext.Request.Path,
            problem.Status,
            exception.Message);

        httpContext.Response.StatusCode = problem.Status!.Value;
        return await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem
        });
    }

    private static ProblemDetails? ToProblem(Exception exception) => exception switch
    {
        // The messages below are written by this application and never contain server internals.
        InvalidGeometryException => new ProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Invalid geometry",
            Detail = $"{exception.Message} Polygons must not self-intersect, and holes must lie inside the exterior ring."
        },
        RequestValidationException validation => new ValidationProblemDetails(
            validation.Errors.ToDictionary(e => e.Key, e => e.Value))
        {
            Status = StatusCodes.Status400BadRequest
        },
        ConflictException => new ProblemDetails
        {
            Status = StatusCodes.Status409Conflict,
            Title = "Conflict",
            Detail = exception.Message
        },
        BadHttpRequestException { StatusCode: StatusCodes.Status413PayloadTooLarge } => new ProblemDetails
        {
            Status = StatusCodes.Status413PayloadTooLarge,
            Title = "Request body too large",
            Detail = $"The request body must not be larger than {ValidationLimits.MaxRequestBodyBytes} bytes."
        },
        // Other malformed requests detected by the server (bad headers, truncated body and so on).
        BadHttpRequestException badRequest => new ProblemDetails
        {
            Status = badRequest.StatusCode,
            Title = "Bad request"
        },
        _ => null
    };
}
