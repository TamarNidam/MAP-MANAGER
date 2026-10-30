using MapManager.Api.Dtos;
using MapManager.Api.Infrastructure;
using MapManager.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace MapManager.Api.Controllers;

/// <summary>Serves the closed list of object types so the client does not hard-code it.</summary>
[ApiController]
[Route("api/object-types")]
public sealed class ObjectTypesController : ControllerBase
{
    /// <summary>Returns every supported object type.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ObjectTypeDto>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<ObjectTypeDto>> Get()
    {
        var types = Enum.GetValues<ObjectType>()
            .Select(t => new ObjectTypeDto(EnumIds.ToId(t), t.ToString()))
            .ToList();

        return Ok(types);
    }
}
