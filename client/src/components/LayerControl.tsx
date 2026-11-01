import { useState } from "react";
import type { LayerDto, LayerRequest } from "../api/types";

type LayerDraft = LayerRequest;

export type LayerControlProps = {
  layers: LayerDto[];
  activeLayerId: string;
  hiddenLayerIds: Set<string>;
  onSetActive: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onCreate: (layer: LayerRequest) => Promise<void>;
  onUpdate: (id: string, layer: LayerRequest) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const defaultDraft = (): LayerDraft => ({ name: "", color: "#0F6B63" });

export function LayerControl(props: LayerControlProps) {
  const [expanded, setExpanded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, LayerDraft>>({});
  const [newLayer, setNewLayer] = useState(defaultDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const visibleCount = props.layers.filter((layer) => !props.hiddenLayerIds.has(layer.id)).length;

  const create = async () => {
    setError("");
    setBusy("new");
    try {
      await props.onCreate(newLayer);
      setNewLayer(defaultDraft());
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create layer.");
    } finally {
      setBusy("");
    }
  };

  const save = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;
    setError("");
    setBusy(id);
    try {
      await props.onUpdate(id, draft);
      setDrafts((current) => { const next = { ...current }; delete next[id]; return next; });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update layer.");
    } finally {
      setBusy("");
    }
  };

  const remove = async (id: string) => {
    setError("");
    setBusy(id);
    try {
      await props.onDelete(id);
      setDrafts((current) => { const next = { ...current }; delete next[id]; return next; });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete layer.");
    } finally {
      setBusy("");
    }
  };

  const updateDraft = (layer: LayerDto, update: Partial<LayerDraft>) => {
    setDrafts((current) => ({
      ...current,
      [layer.id]: { name: current[layer.id]?.name ?? layer.name, color: current[layer.id]?.color ?? layer.color, ...update },
    }));
  };

  return (
    <div className="layers-control">
      <select aria-label="Active layer" value={props.activeLayerId} onChange={(event) => props.onSetActive(event.target.value)}>
        {props.layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
      </select>
      <button className="layers-summary" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
        <span>Layers</span><span>{visibleCount}/{props.layers.length}</span><span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="layers-content" role="dialog" aria-label="Manage layers">
          {props.layers.map((layer) => {
            const draft = drafts[layer.id] ?? { name: layer.name, color: layer.color };
            const changed = draft.name !== layer.name || draft.color !== layer.color;
            const isBusy = busy === layer.id;
            return (
              <div className="layer-row" key={layer.id}>
                <button className="layer-eye" aria-label={`${props.hiddenLayerIds.has(layer.id) ? "Show" : "Hide"} ${layer.name}`} onClick={() => props.onToggleVisibility(layer.id)}>
                  {props.hiddenLayerIds.has(layer.id) ? <EyeOffIcon /> : <EyeIcon />}
                </button>
                <span className="layer-color-dot" style={{ backgroundColor: draft.color }} />
                <input aria-label={`${layer.name} name`} value={draft.name} onChange={(event) => updateDraft(layer, { name: event.target.value })} />
                <input aria-label={`${layer.name} color`} type="color" value={draft.color} onChange={(event) => updateDraft(layer, { color: event.target.value.toUpperCase() })} />
                {changed && <button className="layer-action" disabled={isBusy} onClick={() => void save(layer.id)}>Save</button>}
                {layer.name.trim().toLowerCase() !== "default" && !layer.isDefault && <button className="layer-action layer-delete" disabled={isBusy} onClick={() => void remove(layer.id)}>Delete</button>}
              </div>
            );
          })}
          <div className="new-layer-row">
            <input aria-label="New layer name" placeholder="New layer name" value={newLayer.name} onChange={(event) => setNewLayer({ ...newLayer, name: event.target.value })} />
            <input aria-label="New layer color" type="color" value={newLayer.color} onChange={(event) => setNewLayer({ ...newLayer, color: event.target.value.toUpperCase() })} />
            <button className="button button-secondary" disabled={!newLayer.name.trim() || busy === "new"} onClick={() => void create()}>New layer</button>
          </div>
          {error && <div className="details-error" role="alert">{error}</div>}
        </div>
      )}
    </div>
  );
}

function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

function EyeOffIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a15 15 0 0 1-3.1 3.6M6.2 6.3C3.5 8 2 12 2 12s3.5 6 10 6a10 10 0 0 0 3-.5" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
}
