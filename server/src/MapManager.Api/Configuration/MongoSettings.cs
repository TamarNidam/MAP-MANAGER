using System.ComponentModel.DataAnnotations;

namespace MapManager.Api.Configuration;

/// <summary>Strongly typed settings bound from the "Mongo" configuration section.</summary>
public sealed class MongoSettings
{
    public const string SectionName = "Mongo";

    /// <summary>MongoDB connection string. Required: the app does not start without it.</summary>
    [Required]
    public string ConnectionString { get; init; } = string.Empty;

    [Required]
    public string DatabaseName { get; init; } = "mapmanager";
}
