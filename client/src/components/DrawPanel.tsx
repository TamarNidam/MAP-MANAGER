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
  confirmDeleteAll: boolean;
  error: string;
  onDismissError: () => void;
  onAddPolygon: (shape: DrawingShape) => void;
  onAddObject: (type: string) => void;
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

  return (
    <section className="panel draw-panel">
      {props.error && <ErrorMessage message={props.error} onDismiss={props.onDismissError} />}
      <div className="draw-heading"><h2>Draw</h2></div>
      <div className="draw-row">
        <span className="draw-row-label">Polygon</span>
        <div className="split-button">
          <button className="button button-primary draw-add" disabled={props.actionsDisabled} onClick={() => props.onAddPolygon(selectedShape)}>
            <span aria-hidden="true">＋</span> Add
          </button>
          <button className="button button-primary split-toggle" aria-label="Choose polygon shape" aria-haspopup="menu" aria-expanded={openMenu === "shape"} onClick={() => setOpenMenu(openMenu === "shape" ? null : "shape")}>▾</button>
          {openMenu === "shape" && (
            <div className="draw-menu" role="menu">
              {shapes.map((shape) => (
                <button key={shape.value} role="menuitemradio" aria-checked={selectedShape === shape.value} onClick={() => { setSelectedShape(shape.value); setOpenMenu(null); }}>
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
          <button className="button button-primary draw-add" disabled={props.actionsDisabled || !props.objectTypes.length} onClick={() => props.onAddObject(selectedType)}>
            <span aria-hidden="true">＋</span> Add
          </button>
          <button className="button button-primary split-toggle" aria-label="Choose object type" aria-haspopup="menu" aria-expanded={openMenu === "type"} onClick={() => setOpenMenu(openMenu === "type" ? null : "type")}>▾</button>
          {openMenu === "type" && (
            <div className="draw-menu object-type-menu" role="menu">
              {props.objectTypes.map((type) => (
                <button key={type.id} role="menuitemradio" aria-checked={selectedType === type.id} onClick={() => { setSelectedType(type.id); setOpenMenu(null); }}>
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
