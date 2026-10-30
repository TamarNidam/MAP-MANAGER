using System.Globalization;
using MapManager.Api.Dtos;
using MapManager.Api.Errors;
using MapManager.Api.Infrastructure;
using MapManager.Api.Models;
using MapManager.Api.Validation;

namespace MapManager.Api.Services;

/// <summary>Turns the text query parameters of GET /api/map-data into a typed query, reporting every bad parameter at once.</summary>
public static class MapDataQueryParser
{
    /// <exception cref="RequestValidationException">At least one parameter is invalid.</exception>
    public static MapDataQuery Parse(MapDataQueryRequest request, DateTime now)
    {
        var errors = new Dictionary<string, string[]>();

        FeatureKind? kind = null;
        ObjectType? objectType = null;
        if (request.Type is not null)
        {
            if (request.Type == EnumIds.ToId(FeatureKind.Polygon))
            {
                kind = FeatureKind.Polygon;
            }
            else if (EnumIds.TryParse<ObjectType>(request.Type, out var parsedType))
            {
                kind = FeatureKind.Object;
                objectType = parsedType;
            }
            else
            {
                errors["type"] = new[] { "Must be \"polygon\" or an object type id from /api/object-types." };
            }
        }

        var layerIds = request.Layers?.Split(',', StringSplitOptions.TrimEntries);
        if (layerIds is not null && !layerIds.All(new ObjectIdAttribute().IsValid))
        {
            errors["layers"] = new[] { "Must be comma-separated 24-character hex ids." };
        }

        BoundingBox? bbox = null;
        if (request.Bbox is not null)
        {
            bbox = ParseBbox(request.Bbox, out var bboxError);
            if (bboxError is not null)
            {
                errors["bbox"] = new[] { bboxError };
            }
        }

        FeatureCursor? after = null;
        if (request.Cursor is not null)
        {
            after = MapDataCursor.TryDecode(request.Cursor);
            if (after is null)
            {
                errors["cursor"] = new[] { "The cursor is not valid. Use the nextCursor of the previous page." };
            }
        }

        if (errors.Count > 0)
        {
            throw new RequestValidationException(errors);
        }

        return new MapDataQuery
        {
            Kind = kind,
            ObjectType = objectType,
            Creator = request.Creator,
            CreatedSince = request.CreatedWithinDays is { } days ? now.AddDays(-days) : null,
            Search = string.IsNullOrWhiteSpace(request.Q) ? null : request.Q.Trim(),
            LayerIds = layerIds,
            Bbox = bbox,
            After = after
        };
    }

    private static BoundingBox? ParseBbox(string text, out string? error)
    {
        var parts = text.Split(',');
        var values = new double[parts.Length];
        var areNumbers = parts.Length == 4
            && parts.Select((part, i) => double.TryParse(part, NumberStyles.Float, CultureInfo.InvariantCulture, out values[i])).All(ok => ok);
        if (!areNumbers)
        {
            error = "Must be four numbers: minLon,minLat,maxLon,maxLat.";
            return null;
        }

        error = GeoJsonRules.ValidatePosition(new[] { values[0], values[1] })
            ?? GeoJsonRules.ValidatePosition(new[] { values[2], values[3] });
        if (error is null && !(values[0] < values[2] && values[1] < values[3]))
        {
            error = "The minimum longitude and latitude must be less than the maximum ones.";
        }

        return error is null ? new BoundingBox(values[0], values[1], values[2], values[3]) : null;
    }
}
