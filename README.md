# Map Manager

Map Manager is a client/server app for creating, viewing, filtering, and editing map objects and polygons.
It combines those features in one interactive map and a matching staged data table.

**Stack:** ASP.NET Core Web API (.NET 8), MongoDB 8, React, TypeScript, Vite, Leaflet, and TanStack Query.

## Run

### Docker

Copy `.env.example` to `.env` to override the clearly marked development-only MongoDB credentials, then run this one command from the repository root:

```sh
docker compose up --build
```

Open the client at <http://localhost:8080>, the API docs (Swagger) at <http://localhost:5080/swagger>, and health at <http://localhost:5080/health>. The API root, <http://localhost:5080>, redirects to Swagger. The client proxies API requests through nginx, so Docker builds it with an empty `VITE_API_URL` and calls `/api` on its own origin.

### Local development

Prerequisites: Docker, .NET 8 SDK, and Node.js 20 or newer.

1. Start MongoDB: `docker compose up -d mongo`
2. From `server/src/MapManager.Api`, run `dotnet run`.
3. From `client`, run `npm ci`, then `npm run dev`.
4. Open <http://localhost:5173>. The API runs at <http://localhost:5080>; set `VITE_API_URL` to override the client's default `http://localhost:5080`.
5. Run tests from `server` with `dotnet test`.

The API creates MongoDB indexes and seeds the Default layer at startup. Local API configuration is in `appsettings.Development.json`; its credentials are development-only.

## Architecture

The server follows **Controller -> Service -> Repository**. Controllers use DTOs and do not expose MongoDB types; document/DTO conversion is isolated in `Mapping/`. Objects and polygons share one `features` collection as GeoJSON, with a `2dsphere` index; layers use their own collection and indexes are initialized at startup. The React client uses a single `/api/map-data` query for both map and table views.

## Layout decision

The brief defines four panels: the map on the left and Polygon, Objects, and Map Data down the right. An earlier iteration merged Polygon and Objects into one Draw panel and added a Layers panel because the right column felt crowded. That deviated from the brief, so the panels are split again and layer selection and management live in a compact Map Data header control.

## API overview

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | MongoDB-backed health status. |
| GET | `/api/object-types` | List supported object types. |
| GET, POST | `/api/layers` | List or create layers. |
| PUT, DELETE | `/api/layers/{id}` | Update or delete a layer. |
| GET, POST | `/api/objects` | List or batch-create objects. |
| GET, PUT, DELETE | `/api/objects/{id}` | Read, replace, or delete an object. |
| GET, POST | `/api/polygons` | List or batch-create polygons. |
| GET, PUT, DELETE | `/api/polygons/{id}` | Read, replace, or delete a polygon. |
| DELETE | `/api/polygons` | Delete all polygons; returns `{ deletedCount }`. |
| GET | `/api/map-data` | Filter and cursor-page objects and polygons. |

`/api/map-data` accepts `type`, `creator`, `createdWithinDays`, `within`, `q`, `layers`, `bbox`, `limit`, and `cursor`; its response is `{ items, nextCursor }`.

## Design decisions and assumptions

- One `features` collection stores both kinds of GeoJSON feature. The table merges polygons and objects so the map and table show the same filtered, paged list.
- Coordinates use GeoJSON `[lon, lat]`; `center` is computed by the server, not stored.
- Save creates items (batch POST); PUT replaces the full editable item. Batch creation validates all items first; rollback after a MongoDB insertion failure is best-effort.
- Cursor pagination is sorted by `createdAt` descending and then `_id` descending; pages load on demand. **Map view only** adds a padded viewport filter; **Load all** stops at 1,000 items.
- Map and table are two views of the same list. Drafts appear first. Item eyes and layer visibility are client-only state.
- A polygon with shape `circle` must have `radiusMeters` greater than 0; other shapes cannot have one.
- Swagger is enabled in all environments for reviewer convenience; it would be restricted in production.
- There is no authentication; `createdBy` is a plain string. Deletes are hard deletes.
- Leaflet does not support map rotation in this app.

## Known limitations

- The map-view bbox uses an approximate rectangular geographic extent.
- Load all is capped at 1,000 items; narrow filters for larger datasets.
- Local credentials are development defaults only; configure real credentials before deployment.
- The app has no authentication or authorization.
