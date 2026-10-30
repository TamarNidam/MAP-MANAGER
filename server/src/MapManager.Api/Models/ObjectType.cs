namespace MapManager.Api.Models;

/// <summary>
/// Closed list of object types. Adding a type means adding a value here, and it is served to the client
/// through GET /api/object-types so the client never hard-codes the list.
/// </summary>
public enum ObjectType
{
    Marker,
    Jeep,
    Truck,
    Helicopter,
    Drone,
    Tower
}
