using MapManager.Api.Dtos;
using MapManager.Api.Models;

namespace MapManager.Api.Mapping;

/// <summary>
/// The single place where layer DTOs are mapped to documents and back.
/// Names are trimmed and colors are stored in uppercase, so equal input is stored the same way.
/// </summary>
public static class LayerMapper
{
    /// <summary>Builds a new (non-default) layer document. The id is assigned by the repository.</summary>
    public static LayerDocument ToDocument(LayerRequest request, DateTime now) => new()
    {
        Name = request.Name.Trim(),
        Color = request.Color.ToUpperInvariant(),
        IsDefault = false,
        CreatedAt = now,
        UpdatedAt = now
    };

    /// <summary>Builds the field changes for a layer update.</summary>
    public static LayerUpdate ToUpdate(LayerRequest request, DateTime now) =>
        new(request.Name.Trim(), request.Color.ToUpperInvariant(), now);

    /// <summary>Maps a layer document to its API shape.</summary>
    public static LayerDto ToDto(LayerDocument document) => new(
        document.Id ?? throw new InvalidOperationException("A stored layer must have an id."),
        document.Name,
        document.Color,
        document.IsDefault,
        document.CreatedAt,
        document.UpdatedAt);
}
