import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api/client";
import type { MapObjectDto, PolygonDto } from "./api/types";
import { ErrorMessage, MapDataPanel, ObjectsPanel, PolygonPanel } from "./components/Panels";
import { MapView } from "./components/MapView";
import { leafletToGeoJson, type DrawingShape, type LeafletPosition } from "./map/coords";
import { useMapQueries } from "./hooks/useMapQueries";
import type { PendingObject, PendingPolygon, Selection, TableItem } from "./types/map";

export default function App() {
  const queryClient = useQueryClient();
  const { objects, polygons, layers, objectTypes } = useMapQueries();
  const [pendingObjects, setPendingObjects] = useState<PendingObject[]>([]);
  const [pendingPolygons, setPendingPolygons] = useState<PendingPolygon[]>([]);
  const [selected, setSelected] = useState<Selection>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [selectedType, setSelectedType] = useState("marker");
  const [drawing, setDrawing] = useState<DrawingShape | null>(null);
  const [addingObject, setAddingObject] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [navigationRequest, setNavigationRequest] = useState<{ kind: "object" | "polygon"; id: string; center: TableItem["center"]; requestId: number } | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const navigationRequestId = useRef(0);

  const defaultLayer = layers.data?.find((layer) => layer.name.toLowerCase() === "default");
  const savedObjects = objects.data ?? [];
  const savedPolygons = polygons.data ?? [];
  const types = objectTypes.data ?? [];

  useEffect(() => {
    if (types.length && !types.some((type) => type.id === selectedType)) setSelectedType(types[0].id);
  }, [types, selectedType]);

  useEffect(() => {
    if (!selected) return;
    rowRefs.current.get(`${selected.kind}:${selected.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["objects"] }),
    queryClient.invalidateQueries({ queryKey: ["polygons"] }),
  ]);

  const saveObjects = useMutation({
    mutationFn: (items: PendingObject[]) => api.createObjects(items.map((item, index) => ({
      name: `${types.find((type) => type.id === item.objectType)?.label ?? "Object"} ${savedObjects.length + index + 1}`,
      objectType: item.objectType,
      layerId: defaultLayer!.id,
      createdBy: "Map Manager",
      coordinates: leafletToGeoJson(item.point),
    }))),
    onSuccess: async (created, items) => {
      queryClient.setQueryData<MapObjectDto[]>(["objects"], (current) => [...created, ...(current ?? [])]);
      if (selected?.kind === "object") {
        const index = items.findIndex((item) => item.id === selected.id);
        if (index >= 0 && created[index]) setSelected({ kind: "object", id: created[index].id });
      }
      setPendingObjects([]);
      await refresh();
    },
    onError: (error) => setErrorMessage(error.message),
  });

  const savePolygons = useMutation({
    mutationFn: (items: PendingPolygon[]) => api.createPolygons(items.map((item, index) => ({
      name: `Polygon ${savedPolygons.length + index + 1}`,
      layerId: defaultLayer!.id,
      createdBy: "Map Manager",
      coordinates: item.coordinates,
    }))),
    onSuccess: async (created, items) => {
      queryClient.setQueryData<PolygonDto[]>(["polygons"], (current) => [...created, ...(current ?? [])]);
      if (selected?.kind === "polygon") {
        const index = items.findIndex((item) => item.id === selected.id);
        if (index >= 0 && created[index]) setSelected({ kind: "polygon", id: created[index].id });
      }
      setPendingPolygons([]);
      await refresh();
    },
    onError: (error) => setErrorMessage(error.message),
  });

  const deleteObject = useMutation({
    mutationFn: (id: string) => api.deleteObject(id),
    onSuccess: async () => { setSelected(null); await refresh(); },
    onError: (error) => setErrorMessage(error.message),
  });

  const deletePolygon = useMutation({
    mutationFn: (id: string) => api.deletePolygon(id),
    onSuccess: async () => { setSelected(null); await refresh(); },
    onError: (error) => setErrorMessage(error.message),
  });

  const deleteAllPolygons = useMutation({
    mutationFn: api.deleteAllPolygons,
    onSuccess: async () => { setPendingPolygons([]); setSelected(null); setConfirmDeleteAll(false); await refresh(); },
    onError: (error) => setErrorMessage(error.message),
  });

  const items = useMemo(() => {
    const result: TableItem[] = [
      ...savedObjects.map((item: MapObjectDto): TableItem => ({
        id: item.id, kind: "object", label: item.name, center: item.center, createdAt: item.createdAt, saved: true,
      })),
      ...savedPolygons.map((item: PolygonDto): TableItem => ({
        id: item.id, kind: "polygon", label: item.name, center: item.center, createdAt: item.createdAt, saved: true,
      })),
      ...pendingObjects.map((item, index): TableItem => ({
        id: item.id, kind: "object", label: `${types.find((type) => type.id === item.objectType)?.label ?? "Object"} ${savedObjects.length + index + 1}`,
        center: { lat: item.point[0], lon: item.point[1] }, createdAt: "", saved: false,
      })),
      ...pendingPolygons.map((item, index): TableItem => ({
        id: item.id, kind: "polygon", label: `Polygon ${savedPolygons.length + index + 1}`,
        center: { lat: item.center[0], lon: item.center[1] }, createdAt: "", saved: false,
      })),
    ];
    return result.sort((left, right) => {
      if (!left.saved && right.saved) return -1;
      if (left.saved && !right.saved) return 1;
      return right.createdAt.localeCompare(left.createdAt);
    });
  }, [pendingObjects, pendingPolygons, savedObjects, savedPolygons, types]);

  const addPolygon = (shape: DrawingShape) => {
    setAddingObject(false);
    setConfirmDeleteAll(false);
    setDrawing(shape);
  };

  const onPolygonDrawn = (coordinates: number[][][], center: LeafletPosition) => {
    const id = crypto.randomUUID();
    setPendingPolygons((current) => [...current, { id, coordinates, center }]);
    setSelected({ kind: "polygon", id });
    setDrawing(null);
  };

  const placeObject = (point: [number, number]) => {
    if (!addingObject) return;
    const id = crypto.randomUUID();
    setPendingObjects((current) => [...current, { id, objectType: selectedType, point }]);
    setSelected({ kind: "object", id });
    setAddingObject(false);
  };

  const deleteSelected = (kind: "object" | "polygon") => {
    if (selected?.kind !== kind) return;
    const pending = kind === "object" ? pendingObjects : pendingPolygons;
    if (pending.some((item) => item.id === selected.id)) {
      if (kind === "object") setPendingObjects((current) => current.filter((item) => item.id !== selected.id));
      else setPendingPolygons((current) => current.filter((item) => item.id !== selected.id));
      setSelected(null);
      return;
    }
    if (kind === "object") deleteObject.mutate(selected.id);
    else deletePolygon.mutate(selected.id);
  };

  const handlePolygonDelete = () => {
    if (selected?.kind === "polygon") {
      deleteSelected("polygon");
      setConfirmDeleteAll(false);
      return;
    }
    if (!confirmDeleteAll) {
      setConfirmDeleteAll(true);
      return;
    }
    deleteAllPolygons.mutate();
  };

  const toggleVisibility = (key: string) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const navigateToItem = (item: TableItem) => {
    setSelected({ kind: item.kind, id: item.id });
    navigationRequestId.current += 1;
    setNavigationRequest({ kind: item.kind, id: item.id, center: item.center, requestId: navigationRequestId.current });
  };

  const loading = objects.isLoading || polygons.isLoading || layers.isLoading || objectTypes.isLoading;
  const queryError = [objects.error, polygons.error, layers.error, objectTypes.error].find(Boolean);
  const error = errorMessage || queryError?.message || "";
  const unsavedCount = pendingObjects.length + pendingPolygons.length;

  return (
    <main className="workspace">
      <header className="top-bar">
        <div className="top-brand"><span className="brand-mark"><span /></span><span>MAP<span className="brand-light">MANAGER</span></span></div>
        <div className={`save-status${unsavedCount ? " has-unsaved" : " is-saved"}`} role="status">
          <span className="status-dot" />{unsavedCount ? `${unsavedCount} unsaved` : "All changes saved"}
        </div>
      </header>
      <section className="map-region" aria-label="Interactive map">
        <MapView
          objects={savedObjects}
          polygons={savedPolygons}
          pendingObjects={pendingObjects}
          pendingPolygons={pendingPolygons}
          hidden={hidden}
          selected={selected}
          drawing={drawing}
          addingObject={addingObject}
          selectedObjectType={selectedType}
          navigationRequest={navigationRequest}
          onSelect={(next) => { setSelected(next); setConfirmDeleteAll(false); }}
          onObjectPlace={placeObject}
          onPolygonDrawn={onPolygonDrawn}
          onCancelDrawing={() => { setDrawing(null); setAddingObject(false); }}
        />
        <div className="map-attribution">Tel Aviv, Israel <span>·</span> OpenStreetMap</div>
      </section>
      <aside className="sidebar">
        <ErrorMessage message={error} onDismiss={() => setErrorMessage("")} />
        {!defaultLayer && !layers.isLoading && <div className="error-message" role="alert">Default layer was not found.</div>}
        {loading && <div className="loading-line">Loading map data…</div>}
        <PolygonPanel
          pendingCount={pendingPolygons.length}
          hasPolygonSelection={selected?.kind === "polygon"}
          hasAnyPolygons={savedPolygons.length > 0 || pendingPolygons.length > 0}
          confirmDeleteAll={confirmDeleteAll}
          onAdd={addPolygon}
          onSave={() => savePolygons.mutate(pendingPolygons)}
          onDelete={handlePolygonDelete}
        />
        <ObjectsPanel
          types={types}
          selectedType={selectedType}
          pendingCount={pendingObjects.length}
          hasObjectSelection={selected?.kind === "object"}
          onChoose={setSelectedType}
          onAdd={() => { setDrawing(null); setConfirmDeleteAll(false); setAddingObject(true); }}
          onSave={() => saveObjects.mutate(pendingObjects)}
          onDelete={() => deleteSelected("object")}
        />
        <MapDataPanel
          items={items}
          selected={selected}
          hidden={hidden}
          rowRefs={rowRefs}
          onSelect={(next) => { setSelected(next); setConfirmDeleteAll(false); }}
          onDoubleClick={navigateToItem}
          onToggleVisibility={toggleVisibility}
        />
        {addingObject && <div className="mode-banner">Click the map to place a {types.find((type) => type.id === selectedType)?.label ?? "object"}<button onClick={() => setAddingObject(false)} aria-label="Cancel placement">×</button></div>}
        {drawing && <div className="mode-banner">{drawing === "Polygon" ? "Click vertices; double-click the final vertex or click the first point to close" : drawing === "Rectangle" ? "Click two opposite corners" : "Click the center, then set the radius"}<button onClick={() => setDrawing(null)} aria-label="Cancel drawing">×</button></div>}
      </aside>
    </main>
  );
}