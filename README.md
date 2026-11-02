# Map Manager

A client/server app for drawing, filtering and editing map objects and polygons, with a map and a table that show the same data.

**Stack:** ASP.NET Core Web API (.NET 8), MongoDB 8, React, TypeScript, Vite, Leaflet, TanStack Query.

## Quick start

```sh
docker compose up --build
```

Optional: copy `.env.example` to `.env` to override the development MongoDB credentials.

| What | URL |
|---|---|
| Client | <http://localhost:8080> |
| Swagger | <http://localhost:5080/swagger> (the API root redirects here) |
| Health | <http://localhost:5080/health> |

### Local development

Prerequisites: Docker, .NET 8 SDK, Node.js 20+.

1. `docker compose up -d mongo`
2. In `server/src/MapManager.Api`: `dotnet run`
3. In `client`: `npm ci`, then `npm run dev`, and open <http://localhost:5173>. Set `VITE_API_URL` to point at a different API (default `http://localhost:5080`).

The API creates its indexes and seeds the Default layer at startup.

## Features

- **Polygon panel:** draw a polygon, rectangle or circle; Save sends the unsaved shapes as one batch; delete the selected polygon or all polygons (with a confirmation that shows the current count).
- **Objects panel:** place an object of a chosen type on the map and save the batch.
- **Map Data panel:** one table of objects and polygons with search, type, creator, created-within, layer and "inside polygon" filters, a "Map view only" toggle, cursor paging and "Load all".
- **Details card:** edit name, color, layer, object type and geometry (move, edit vertices), duplicate or delete; saved items are updated with PUT.
- **Layers:** create, edit, delete and show/hide layers; a layer color is the default color of its items.
- **Unsaved changes:** drafts are listed first in the table with an "Unsaved" dot, and drawn dashed on the map.

## Architecture

```
server/src/MapManager.Api/
  Controllers/      HTTP endpoints, DTOs in and out
  Services/         business rules, query parsing, cursor handling
  Repositories/     MongoDB access and filter building
  Mapping/          document <-> DTO conversion, center calculation
  Models/           documents and domain types
  Validation/       request validation and GeoJSON rules
  Infrastructure/   Mongo setup, indexes, error handling, health check
server/tests/MapManager.Api.Tests/
client/src/
  hooks/            drafts, map data, selection, drawing, layers, feature actions
  components/       panels, map, details card
  geometry/         pure geometry helpers
  api/              HTTP client, types, retry policy
```

The server follows Controller -> Service -> Repository. Controllers and DTOs never expose MongoDB types.

Objects and polygons are stored in one `features` collection as GeoJSON, with a `kind` property. The table needs a single list across both kinds, sorted newest first, filtered and cursor-paged; with one collection that is one query. It is backed by the indexes created in `MongoIndexInitializer`: `2dsphere` on geometry (inside-polygon and bbox filters), `createdAt` + `_id` descending (paging), `kind` + `objectType`, `kind` + `createdAt` + `_id`, `layerId`, and a unique partial index on `clientId`. Layers live in their own collection.

## API

| Resource | Routes |
|---|---|
| Object types | `GET /api/object-types` |
| Layers | `GET, POST /api/layers`; `PUT, DELETE /api/layers/{id}` |
| Objects | `GET, POST /api/objects` (POST is a batch); `GET, PUT, DELETE /api/objects/{id}` |
| Polygons | `GET, POST /api/polygons` (POST is a batch); `GET, PUT, DELETE /api/polygons/{id}`; `DELETE /api/polygons` deletes all |
| Map data | `GET /api/map-data` |
| Health | `GET /health` |

`/api/map-data` accepts `type`, `creator`, `createdWithinDays`, `within`, `q`, `layers`, `bbox`, `limit` and `cursor`, and returns `{ items, nextCursor }`. Request and response schemas are in Swagger.

## Design decisions

- **Beyond the brief:** PUT editing (a saved item can be corrected without delete and re-create), layers (group and color items, and show or hide groups), filtering and cursor pagination (the table stays usable as the data grows).
- **One list, two views:** the map and the table render the same `/api/map-data` pages and filters. Drafts are always shown first. "Map view only" only adds a padded viewport `bbox` to the same query.
- **Coordinate order:** the server and GeoJSON use `[lon, lat]`; Leaflet uses `[lat, lon]`. The client converts in one place (`geometry/coordinates.ts`).
- **`center` is computed:** the server derives it from the geometry on every read and never stores it, so it cannot go stale.
- **Pagination:** sorted by `createdAt` descending, then `_id` descending. Pages are addressed by cursor, never `skip`, so deep pages cost the same as the first.
- **Hard delete:** deleted items are removed. `DELETE /api/polygons` exists because the brief requires it. A layer that still has items, and the default layer, cannot be deleted (409).
- **Object types** are a closed set served by `GET /api/object-types`, so the client and the server validate against the same list.
- **Optimistic concurrency:** each feature has a `version`. PUT must send it; a stale version returns 409, and the client reloads the item and keeps the user's edits on screen. Items stored before versions existed count as version 1.
- **Idempotent create:** the client sends each draft's UUID as `clientId`. A unique partial index makes a repeated create return the stored item, so a Save retried after a lost response does not duplicate it.
- **Client resilience:** network errors and 5xx are retried with backoff (up to 3 retries), 4xx are not; requests time out after 10 seconds; DELETE on an already-deleted item counts as success; when one half of a save fails, saved drafts are removed and the failed ones stay for a retry.
- **Swagger** is enabled in all environments for reviewer convenience.

## Tests

- **Server:** `dotnet test` from `server`. 35 tests. They need Docker: HTTP-level tests run the API against a real MongoDB 8 started with Testcontainers. Other tests cover validation, query parsing, filter building, center calculation and concurrency.
- **Client:** `npm test` from `client`. 20 tests (Vitest): geometry helpers, the API client (retry, timeout, network errors, DELETE 404, 409 handling), draft saving (lost response without duplicates, partial failure) and the details card (conflict message keeps edits, buttons disabled while saving).
- **Smoke:** `scripts/smoke.sh` starts the Docker stack and calls the API through the client's nginx.
- There are no automated UI or end-to-end tests.

## Known limitations

- **Batch create is not atomic.** Standalone MongoDB has no transactions, so a failed batch is rolled back best-effort, and a failed rollback can leave part of the batch saved. The client saves objects and polygons as two requests and keeps only the failed part as drafts.
- **Deleting a layer can race with creating an item** in that layer: the checks and the writes are separate operations, so an item can end up pointing at a deleted layer.
- **"Load all" stops at 1,000 items;** narrow the filters for larger data sets.
- **The "Map view only" bbox is approximate:** it is the viewport padded by 25% and treated as a plain rectangle.
- **A retried PUT** whose first response was lost returns 409 against its own write; the user sees the conflict message.
- **No authentication;** `createdBy` is a plain string.
- **Credentials** in `.env.example` and `appsettings.Development.json` are for local development only.

## What I would do next

- Run the Docker smoke test in CI.
- Add end-to-end UI tests for drawing and editing.
- Use MongoDB transactions (replica set) for batch create and layer deletion.
- Restrict Swagger and add authentication before any shared deployment.
