using System.Text.RegularExpressions;
using MapManager.Api.Mapping;
using MapManager.Api.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace MapManager.Api.Repositories;

/// <summary>Builds the single MongoDB filter for a map-data query.</summary>
public static class MapDataFilterBuilder
{
    private static readonly FilterDefinitionBuilder<FeatureDocument> Filter = Builders<FeatureDocument>.Filter;

    public static FilterDefinition<FeatureDocument> Build(MapDataQuery query)
    {
        var filters = new List<FilterDefinition<FeatureDocument>>();

        if (query.Kind is { } kind)
        {
            filters.Add(Filter.Eq(f => f.Properties.Kind, kind));
        }

        if (query.ObjectType is not null)
        {
            filters.Add(Filter.Eq(f => f.Properties.ObjectType, query.ObjectType));
        }

        if (query.Creator is not null)
        {
            filters.Add(Filter.Eq(f => f.Properties.CreatedBy, query.Creator));
        }

        if (query.CreatedSince is { } since)
        {
            filters.Add(Filter.Gte(f => f.CreatedAt, since));
        }

        if (query.Search is not null)
        {
            filters.Add(ContainsText(query.Search));
        }

        if (query.Within is not null)
        {
            filters.Add(Filter.Eq(f => f.Properties.Kind, FeatureKind.Object));
            filters.Add(Filter.GeoWithin(f => f.Geometry, query.Within));
        }

        if (query.LayerIds is not null)
        {
            filters.Add(Filter.In(f => f.Properties.LayerId, query.LayerIds));
        }

        if (query.Bbox is not null)
        {
            filters.Add(Filter.GeoIntersects(f => f.Geometry, GeometryMapper.ToSearchArea(query.Bbox)));
        }

        if (query.After is not null)
        {
            filters.Add(SortedAfter(query.After));
        }

        return filters.Count == 0 ? Filter.Empty : Filter.And(filters);
    }

    private static FilterDefinition<FeatureDocument> ContainsText(string text)
    {
        // The text comes from the user: escaped, so it can only ever match literally.
        var pattern = new BsonRegularExpression(Regex.Escape(text), "i");
        return Filter.Regex(f => f.Properties.Name, pattern) | Filter.Regex(f => f.Properties.CreatedBy, pattern);
    }

    private static FilterDefinition<FeatureDocument> SortedAfter(FeatureCursor cursor)
    {
        // The outer condition is implied by the $or. It gives the sort index a range to scan.
        return Filter.Lte(f => f.CreatedAt, cursor.CreatedAt)
            & (Filter.Lt(f => f.CreatedAt, cursor.CreatedAt)
                | (Filter.Eq(f => f.CreatedAt, cursor.CreatedAt) & Filter.Lt(f => f.Id, cursor.Id)));
    }
}
