# Map Manager

Take-home app for managing map objects and polygons.

## Stack and structure
- Server: ASP.NET Core Web API on `net8.0`, MongoDB 8, GeoJSON, Swagger in all environments.
- Client: React, TypeScript, Vite, Leaflet, TanStack Query.
- Server code is under `server/src/MapManager.Api/`; tests are under `server/tests/MapManager.Api.Tests/`. Client code is under `client/`.
- Client structure: `App.tsx` mounts `Workspace.tsx`; `useWorkspaceViewModel` composes domain hooks for the `WorkspaceView.tsx` layout. `hooks/` owns drafts, map data, selection, drawing, layers, and feature actions; `geometry/` contains pure geometry helpers.
- Keep the flow Controller -> Service -> Repository. Controllers/DTOs do not expose Mongo types; mapping belongs in `Mapping/`.
- Use validated request DTOs, `ProblemDetails`, async I/O with cancellation tokens, and one type per file.

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

`/api/map-data` accepts `type`, `creator`, `createdWithinDays`, `within`, `q`, `layers`, `bbox`, `limit`, and `cursor`. The client requests 200 items per page.

## Behavior
- Cursor pagination sorts by `createdAt` descending, then `_id` descending; never use `skip`.
- Save uses batch POST; edit uses PUT; deletion is hard delete. There is no authentication.
- GeoJSON coordinates are `[lon, lat]`; Leaflet coordinates are `[lat, lon]`. `center` is derived, not stored.
- **One list, two views:** the map and table render the same flattened `/api/map-data` pages and filters. Drafts are always shown first; no separate object list feeds the map. Map-view-only adds a padded viewport `bbox` to the query.

## Commands
- From `server`: `dotnet build` and `dotnet test`.
- From `client`: `npm run build`.
- Run the API from `server/src/MapManager.Api` with `dotnet run`; `/health` should be `Healthy`.

## Phases
- 0 Setup, 1 Server core, 2 `/api/map-data`, 2b optional feature fields, and 3 Client vertical slice/drawing UX: done.
- **4a: implemented, awaiting my manual check.**
- 4b client editing and layers: done.
- **5 Docker packaging and documentation: done.**
- 6 aggregations: not started.
