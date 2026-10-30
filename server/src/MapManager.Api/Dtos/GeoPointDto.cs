namespace MapManager.Api.Dtos;

/// <summary>A point given as latitude and longitude, for example the center of a feature.</summary>
/// <param name="Lat">Latitude in degrees.</param>
/// <param name="Lon">Longitude in degrees.</param>
public sealed record GeoPointDto(double Lat, double Lon);
