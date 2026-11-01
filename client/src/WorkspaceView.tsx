// Renders the workspace layout from its composed view props.
import type { ComponentProps } from "react";
import { DetailsCard } from "./components/DetailsCard";
import { MapDataPanel } from "./components/MapDataPanel";
import { MapView } from "./components/MapView";
import { ObjectsPanel } from "./components/ObjectsPanel";
import { PolygonPanel } from "./components/PolygonPanel";
import type { DrawingShape } from "./map/coords";

export type WorkspaceViewProps = {
  unsavedCount: number;
  map: ComponentProps<typeof MapView>;
  details: ComponentProps<typeof DetailsCard> | null;
  sidebar: {
    defaultLayerMissing: boolean;
    loading: boolean;
    polygon: ComponentProps<typeof PolygonPanel>;
    objects: ComponentProps<typeof ObjectsPanel>;
    mapData: Parameters<typeof MapDataPanel>[0];
    addingObjectLabel: string;
    drawing: DrawingShape | null;
  };
};

export function WorkspaceView({ unsavedCount, map, details, sidebar }: WorkspaceViewProps) {
  return (
    <main className="workspace">
      <header className="top-bar">
        <div className="top-brand"><span className="brand-mark"><span /></span><span>MAP<span className="brand-light">MANAGER</span></span></div>
        <div className={`save-status${unsavedCount ? " has-unsaved" : " is-saved"}`} role="status">
          <span className="status-dot" />{unsavedCount ? `${unsavedCount} unsaved` : "All changes saved"}
        </div>
      </header>
      <section className="map-region" aria-label="Interactive map">
        <MapView {...map} />
        {details && <DetailsCard {...details} key={`${details.item.kind}:${details.item.id}`} />}
        <div className="map-attribution">Tel Aviv, Israel <span>·</span> OpenStreetMap</div>
      </section>
      <aside className="sidebar">
        {sidebar.defaultLayerMissing && <div className="error-message" role="alert">Default layer was not found.</div>}
        {sidebar.loading && <div className="loading-line">Loading map data…</div>}
        <PolygonPanel {...sidebar.polygon} />
        <ObjectsPanel {...sidebar.objects} />
        <MapDataPanel {...sidebar.mapData} />
        {sidebar.addingObjectLabel && (
          <div className="mode-banner">
            Click the map to place a {sidebar.addingObjectLabel}
            <button onClick={map.onCancelDrawing} aria-label="Cancel placement">×</button>
          </div>
        )}
        {sidebar.drawing && (
          <div className="mode-banner">
            {sidebar.drawing === "Polygon"
              ? "Click vertices; double-click the final vertex or click the first point to close"
              : sidebar.drawing === "Rectangle"
                ? "Click two opposite corners"
                : "Click the center, then set the radius"}
            <button onClick={map.onCancelDrawing} aria-label="Cancel drawing">×</button>
          </div>
        )}
      </aside>
    </main>
  );
}
