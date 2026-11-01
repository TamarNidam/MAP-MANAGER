using System.ComponentModel.DataAnnotations;
using MapManager.Api.Dtos;
using MapManager.Api.Services;
using MapManager.Api.Validation;
using Microsoft.AspNetCore.Mvc;

namespace MapManager.Api.Controllers;

/// <summary>CRUD for polygons. Coordinates use GeoJSON order: [longitude, latitude].</summary>
[ApiController]
[Route("api/polygons")]
public sealed class PolygonsController : ControllerBase
{
    private readonly IPolygonService _service;

    public PolygonsController(IPolygonService service)
    {
        _service = service;
    }

    /// <summary>
    /// Creates a batch of polygons. The insert is not atomic on standalone MongoDB: a failed insert triggers a
    /// best-effort rollback, and that rollback can itself fail and leave some items saved.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(IReadOnlyList<PolygonDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyList<PolygonDto>>> Create(
        CreatePolygonsRequest request,
        CancellationToken cancellationToken)
    {
        var created = await _service.CreateManyAsync(request.Items, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    /// <summary>Lists polygons, newest first.</summary>
    /// <param name="limit">Maximum number of polygons to return.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<PolygonDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyList<PolygonDto>>> List(
        [FromQuery, Range(1, ValidationLimits.MaxListLimit)] int limit = ValidationLimits.DefaultListLimit,
        CancellationToken cancellationToken = default)
    {
        return Ok(await _service.ListAsync(limit, cancellationToken));
    }

    /// <summary>Returns one polygon.</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(PolygonDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PolygonDto>> Get([ObjectId] string id, CancellationToken cancellationToken)
    {
        var item = await _service.GetByIdAsync(id, cancellationToken);
        return item is null ? PolygonNotFound() : Ok(item);
    }

    /// <summary>Replaces the editable fields of a polygon.</summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(PolygonDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PolygonDto>> Update(
        [ObjectId] string id,
        UpdatePolygonRequest request,
        CancellationToken cancellationToken)
    {
        var item = await _service.UpdateAsync(id, request, cancellationToken);
        return item is null ? PolygonNotFound() : Ok(item);
    }

    /// <summary>Deletes a polygon permanently.</summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete([ObjectId] string id, CancellationToken cancellationToken)
    {
        return await _service.DeleteAsync(id, cancellationToken) ? NoContent() : PolygonNotFound();
    }

    /// <summary>Deletes every polygon. Objects are not affected.</summary>
    [HttpDelete]
    [ProducesResponseType(typeof(DeleteResultDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DeleteResultDto>> DeleteAll(CancellationToken cancellationToken)
    {
        return Ok(new DeleteResultDto(await _service.DeleteAllAsync(cancellationToken)));
    }

    private ObjectResult PolygonNotFound() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Polygon not found");
}
