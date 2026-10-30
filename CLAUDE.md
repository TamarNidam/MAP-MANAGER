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
- Collections `features` (objects and polygons) and `layers`.
- Feature: `geometry` (Point or Polygon), `properties` (`kind`, `objectType`, `name`, `layerId`, `createdBy`), `createdAt`, `updatedAt`.
- Stored enum values are lowercase ids, the same as the API (`"object"`, `"polygon"`, `"jeep"`), through one BSON convention.
- `layerId` is required and must refer to an existing layer. One default layer is seeded at startup; it cannot be deleted.
- `center` (`{ lat, lon }`) is derived in `Mapping/` and never stored.
- **GeoJSON order is `[lon, lat]`.** Leaflet uses `[lat, lon]`: convert in exactly one place on the client.
- Polygons: closed rings, at least 4 points each, no self-intersection, at most 10 rings and 1000 points in total. Batches have 1-100 items.
- `ObjectType`: Marker, Jeep, Truck, Helicopter, Drone, Tower (served by `GET /api/object-types`).
- Indexes are created at startup (`MongoIndexInitializer`). Keep them in sync with the queries.

## API
Done: `GET /api/object-types`; `GET, POST /api/layers`; `PUT, DELETE /api/layers/{id}`; `POST, GET /api/objects`; `GET, PUT, DELETE /api/objects/{id}`; `POST, GET, DELETE /api/polygons` (DELETE deletes all polygons, returns `{ deletedCount }`); `GET, PUT, DELETE /api/polygons/{id}`.
Next: `GET /api/map-data` with `type, creator, createdWithinDays, within, q, layers, bbox, limit, cursor` -> `{ items, nextCursor }`. Phase 3 currently reads the existing object and polygon list endpoints.

## Behavior decisions
- Cursor pagination, sorted by `createdAt` desc then `_id` desc. Never `skip`.
- Save = batch POST; edit = PUT. Hard delete. No authentication (`createdBy` is a plain string).
- Batch create validates everything first; the repository rollback is a best-effort fallback (no transactions).
- Unknown JSON fields on PUT are ignored. Hide/show and layer visibility are client-only state.
- "Objects inside a polygon" uses `$geoWithin` with the `2dsphere` index.

## Security
Mongo bound to localhost; only the marked dev credentials in source. Bound all input. CORS allow-list from configuration. Before submitting, test the running API with **Strix** and fix what it finds.

## Working agreements
- One phase at a time; stop and report after each. No features outside the current phase; ask when the spec is ambiguous.
- Commit when a phase is finished. Do not push unless asked.
- Keep the README accurate. Add tests for important behavior only.

## Phases
0 Setup: done. 1 Server core: done. 2 `/api/map-data`: next. **3 Client vertical slice and drawing UX (Phase 3c): done.** 4 Panels (filters, layers, editing, Duplicate): not started. 5 Docker for API and client, polish. 6 Aggregations.
