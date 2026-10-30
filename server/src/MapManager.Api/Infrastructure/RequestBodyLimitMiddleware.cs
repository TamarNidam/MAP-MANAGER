using MapManager.Api.Validation;
using Microsoft.AspNetCore.Http.Features;

namespace MapManager.Api.Infrastructure;

/// <summary>
/// Limits request bodies to <see cref="ValidationLimits.MaxRequestBodyBytes"/>. On Kestrel the server enforces the
/// limit while reading (this also covers chunked bodies); a declared Content-Length above the limit is rejected
/// before anything is read. Both cases raise a 413 <see cref="BadHttpRequestException"/>, which
/// <see cref="ApiExceptionHandler"/> turns into a ProblemDetails response.
/// </summary>
public sealed class RequestBodyLimitMiddleware
{
    private readonly RequestDelegate _next;

    public RequestBodyLimitMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    /// <summary>Applies the limit and calls the rest of the pipeline.</summary>
    public Task InvokeAsync(HttpContext context)
    {
        var sizeFeature = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (sizeFeature is { IsReadOnly: false })
        {
            sizeFeature.MaxRequestBodySize = ValidationLimits.MaxRequestBodyBytes;
        }

        if (context.Request.ContentLength > ValidationLimits.MaxRequestBodyBytes)
        {
            throw new BadHttpRequestException("Request body too large.", StatusCodes.Status413PayloadTooLarge);
        }

        return _next(context);
    }
}
