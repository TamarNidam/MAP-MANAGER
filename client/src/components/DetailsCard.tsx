import { useEffect, useState } from "react";
import type { LayerDto, ObjectTypeDto } from "../api/types";
import type { TableItem } from "../types/map";

type EditableFields = {
  name: string;
  color: string;
  layerId: string;
  objectType: string;
  shape: "polygon" | "rectangle" | "circle";
  radiusMeters?: number;
};

type DetailsCardProps = {
  item: TableItem;
  layers: LayerDto[];
  objectTypes: ObjectTypeDto[];
  onSaveChanges: (item: TableItem, fields: EditableFields) => Promise<void>;
  onDuplicate: (item: TableItem) => void;
  onDelete: (item: TableItem) => Promise<void>;
  geometryMode: "move" | "vertices" | "redraw" | null;
  geometryPending: boolean;
  geometrySessionActive: boolean;
  resetToken: number;
  onStartGeometry: (mode: "move" | "vertices" | "redraw") => void;
  onStopGeometryMode: () => void;
  onCancel: () => void;
};

const swatches = ["#0F6B63", "#2563EB", "#DC2626", "#D97706", "#7C3AED"];

function fieldsFor(item: TableItem): EditableFields {
  return {
    name: item.name,
    color: item.color ?? "",
    layerId: item.layerId,
    objectType: item.kind === "object" ? item.objectType : "",
    shape: item.kind === "polygon" ? item.shape ?? "polygon" : "polygon",
    radiusMeters: item.kind === "polygon" ? item.radiusMeters ?? undefined : undefined,
  };
}

function sameFields(left: EditableFields, right: EditableFields): boolean {
  return left.name === right.name
    && left.color === right.color
    && left.layerId === right.layerId
    && left.objectType === right.objectType
    && left.shape === right.shape
    && left.radiusMeters === right.radiusMeters;
}

export function DetailsCard({ item, layers, objectTypes, onSaveChanges, onDuplicate, onDelete, geometryMode, geometryPending, geometrySessionActive, resetToken, onStartGeometry, onStopGeometryMode, onCancel }: DetailsCardProps) {
  const [original, setOriginal] = useState(() => fieldsFor(item));
  const [fields, setFields] = useState(() => fieldsFor(item));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const reset = fieldsFor(item);
    setOriginal(reset);
    setFields(reset);
    setError("");
  }, [resetToken]);
  const layerColor = layers.find((layer) => layer.id === fields.layerId)?.color ?? "#0F6B63";
  const changed = !sameFields(fields, original) || geometryPending;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving || deleting) return;
      setFields(original);
      setError("");
      if (geometrySessionActive) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleting, geometrySessionActive, onCancel, original, saving]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSaveChanges(item, fields);
      setOriginal(fields);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setError("");
    try {
      await onDelete(item);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete item.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="details-card" aria-label={`${item.name} details`}>
      <header className="details-heading">
        <h2>{item.saved ? "Item details" : "Draft details"}</h2>
        <span className="details-kind">{item.kind}</span>
      </header>
      <label className="details-field">Name
        <input value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} />
      </label>
      <div className="details-field">
        <span>Color</span>
        <div className="color-controls">
          <button type="button" className={`color-swatch layer-swatch${fields.color ? "" : " is-selected"}`} style={{ backgroundColor: layerColor }} title="Use layer color" aria-label="Use layer color" onClick={() => setFields({ ...fields, color: "" })} />
          {swatches.map((color) => (
            <button key={color} type="button" className={`color-swatch${fields.color.toLowerCase() === color.toLowerCase() ? " is-selected" : ""}`} style={{ backgroundColor: color }} title={color} aria-label={`Set color ${color}`} onClick={() => setFields({ ...fields, color })} />
          ))}
          <input type="color" aria-label="Choose a color" value={fields.color || layerColor} onChange={(event) => setFields({ ...fields, color: event.target.value.toUpperCase() })} />
          {fields.color && <button type="button" className="color-clear" onClick={() => setFields({ ...fields, color: "" })}>Layer</button>}
        </div>
      </div>
      <label className="details-field">Layer
        <select value={fields.layerId} onChange={(event) => setFields({ ...fields, layerId: event.target.value })}>
          {layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
        </select>
      </label>
      {item.kind === "object" && (
        <label className="details-field">Type
          <select value={fields.objectType} onChange={(event) => setFields({ ...fields, objectType: event.target.value })}>
            {objectTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
          </select>
        </label>
      )}
      <div className="geometry-actions">
        {item.kind === "object" ? (
          <button className={`button button-secondary${geometryMode === "move" ? " is-active" : ""}`} disabled={geometryMode !== null && geometryMode !== "move"} onClick={() => geometryMode === "move" ? onStopGeometryMode() : onStartGeometry("move")}>
            {geometryMode === "move" ? "Done moving" : "Move"}
          </button>
        ) : (
          <>
            <button className={`button button-secondary${geometryMode === "vertices" ? " is-active" : ""}`} disabled={geometryMode !== null && geometryMode !== "vertices"} onClick={() => geometryMode === "vertices" ? onStopGeometryMode() : onStartGeometry("vertices")}>
              {geometryMode === "vertices" ? "Done editing vertices" : "Edit vertices"}
            </button>
            <button className="button button-secondary" disabled={geometryMode !== null && geometryMode !== "redraw"} onClick={() => onStartGeometry("redraw")}>
              {geometryMode === "redraw" ? "Redraw on map…" : "Redraw"}
            </button>
          </>
        )}
        {geometryPending && <span className="geometry-pending">Geometry pending</span>}
      </div>
      <dl className="details-readonly">
        <div><dt>Created by</dt><dd>{item.saved ? item.createdBy : "—"}</dd></div>
        <div><dt>Created</dt><dd>{item.saved ? new Date(item.createdAt).toLocaleString() : "Draft"}</dd></div>
        <div><dt>Center</dt><dd>{item.center.lat.toFixed(5)}, {item.center.lon.toFixed(5)}</dd></div>
        {item.kind === "polygon" && <div><dt>Shape</dt><dd>{item.shape ?? "polygon"}</dd></div>}
      </dl>
      {error && <div className="details-error" role="alert">{error}</div>}
      <div className="details-actions">
        <button className="button button-primary" disabled={!changed || saving || deleting} onClick={() => void save()}>{saving ? "Saving…" : "Save changes"}</button>
        <button className="button button-secondary" disabled={(!changed && !geometryPending && !geometrySessionActive) || saving || deleting} onClick={() => { setFields(original); setError(""); onCancel(); }}>Cancel</button>
        <button className="button button-secondary" disabled={geometrySessionActive || saving || deleting} onClick={() => onDuplicate(item)}>Duplicate</button>
        <button className="button button-danger" disabled={geometrySessionActive || saving || deleting} onClick={() => void remove()}>{deleting ? "Deleting…" : "Delete"}</button>
      </div>
    </section>
  );
}

export type { EditableFields };
