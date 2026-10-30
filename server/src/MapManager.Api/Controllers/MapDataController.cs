using MapManager.Api.Dtos;
using MapManager.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace MapManager.Api.Controllers;

/// <summary>Objects and polygons together, filtered and paged for the map and its table.</summary>
[ApiController]
[Route("api/map-data")]
public sealed class MapDataController : ControllerBase
{
    private readonly IMapDataService _service;

    public MapDataController(IMapDataService service)
    {
        _service = service;
    }

    /// <summary>Returns one page of features, newest first. Use "nextCursor" to get the next page.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(MapDataPageDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MapDataPageDto>> Get(
        [FromQuery] MapDataQueryRequest request,
        CancellationToken cancellationToken)
    {
        var page = await _service.QueryAsync(request, cancellationToken);
        return page is null
            ? Problem(statusCode: StatusCodes.Status404NotFound, title: "Polygon not found")
            : Ok(page);
    }
}
