# Map Manager

Client/server application for managing polygons and objects on an interactive map.
Server: ASP.NET Core Web API (`net8.0`). Database: MongoDB. Client: React + Leaflet (later phase).

## Run

Prerequisites: .NET SDK 8 or newer, Docker Desktop.

1. Start MongoDB (repository root): `docker compose up -d`
2. Run the API (`server/src/MapManager.Api`): `dotnet run`. On startup it creates its indexes and a **Default** layer.
3. Open http://localhost:5080/swagger (API docs) or http://localhost:5080/health (should return `Healthy`).
4. Run the tests (`server`): `dotnet test`. They do not need MongoDB.

## Configuration

| Setting | Where | Notes |
|---|---|---|
| `Mongo:ConnectionString` | `appsettings.Development.json`, or env var `Mongo__ConnectionString` | Required. Empty in `appsettings.json` on purpose, so the app fails fast without it. |
| `Mongo:DatabaseName` | `appsettings.json` | Defaults to `mapmanager`. |
| `Cors:AllowedOrigins` | `appsettings.json` | Defaults to the Vite dev server. |

The credentials in `docker-compose.yml` and `appsettings.Development.json` are development-only defaults.

## Design decisions

- **One `features` collection** for polygons and objects, stored as GeoJSON Features, so one paginated query can serve the table. Every operation is scoped to one kind, so an object id never touches a polygon.
- **GeoJSON order `[lon, lat]`** in the API and the database. Each feature in a response also has a derived `center: { lat, lon }`, which is not stored.
- **Every feature belongs to an existing layer.** Layer names are unique ignoring case. The default layer cannot be deleted, and a layer cannot be deleted while it still has features.
- **No authentication.** `createdBy` is a plain string, by design for this task.
- **Hard delete.** `DELETE /api/polygons` deletes all polygons and never touches objects.
- **Batch create is all or nothing.** All input is validated first (fields, layers, polygon self-intersection). If MongoDB still rejects an item, the items already inserted are removed. That rollback is best-effort: the local MongoDB has no multi-document transactions.
- **Unknown JSON fields on `PUT` are ignored** by design, so `kind`, `createdBy` and `createdAt` cannot be changed.
- **Hide/show (eye) and layer visibility are client-only view state** and are not stored.
- **Errors are `ProblemDetails`:** `400` invalid input or malformed id, `404` unknown id, `409` conflict, `413` body over 5 MB.
