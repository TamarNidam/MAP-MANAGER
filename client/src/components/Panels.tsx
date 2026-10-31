import { useState } from "react";
import type { ObjectTypeDto } from "../api/types";
import type { DrawingShape } from "../map/coords";
import { typeIconMarkup } from "../map/ObjectMarker";

type PolygonPanelProps = {
  pendingCount: number;
  hasPolygonSelection: boolean;
  hasAnyPolygons: boolean;
  confirmDeleteAll: boolean;
  actionsDisabled?: boolean;
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
          <button className="button button-primary" aria-haspopup="menu" aria-expanded={shapeMenuOpen} disabled={props.actionsDisabled} onClick={() => setShapeMenuOpen((open) => !open)}><span aria-hidden="true">＋</span> Add</button>
          {shapeMenuOpen && <div className="shape-menu" role="menu">{shapes.map((shape) => <button key={shape} role="menuitem" onClick={() => { props.onAdd(shape); setShapeMenuOpen(false); }}>{shape}</button>)}</div>}
        </div>
        <button className="button button-secondary" onClick={props.onSave} disabled={!props.pendingCount || props.actionsDisabled}>Save{props.pendingCount > 0 ? ` (${props.pendingCount})` : ""}</button>
        <button className="button button-danger" onClick={props.onDelete} disabled={props.actionsDisabled || (!props.hasPolygonSelection && !props.hasAnyPolygons)}>
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
  actionsDisabled?: boolean;
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
        <button className="button button-primary" onClick={props.onAdd} disabled={!props.types.length || props.actionsDisabled}><span aria-hidden="true">＋</span> Add</button>
        <button className="button button-secondary" onClick={props.onSave} disabled={!props.pendingCount || props.actionsDisabled}>Save{props.pendingCount > 0 ? ` (${props.pendingCount})` : ""}</button>
        <button className="button button-danger" onClick={props.onDelete} disabled={!props.hasObjectSelection || props.actionsDisabled}>Delete</button>
      </div>
      <p className="panel-hint">{props.pendingCount ? `${props.pendingCount} unsaved object${props.pendingCount === 1 ? "" : "s"}` : "Choose a type, then place it on the map"}</p>
    </section>
  );
}

export function ErrorMessage({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div className="error-message" role="alert">
      <span>{message}</span>
      <button aria-label="Dismiss error" onClick={onDismiss}>×</button>
    </div>
  );
}
