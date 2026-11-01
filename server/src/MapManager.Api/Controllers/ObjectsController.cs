using System.ComponentModel.DataAnnotations;
using MapManager.Api.Dtos;
using MapManager.Api.Services;
using MapManager.Api.Validation;
using Microsoft.AspNetCore.Mvc;

namespace MapManager.Api.Controllers;

/// <summary>CRUD for objects (markers and symbols). Coordinates use GeoJSON order: [longitude, latitude].</summary>
[ApiController]
[Route("api/objects")]
public sealed class ObjectsController : ControllerBase
{
    private readonly IMapObjectService _service;

    public ObjectsController(IMapObjectService service)
    {
        _service = service;
    }

    /// <summary>
    /// Creates a batch of objects. The insert is not atomic on standalone MongoDB: a failed insert triggers a
    /// best-effort rollback, and that rollback can itself fail and leave some items saved.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(IReadOnlyList<MapObjectDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyList<MapObjectDto>>> Create(
        CreateMapObjectsRequest request,
        CancellationToken cancellationToken)
    {
        var created = await _service.CreateManyAsync(request.Items, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    /// <summary>Lists objects, newest first.</summary>
    /// <param name="limit">Maximum number of objects to return.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<MapObjectDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyList<MapObjectDto>>> List(
        [FromQuery, Range(1, ValidationLimits.MaxListLimit)] int limit = ValidationLimits.DefaultListLimit,
        CancellationToken cancellationToken = default)
    {
        return Ok(await _service.ListAsync(limit, cancellationToken));
    }

    /// <summary>Returns one object.</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(MapObjectDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MapObjectDto>> Get([ObjectId] string id, CancellationToken cancellationToken)
    {
        var item = await _service.GetByIdAsync(id, cancellationToken);
        return item is null ? ObjectNotFound() : Ok(item);
    }

    /// <summary>Replaces the editable fields of an object.</summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(MapObjectDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MapObjectDto>> Update(
        [ObjectId] string id,
        UpdateMapObjectRequest request,
        CancellationToken cancellationToken)
    {
        var item = await _service.UpdateAsync(id, request, cancellationToken);
        return item is null ? ObjectNotFound() : Ok(item);
    }

    /// <summary>Deletes an object permanently.</summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete([ObjectId] string id, CancellationToken cancellationToken)
    {
        return await _service.DeleteAsync(id, cancellationToken) ? NoContent() : ObjectNotFound();
    }

    private ObjectResult ObjectNotFound() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Object not found");
}
