using MapManager.Api.Dtos;
using MapManager.Api.Models;

namespace MapManager.Api.Tests;

/// <summary>Valid sample input shared by the tests. Coordinates are [longitude, latitude] around Tel Aviv.</summary>
public static class TestData
{
    /// <summary>A valid MongoDB ObjectId used as a fixture value in unit tests.</summary>
    public const string LayerId = "65a1b2c3d4e5f6a7b8c9d0e1";

    public static double[] Point() => new[] { 34.78, 32.08 };

    /// <summary>A closed square ring with five positions.</summary>
    public static double[][][] Square() => new[]
    {
        new[]
        {
            new[] { 34.0, 32.0 },
            new[] { 35.0, 32.0 },
            new[] { 35.0, 33.0 },
            new[] { 34.0, 33.0 },
            new[] { 34.0, 32.0 }
        }
    };

    public static CreateMapObjectRequest CreateObject(string name = "Jeep 1", ObjectType type = ObjectType.Jeep) => new()
    {
        Name = name,
        ObjectType = type,
        LayerId = LayerId,
        CreatedBy = "tamar",
        Coordinates = Point()
    };

    public static CreatePolygonRequest CreatePolygon(string name = "Area A") => new()
    {
        Name = name,
        LayerId = LayerId,
        CreatedBy = "tamar",
        Coordinates = Square()
    };
}
