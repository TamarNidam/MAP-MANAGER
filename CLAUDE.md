# Map Manager

Take-home interview app: map objects and polygons. React + Leaflet client, ASP.NET Core (.NET 8) API, MongoDB 8.
The authoritative spec is the original brief; do not add features beyond it without asking.
API reference: Swagger at /swagger. Decisions and limitations: README.md.

## Commands
- Server (from `server`): `dotnet build`, `dotnet test`.
- Client (from `client`): `npm run build`.
- Run API from `server/src/MapManager.Api` with `dotnet run`; `/health` must be `Healthy`.

## Structure and conventions
- Server: Controller -> Service -> Repository. Controllers use DTOs only (no Mongo types); mapping lives in `Mapping/`.
- One type per file. Validated request DTOs, `ProblemDetails` errors, async I/O with cancellation tokens.
- Client: `Workspace.tsx` composes domain hooks (`hooks/`) for `WorkspaceView.tsx`; pure geometry helpers in `geometry/`.
- Code and comments in English.

## Locked decisions (do not change without asking)
- One `features` collection (GeoJSON) for objects and polygons; `layers` is separate.
- GeoJSON is `[lon, lat]`; Leaflet is `[lat, lon]`. Convert in one place only (`geometry/coordinates.ts`).
- `center` is computed by the server, never stored.
- Cursor pagination by `createdAt` desc then `_id` desc. Never use `skip`.
- Save = batch POST, edit = PUT (full replace), delete = hard delete. `DELETE /api/polygons` (delete all) stays because the brief requires it.
- No authentication; `createdBy` is a plain string (documented in README).
- Map and table render the same list from one `/api/map-data` query. Drafts are always shown first.
- Eye/visibility is client-only state, never persisted.

## Concurrency and errors
- PUT must carry the item's `version`; a mismatch returns 409 and the client shows a conflict message. (Add once implemented.)
- Create items carry a `clientId` (unique index) so POST is idempotent. Retry only network errors and 5xx. (Add once implemented.)
- Treat 404 on DELETE as success on the client.
- Every request has a timeout; network failures become `ApiError` with status 0.

## Working rules
- Make small, focused changes. Do not add dependencies without asking.
- Do not start dev servers or a browser; I test the UI myself.
- Build and test once at the end of a task, not after every edit. Add tests only for new logic (keep the suite small).
- Do not run `git diff`, `git push`, or `rm -rf`. Commit only when asked.
- If a server change affects the running API in Visual Studio, tell me to restart it.
- Final report: at most 5 lines.

## Definition of done
- `dotnet build`, `dotnet test`, and `npm run build` pass.
- README "Known limitations" updated if behavior or guarantees changed.
- Before submission: run the Strix pentest tool against the API and fix findings.