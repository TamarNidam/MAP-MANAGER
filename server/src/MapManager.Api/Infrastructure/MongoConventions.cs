using MapManager.Api.Models;
using MongoDB.Bson.Serialization.Conventions;

namespace MapManager.Api.Infrastructure;

/// <summary>Registers the BSON conventions for the document models in <see cref="Models"/>.</summary>
public static class MongoConventions
{
    private static int _registered;

    /// <summary>
    /// Registers the conventions once per process. Must run before the first document is read or written,
    /// because the driver builds each class map only once.
    /// </summary>
    public static void Register()
    {
        if (Interlocked.Exchange(ref _registered, 1) == 1)
        {
            return;
        }

        var pack = new ConventionPack { new EnumIdConvention() };
        ConventionRegistry.Register("MapManager", pack, type => type.Namespace == typeof(FeatureDocument).Namespace);
    }
}
