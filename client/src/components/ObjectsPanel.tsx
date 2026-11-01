import type { ObjectTypeDto } from "../api/types";
import { typeIconMarkup } from "../map/ObjectMarker";

type ObjectsPanelProps = {
  objectTypes: ObjectTypeDto[];
  selectedType: string;
  active: boolean;
  selected: boolean;
  pendingCount: number;
  actionsDisabled: boolean;
  onSelectType: (type: string) => void;
  onAdd: () => void;
  onCancelAdd: () => void;
  onSave: () => void;
  onDelete: () => void;
};

export function ObjectsPanel(props: ObjectsPanelProps) {
  return (
    <section className="panel draw-panel">
      <div className="panel-heading">
        <span className="panel-symbol object-symbol" />
        <h2>Objects</h2>
      </div>
      <div className="panel-actions">
        <select
          aria-label="Object type"
          value={props.selectedType}
          disabled={props.actionsDisabled || !props.objectTypes.length}
          onChange={(event) => props.onSelectType(event.target.value)}
        >
          {props.objectTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
        </select>
        {props.objectTypes.find((type) => type.id === props.selectedType) && (
          <span className="draw-type-icon" dangerouslySetInnerHTML={{ __html: typeIconMarkup(props.selectedType) }} />
        )}
        <button
          className={`button ${props.active ? "button-secondary" : "button-primary"}`}
          disabled={(props.actionsDisabled && !props.active) || (!props.active && !props.objectTypes.length)}
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
    </section>
  );
}
