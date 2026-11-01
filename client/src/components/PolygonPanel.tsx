import type { DrawingShape } from "../map/coords";
import { ErrorMessage } from "./Panels";

type PolygonPanelProps = {
  active: boolean;
  selected: boolean;
  pendingCount: number;
  shape: DrawingShape;
  confirmDeleteAll: boolean;
  actionsDisabled: boolean;
  error: string;
  onDismissError: () => void;
  onShapeChange: (shape: DrawingShape) => void;
  onAdd: () => void;
  onCancelAdd: () => void;
  onSave: () => void;
  onDelete: () => void;
  onDeleteAll: () => void;
};

export function PolygonPanel(props: PolygonPanelProps) {
  return (
    <section className="panel draw-panel">
      {props.error && <ErrorMessage message={props.error} onDismiss={props.onDismissError} />}
      <div className="panel-heading">
        <span className="panel-symbol polygon-symbol" />
        <h2>Polygon</h2>
      </div>
      <div className="panel-actions">
        <select
          aria-label="Polygon shape"
          value={props.shape}
          disabled={props.actionsDisabled}
          onChange={(event) => props.onShapeChange(event.target.value as DrawingShape)}
        >
          <option value="Polygon">Polygon</option>
          <option value="Rectangle">Rectangle</option>
          <option value="Circle">Circle</option>
        </select>
        <button
          className={`button ${props.active ? "button-secondary" : "button-primary"}`}
          disabled={props.actionsDisabled && !props.active}
          onClick={props.active ? props.onCancelAdd : props.onAdd}
        >
          {props.active ? "Cancel" : "＋ Add"}
        </button>
        <button className="button button-primary" disabled={!props.pendingCount || props.actionsDisabled} onClick={props.onSave}>
          Save ({props.pendingCount})
        </button>
        <button className="button button-danger" disabled={!props.selected || props.actionsDisabled} onClick={props.onDelete}>
          Delete
        </button>
      </div>
      <div className="polygon-delete-all">
        <button className="button button-danger" disabled={props.actionsDisabled} onClick={props.onDeleteAll}>
          {props.confirmDeleteAll ? "Confirm?" : "Delete all"}
        </button>
      </div>
    </section>
  );
}
