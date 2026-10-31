import { useState } from "react";
import type { ObjectTypeDto } from "../api/types";
import type { DrawingShape } from "../map/coords";
import { typeIconMarkup } from "../map/ObjectMarker";
import { ErrorMessage } from "./Panels";

type DrawPanelProps = {
  objectTypes: ObjectTypeDto[];
  pendingCount: number;
  hasSelection: boolean;
  actionsDisabled?: boolean;
  activeAdd: "polygon" | "object" | null;
  confirmDeleteAll: boolean;
  error: string;
  onDismissError: () => void;
  onAddPolygon: (shape: DrawingShape) => void;
  onAddObject: (type: string) => void;
  onCancelAdd: () => void;
  onSave: () => void;
  onDeleteSelected: () => void;
  onDeleteAllPolygons: () => void;
};

const shapes: Array<{ value: DrawingShape; label: string }> = [
  { value: "Polygon", label: "polygon" },
  { value: "Rectangle", label: "rectangle" },
  { value: "Circle", label: "circle" },
];

export function DrawPanel(props: DrawPanelProps) {
  const [selectedShape, setSelectedShape] = useState<DrawingShape>("Polygon");
  const [selectedType, setSelectedType] = useState("marker");
  const [openMenu, setOpenMenu] = useState<"shape" | "type" | "more" | null>(null);
  const selectedObjectType = props.objectTypes.find((type) => type.id === selectedType);
  const polygonActive = props.activeAdd === "polygon";
  const objectActive = props.activeAdd === "object";

  return (
    <section className="panel draw-panel">
      {props.error && <ErrorMessage message={props.error} onDismiss={props.onDismissError} />}
      <div className="draw-heading"><h2>Draw</h2></div>
      <div className="draw-row">
        <span className="draw-row-label">Polygon</span>
        <div className="split-button">
          <button
            className={`button ${polygonActive ? "button-secondary" : "button-primary"} draw-add`}
            disabled={props.actionsDisabled && !polygonActive}
            onClick={() => polygonActive ? props.onCancelAdd() : props.onAddPolygon(selectedShape)}
          >
            {polygonActive ? "Cancel" : <><span aria-hidden="true">＋</span> Add</>}
          </button>
          <button className="button button-secondary draw-choice" aria-label={`Selected polygon shape: ${selectedShape.toLowerCase()}. Choose another shape`} aria-haspopup="menu" aria-expanded={openMenu === "shape"} onClick={() => setOpenMenu(openMenu === "shape" ? null : "shape")}>
            <span className="draw-choice-label">{selectedShape.toLowerCase()}</span><span className="draw-choice-caret" aria-hidden="true">▾</span>
          </button>
          {openMenu === "shape" && (
            <div className="draw-menu" role="menu">
              {shapes.map((shape) => (
                <button key={shape.value} role="menuitemradio" aria-checked={selectedShape === shape.value} onClick={() => {
                  setSelectedShape(shape.value);
                  setOpenMenu(null);
                  if (polygonActive) props.onCancelAdd();
                }}>
                  {shape.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="draw-row">
        <span className="draw-row-label">Objects</span>
        <div className="split-button">
          <button
            className={`button ${objectActive ? "button-secondary" : "button-primary"} draw-add`}
            disabled={(props.actionsDisabled && !objectActive) || (!objectActive && !props.objectTypes.length)}
            onClick={() => objectActive ? props.onCancelAdd() : props.onAddObject(selectedType)}
          >
            {objectActive ? "Cancel" : <><span aria-hidden="true">＋</span> Add</>}
          </button>
          <button className="button button-secondary draw-choice" aria-label={`Selected object type: ${selectedObjectType?.label ?? selectedType}. Choose another type`} aria-haspopup="menu" aria-expanded={openMenu === "type"} onClick={() => setOpenMenu(openMenu === "type" ? null : "type")}>
            {selectedObjectType && <span className="draw-type-icon" dangerouslySetInnerHTML={{ __html: typeIconMarkup(selectedType) }} />}
            <span className="draw-choice-label">{selectedObjectType?.label ?? selectedType}</span><span className="draw-choice-caret" aria-hidden="true">▾</span>
          </button>
          {openMenu === "type" && (
            <div className="draw-menu object-type-menu" role="menu">
              {props.objectTypes.map((type) => (
                <button key={type.id} role="menuitemradio" aria-checked={selectedType === type.id} onClick={() => {
                  setSelectedType(type.id);
                  setOpenMenu(null);
                  if (objectActive) props.onCancelAdd();
                }}>
                  <span className="draw-type-icon" dangerouslySetInnerHTML={{ __html: typeIconMarkup(type.id) }} />
                  {type.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="draw-footer">
        <button className="button button-primary" disabled={!props.pendingCount || props.actionsDisabled} onClick={props.onSave}>Save ({props.pendingCount})</button>
        <button className="button button-danger" disabled={!props.hasSelection || props.actionsDisabled} onClick={props.onDeleteSelected}>Delete</button>
        <div className="split-button more-menu-anchor">
          <button className="button button-secondary more-button" aria-label="More actions" aria-expanded={openMenu === "more"} onClick={() => setOpenMenu(openMenu === "more" ? null : "more")}>⋯</button>
          {openMenu === "more" && (
            <div className="draw-menu more-menu" role="menu">
              <button role="menuitem" onClick={() => {
                if (props.confirmDeleteAll) setOpenMenu(null);
                props.onDeleteAllPolygons();
              }}>{props.confirmDeleteAll ? "Confirm?" : "Delete all polygons"}</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
