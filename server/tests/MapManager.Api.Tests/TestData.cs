using MapManager.Api.Dtos;
using MapManager.Api.Models;
using MapManager.Api.Tests.Fakes;

namespace MapManager.Api.Tests;

/// <summary>Valid sample input shared by the tests. Coordinates are [longitude, latitude] around Tel Aviv.</summary>
public static class TestData
{
    /// <summary>Id of the default layer in <see cref="Layers"/>; the sample requests use it.</summary>
    public const string LayerId = "65a1b2c3d4e5f6a7b8c9d0e1";

    /// <summary>A second, non-default layer in <see cref="Layers"/>.</summary>
    public const string OtherLayerId = "65a1b2c3d4e5f6a7b8c9d0aa";

    /// <summary>A layer repository holding the default layer (<see cref="LayerId"/>) and <see cref="OtherLayerId"/>.</summary>
    public static InMemoryLayerRepository Layers()
    {
        var layers = new InMemoryLayerRepository();
        layers.Add(LayerId, "Default", isDefault: true);
        layers.Add(OtherLayerId, "Other");
        return layers;
    }

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
