using MapManager.Api.Dtos;
using MapManager.Api.Services;
using MapManager.Api.Validation;
using Microsoft.AspNetCore.Mvc;

namespace MapManager.Api.Controllers;

/// <summary>Layers group features. Every object and polygon belongs to exactly one layer.</summary>
[ApiController]
[Route("api/layers")]
public sealed class LayersController : ControllerBase
{
    private readonly ILayerService _service;

    public LayersController(ILayerService service)
    {
        _service = service;
    }

    /// <summary>Lists every layer: the default layer first, then by name.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<LayerDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<LayerDto>>> List(CancellationToken cancellationToken)
    {
        return Ok(await _service.ListAsync(cancellationToken));
    }

    /// <summary>Creates a layer. Names are unique, ignoring case.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(LayerDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<LayerDto>> Create(LayerRequest request, CancellationToken cancellationToken)
    {
        var created = await _service.CreateAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    /// <summary>Renames or recolors a layer.</summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(LayerDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<LayerDto>> Update(
        [ObjectId] string id,
        LayerRequest request,
        CancellationToken cancellationToken)
    {
        var layer = await _service.UpdateAsync(id, request, cancellationToken);
        return layer is null ? LayerNotFound() : Ok(layer);
    }

    /// <summary>Deletes a layer. Returns 409 for the default layer and for a layer that still has features.</summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete([ObjectId] string id, CancellationToken cancellationToken)
    {
        return await _service.DeleteAsync(id, cancellationToken) ? NoContent() : LayerNotFound();
    }

    private ObjectResult LayerNotFound() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Layer not found");
}
