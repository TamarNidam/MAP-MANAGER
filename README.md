# Map Manager

Client/server application for managing polygons and objects on an interactive map.
Server: ASP.NET Core Web API (`net8.0`). Database: MongoDB. Client: React, TypeScript, Vite, and Leaflet.

## Run

Prerequisites: .NET SDK 8 or newer, Docker Desktop, Node.js 20 or newer.

1. Start MongoDB (repository root): `docker compose up -d`
2. Run the API (`server/src/MapManager.Api`): `dotnet run`. On startup it creates its indexes and a **Default** layer.
3. Run the client from `client`: `npm install`, then `npm run dev`.
4. Open http://localhost:5173. The client uses `http://localhost:5080` by default; set `VITE_API_URL` to override the API base URL.
5. Open http://localhost:5080/swagger (API docs) or http://localhost:5080/health (should return `Healthy`).
6. Run the server tests (`server`): `dotnet test`. They do not need MongoDB.

## Configuration

| Setting | Where | Notes |
|---|---|---|
| `Mongo:ConnectionString` | `appsettings.Development.json`, or env var `Mongo__ConnectionString` | Required. Empty in `appsettings.json` on purpose, so the app fails fast without it. |
| `Mongo:DatabaseName` | `appsettings.json` | Defaults to `mapmanager`. |
| `Cors:AllowedOrigins` | `appsettings.json` | Defaults to the Vite dev server. |

The credentials in `docker-compose.yml` and `appsettings.Development.json` are development-only defaults.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/object-types` | The object types, with their ids. |
| `GET, POST /api/layers`, `PUT, DELETE /api/layers/{id}` | Manage layers. |
| `GET, POST /api/objects`, `GET, PUT, DELETE /api/objects/{id}` | Manage objects. `POST` takes a batch of 1-100 items. |
| `GET, POST, DELETE /api/polygons`, `GET, PUT, DELETE /api/polygons/{id}` | Manage polygons. `POST` takes a batch of 1-100 items. `DELETE /api/polygons` deletes all polygons and returns `{ deletedCount }`. |
| `GET /api/map-data` | Objects and polygons together, filtered and paged. Returns `{ items, nextCursor }`. |

Optional fields on objects and polygons:

| Field | Applies to | Values |
|---|---|---|
| `color` | Objects and polygons | Hex `#RRGGBB`. |
| `shape` | Polygons only (objects reject it) | `polygon` (default), `rectangle` or `circle`. The geometry is always stored as a GeoJSON Polygon. |
| `radiusMeters` | Polygons with `shape: "circle"` only | Greater than 0, up to 20,000 km. |

`GET /api/map-data` query parameters, all optional and combined with AND:

| Parameter | Meaning |
|---|---|
| `type` | `polygon` or an object type id such as `jeep`. |
| `creator` | Exact `createdBy`. |
| `createdWithinDays` | Created in the last N days (UTC). |
| `q` | Case-insensitive "contains" on `name` and `createdBy`, taken as plain text. |
| `within` | Id of a polygon: the objects whose point lies inside it, not the polygon itself. `404` when there is no such polygon. |
| `layers` | Comma-separated layer ids. |
| `bbox` | `minLon,minLat,maxLon,maxLat`: the features that intersect the box. |
| `limit` | Page size, 1-100. Default 20. |
| `cursor` | The `nextCursor` of the previous page. |

Each item has a `kind` of `object` or `polygon`, then the same fields as the matching endpoint.

## Design decisions

- **One `features` collection** for polygons and objects, stored as GeoJSON Features, so one paginated query can serve the table. Every operation is scoped to one kind, so an object id never touches a polygon.
- **GeoJSON order `[lon, lat]`** in the API and the database. Each feature in a response also has a derived `center: { lat, lon }`, which is not stored.
- **Every feature belongs to an existing layer.** Layer names are unique ignoring case. The default layer cannot be deleted, and a layer cannot be deleted while it still has features.
- **No authentication.** `createdBy` is a plain string, by design for this task.
- **Hard delete.** `DELETE /api/polygons` deletes all polygons and never touches objects.
- **Batch create is all or nothing.** All input is validated first (fields, layers, polygon self-intersection). If MongoDB still rejects an item, the items already inserted are removed. That rollback is best-effort: the local MongoDB has no multi-document transactions.
- **Unknown JSON fields on `PUT` are ignored** by design, so `kind`, `createdBy` and `createdAt` cannot be changed.
- **`PUT` replaces all editable fields.** Leaving out `color` or `radiusMeters` removes it, and leaving out `shape` resets it to `polygon`. Features stored before these fields existed read with no color, and polygons read as `polygon`.
- **Cursor pagination, never `skip`.** Items are sorted by `createdAt` then `_id`, newest first, so a page stays stable while items are added. The cursor is opaque.
- **Wide bounding boxes are split into columns** of at most 90 degrees, and the poles are left out, because a single polygon spanning 180 degrees or more has no unambiguous edges on a sphere. Box edges follow great circles, so a wide box is approximate near its top and bottom.
- **Hide/show (eye) and layer visibility are client-only view state** and are not stored.
- **Errors are `ProblemDetails`:** `400` invalid input or malformed id, `404` unknown id, `409` conflict, `413` body over 5 MB.
