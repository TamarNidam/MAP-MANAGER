# Map Manager: instructions for Claude

## Project
Take-home interview task: a client/server app for managing polygons and objects (markers or symbols such as a Jeep) on an interactive map. The reviewer reads the README, runs `docker compose up`, and reads the code. **Clean, modular code matters more than the number of features.** Do not leave features half-finished.

## Stack
- Server: ASP.NET Core Web API targeting **`net8.0`**. The installed SDK is 9.0.320 (it builds `net8.0`). Do not target a newer framework.
- MongoDB 8 (Docker), `MongoDB.Driver`, GeoJSON with a `2dsphere` index. Swagger in Development only.
- Tests: xUnit, plus `Microsoft.AspNetCore.Mvc.Testing` for HTTP tests.
- Client: React + TypeScript + Vite, Leaflet + react-leaflet + Leaflet-Geoman, TanStack Query.

## Layout
`server/src/MapManager.Api/`: `Controllers`, `Services`, `Repositories`, `Mapping`, `Dtos`, `Models`, `Validation`, `Errors`, `Infrastructure`, `Configuration`.
`server/tests/MapManager.Api.Tests/`: unit and HTTP tests with in-memory fakes (no MongoDB). `client/`: Vite app with `api/`, `components/`, `hooks/`, `map/`, and `types/`.

## Commands
- Database: `docker compose up -d` (repo root)
- Build: `dotnet build` (from `server`, must have 0 warnings). Test: `dotnet test` (from `server`).
- Run: `dotnet run` (from `server/src/MapManager.Api`) -> http://localhost:5080/swagger, `/health` must be `Healthy`.

## Architecture rules
- **Controller -> Service -> Repository.** Controllers only translate HTTP. Business rules live in services. Mongo queries live in repositories.
- Controllers and DTOs never expose Mongo types. DTO <-> document mapping lives only in `Mapping/`.
- Every request body has a validated DTO. Errors are `ProblemDetails`: `400` validation or malformed route id, `404` missing, `409` conflict, `413` body over 5 MB. No stack traces. Services raise `RequestValidationException` / `ConflictException`.
- Async I/O with `CancellationToken`. One type per file. English comments. XML docs on controllers, service interfaces and non-obvious DTOs only (CS1591 is suppressed).
- Do not add packages without saying why.

## Data model
- MongoDB collections are `features` and `layers`. A feature stores GeoJSON Point/Polygon geometry, lowercase `kind` and object type IDs, name, required existing `layerId`, `createdBy`, timestamps, and optional `color`, polygon `shape`, and circle `radiusMeters`.
- `color` is `#RRGGBB`; shape is `polygon` (default), `rectangle`, or `circle`. Circle geometry is stored as a polygon. Older documents without optional fields remain readable.
- GeoJSON coordinates are `[lon, lat]`; Leaflet coordinates are `[lat, lon]`. `center` is derived, never stored. The default layer is seeded and cannot be deleted.
- Polygons have closed rings, no self-intersections, at most 10 rings/1000 positions; create batches contain 1-100 items. Mongo indexes are initialized at startup.

## API
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/object-types` | List supported object types. |
| GET, POST | `/api/layers` | List or create layers. |
| PUT, DELETE | `/api/layers/{id}` | Update or delete a layer. |
| GET, POST | `/api/objects` | List or batch-create objects. |
| GET, PUT, DELETE | `/api/objects/{id}` | Read, replace, or delete an object. |
| GET, POST | `/api/polygons` | List or batch-create polygons. |
| GET, PUT, DELETE | `/api/polygons/{id}` | Read, replace, or delete a polygon. |
| DELETE | `/api/polygons` | Delete all polygons; returns `{ deletedCount }`. |
| GET | `/api/map-data` | Filter and cursor-page objects/polygons; returns `{ items, nextCursor }`. |

`/api/map-data` accepts `type`, `creator`, `createdWithinDays`, `within`, `q`, `layers`, `bbox`, `limit`, and `cursor`. The client requests 50 items per page.

## Behavior decisions
- Cursor pagination, sorted by `createdAt` desc then `_id` desc. Never `skip`.
- Save = batch POST; edit = PUT. Hard delete. No authentication (`createdBy` is a plain string).
- Batch create validates everything first; the repository rollback is a best-effort fallback (no transactions).
- Unknown JSON fields on PUT are ignored. Hide/show and layer visibility are client-only state.
- PUT replaces all editable fields: leaving out `color` or `radiusMeters` removes it, leaving out `shape` resets it to `polygon`.
- "Objects inside a polygon" uses `$geoWithin` with the `2dsphere` index.
- **One list, two views:** the client renders map and table from the same flattened `/api/map-data` pages and filters. Drafts are always shown first; no separate object list feeds the map. Map-view-only adds a padded viewport `bbox` to the query.

## Security
Mongo bound to localhost; only the marked dev credentials in source. Bound all input. CORS allow-list from configuration. Before submitting, test the running API with **Strix** and fix what it finds.

## Working agreements
- One phase at a time; stop and report after each. No features outside the current phase; ask when the spec is ambiguous.
- Commit when a phase is finished. Do not push unless asked.
- Keep the README accurate. Add tests for important behavior only.

## Phases
0 Setup, 1 Server core, 2 `/api/map-data`, 2b optional feature fields, and 3 Client vertical slice/drawing UX: done. **4a filtered table/staged loading: implemented; manual verification pending.** 4b editing, colors, layer UI, Duplicate: not started. 5 Docker/polish and 6 aggregations: not started.
