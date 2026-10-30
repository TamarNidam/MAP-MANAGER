import { useState } from "react";
import type { ObjectTypeDto } from "../api/types";
import type { DrawingShape } from "../map/coords";
import type { TableItem, Selection } from "../types/map";
import { typeIconMarkup } from "../map/ObjectMarker";

type PolygonPanelProps = {
  pendingCount: number;
  hasPolygonSelection: boolean;
  hasAnyPolygons: boolean;
  confirmDeleteAll: boolean;
  onAdd: (shape: DrawingShape) => void;
  onSave: () => void;
  onDelete: () => void;
};

export function PolygonPanel(props: PolygonPanelProps) {
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const shapes: DrawingShape[] = ["Polygon", "Rectangle", "Circle"];

  return (
    <section className="panel">
      <div className="panel-heading"><span className="panel-symbol polygon-symbol" /> <h2>Polygon</h2></div>
      <div className="actions">
        <div className="shape-menu-anchor">
          <button className="button button-primary" aria-haspopup="menu" aria-expanded={shapeMenuOpen} onClick={() => setShapeMenuOpen((open) => !open)}><span aria-hidden="true">＋</span> Add</button>
          {shapeMenuOpen && <div className="shape-menu" role="menu">{shapes.map((shape) => <button key={shape} role="menuitem" onClick={() => { props.onAdd(shape); setShapeMenuOpen(false); }}>{shape}</button>)}</div>}
        </div>
        <button className="button button-secondary" onClick={props.onSave} disabled={!props.pendingCount}>Save{props.pendingCount > 0 ? ` (${props.pendingCount})` : ""}</button>
        <button className="button button-danger" onClick={props.onDelete} disabled={!props.hasPolygonSelection && !props.hasAnyPolygons}>
          {props.hasPolygonSelection ? "Delete" : props.confirmDeleteAll ? "Confirm delete all" : "Delete all"}
        </button>
      </div>
      <p className="panel-hint">{props.pendingCount ? `${props.pendingCount} unsaved polygon${props.pendingCount === 1 ? "" : "s"}` : "Draw and save map areas"}</p>
    </section>
  );
}

type ObjectsPanelProps = {
  types: ObjectTypeDto[];
  selectedType: string;
  pendingCount: number;
  hasObjectSelection: boolean;
  onChoose: (type: string) => void;
  onAdd: () => void;
  onSave: () => void;
  onDelete: () => void;
};

export function ObjectsPanel(props: ObjectsPanelProps) {
  return (
    <section className="panel">
      <div className="panel-heading"><span className="panel-symbol object-symbol" /> <h2>Objects</h2></div>
      <div className="type-picker" aria-label="Object type">
        {props.types.map((type) => (
          <button
            key={type.id}
            className={`type-button${props.selectedType === type.id ? " is-active" : ""}`}
            onClick={() => props.onChoose(type.id)}
            aria-label={type.label}
            aria-pressed={props.selectedType === type.id}
            title={type.label}
            dangerouslySetInnerHTML={{ __html: typeIconMarkup(type.id) }}
          />
        ))}
      </div>
      <div className="actions">
        <button className="button button-primary" onClick={props.onAdd} disabled={!props.types.length}><span aria-hidden="true">＋</span> Add</button>
        <button className="button button-secondary" onClick={props.onSave} disabled={!props.pendingCount}>Save{props.pendingCount > 0 ? ` (${props.pendingCount})` : ""}</button>
        <button className="button button-danger" onClick={props.onDelete} disabled={!props.hasObjectSelection}>Delete</button>
      </div>
      <p className="panel-hint">{props.pendingCount ? `${props.pendingCount} unsaved object${props.pendingCount === 1 ? "" : "s"}` : "Choose a type, then place it on the map"}</p>
    </section>
  );
}

type MapDataPanelProps = {
  items: TableItem[];
  selected: Selection;
  hidden: Set<string>;
  rowRefs: React.MutableRefObject<Map<string, HTMLTableRowElement>>;
  onSelect: (selection: Selection) => void;
  onToggleVisibility: (key: string) => void;
};

export function MapDataPanel(props: MapDataPanelProps) {
  return (
    <section className="panel data-panel">
      <div className="panel-heading"><span className="panel-symbol data-symbol" /> <h2>Map Data</h2><span className="item-count">{props.items.length}</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Object</th><th>Lat</th><th>Lon</th><th><span className="visually-hidden">Visibility</span></th></tr></thead>
          <tbody>
            {props.items.map((item) => {
              const key = `${item.kind}:${item.id}`;
              const isSelected = props.selected?.kind === item.kind && props.selected.id === item.id;
              const isHidden = props.hidden.has(key);
              return (
                <tr
                  key={key}
                  ref={(element) => { if (element) props.rowRefs.current.set(key, element); else props.rowRefs.current.delete(key); }}
                  className={`${isSelected ? "is-selected" : ""}${isHidden ? " is-hidden" : ""}`}
                  onClick={() => props.onSelect({ kind: item.kind, id: item.id })}
                  aria-selected={isSelected}
                >
                  <td>{item.label}{item.saved ? "" : <span className="unsaved-dot" title="Unsaved" />}</td>
                  <td>{item.center.lat.toFixed(5)}</td>
                  <td>{item.center.lon.toFixed(5)}</td>
                  <td>
                    <button className="eye-button" aria-label={`${isHidden ? "Show" : "Hide"} ${item.label}`} title={`${isHidden ? "Show" : "Hide"} on map`} onClick={(event) => { event.stopPropagation(); props.onToggleVisibility(key); }}>
                      {isHidden ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!props.items.length && <p className="empty-state">No map items yet</p>}
      </div>
    </section>
  );
}

export function ErrorMessage({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  if (!message) return null;
  return <div className="error-message" role="alert"><span>{message}</span><button aria-label="Dismiss error" onClick={onDismiss}>×</button></div>;
}

function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

function EyeOffIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a15 15 0 0 1-3.1 3.6M6.2 6.3C3.5 8 2 12 2 12s3.5 6 10 6a10 10 0 0 0 3-.5" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
}