import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { api } from "./api/client";
import type { MapDataPageDto } from "./api/types";
import { ErrorMessage, ObjectsPanel, PolygonPanel } from "./components/Panels";
import { MapDataPanel } from "./components/MapDataPanel.tsx";
import { MapView } from "./components/MapView";
import { queryKeys } from "./api/queryKeys";
import { leafletToGeoJson, type DrawingShape, type LeafletPosition } from "./map/coords";
import { useMapQueries } from "./hooks/useMapQueries";
import type { PendingObject, PendingPolygon, Selection, TableItem } from "./types/map";
import { useMapFilters } from "./hooks/useMapFilters";

export default function App() {
  const queryClient = useQueryClient();
  const filters = useMapFilters();
  const { mapData, layers, objectTypes, polygonOptions } = useMapQueries(filters.mapDataQuery, filters.generation);
  const [pendingObjects, setPendingObjects] = useState<PendingObject[]>([]);
  const [pendingPolygons, setPendingPolygons] = useState<PendingPolygon[]>([]);
  const [selected, setSelected] = useState<Selection>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [selectedType, setSelectedType] = useState("marker");
  const [drawing, setDrawing] = useState<DrawingShape | null>(null);
  const [addingObject, setAddingObject] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [navigationRequest, setNavigationRequest] = useState<{ item: TableItem; requestId: number } | null>(null);
  const [loadAllActive, setLoadAllActive] = useState(false);
  const [loadAllProgress, setLoadAllProgress] = useState("");
  const [loadAllStopped, setLoadAllStopped] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const navigationRequestId = useRef(0);
  const loadAllCancelled = useRef(false);

  const defaultLayer = layers.data?.find((layer) => layer.name.toLowerCase() === "default");
  const types = objectTypes.data ?? [];
  const savedItems = useMemo(() => mapData.data?.pages.flatMap((page) => page.items) ?? [], [mapData.data]);

  useEffect(() => {
    if (types.length && !types.some((type) => type.id === selectedType)) setSelectedType(types[0].id);
  }, [types, selectedType]);

  useEffect(() => {
    loadAllCancelled.current = true;
    setLoadAllActive(false);
    setLoadAllProgress("");
    setLoadAllStopped(false);
  }, [filters.generation]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.mapDataRoot });

  const saveObjects = useMutation({
    mutationFn: (items: PendingObject[]) => api.createObjects(items.map((item, index) => ({
      name: `${types.find((type) => type.id === item.objectType)?.label ?? "Object"} ${savedItems.length + index + 1}`,
      objectType: item.objectType,
      layerId: defaultLayer!.id,
      createdBy: "Map Manager",
      coordinates: leafletToGeoJson(item.point),
    }))),
    onSuccess: async (created, items) => {
      await refresh();
      if (selected?.kind === "object") {
        const index = items.findIndex((item) => item.id === selected.id);
        if (index >= 0 && created[index]) setSelected({ kind: "object", id: created[index].id });
      }
      setPendingObjects([]);
    },
    onError: (error) => setErrorMessage(error.message),
  });

  const savePolygons = useMutation({
    mutationFn: (items: PendingPolygon[]) => api.createPolygons(items.map((item, index) => ({
      name: `Polygon ${savedItems.length + index + 1}`,
      layerId: defaultLayer!.id,
      createdBy: "Map Manager",
      coordinates: item.coordinates,
    }))),
    onSuccess: async (created, items) => {
      await refresh();
      if (selected?.kind === "polygon") {
        const index = items.findIndex((item) => item.id === selected.id);
        if (index >= 0 && created[index]) setSelected({ kind: "polygon", id: created[index].id });
      }
      setPendingPolygons([]);
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
    const drafts: TableItem[] = [
      ...pendingObjects.map((item, index): TableItem => {
        const label = `${types.find((type) => type.id === item.objectType)?.label ?? "Object"} ${savedItems.length + index + 1}`;
        return { ...item, kind: "object", label, name: label, center: { lat: item.point[0], lon: item.point[1] }, createdAt: "", saved: false };
      }),
      ...pendingPolygons.map((item, index): TableItem => {
        const label = `Polygon ${savedItems.length + index + 1}`;
        return { ...item, kind: "polygon", label, name: label, createdAt: "", saved: false };
      }),
    ];
    return [...drafts, ...savedItems.map((item): TableItem => ({ ...item, label: item.name, saved: true }))];
  }, [pendingObjects, pendingPolygons, savedItems, types]);

  useEffect(() => {
    if (!selected) return;
    rowRefs.current.get(`${selected.kind}:${selected.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [items, selected]);

  useEffect(() => {
    if (selected && !items.some((item) => item.id === selected.id && item.kind === selected.kind)) setSelected(null);
  }, [items, selected]);

  const addPolygon = (shape: DrawingShape) => {
    setAddingObject(false);
    setConfirmDeleteAll(false);
    setDrawing(shape);
  };

  const onPolygonDrawn = (coordinates: number[][][], center: LeafletPosition) => {
    const id = crypto.randomUUID();
    setPendingPolygons((current) => [...current, { id, coordinates, center: { lat: center[0], lon: center[1] } }]);
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

  const toggleVisibility = (id: string) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const navigateToItem = (item: TableItem) => {
    setSelected({ kind: item.kind, id: item.id });
    navigationRequestId.current += 1;
    setNavigationRequest({ item, requestId: navigationRequestId.current });
  };

  const mapDataQueryKey = queryKeys.mapData(filters.mapDataQuery, filters.generation);
  const loadedCount = mapData.data?.pages.reduce((count, page) => count + page.items.length, 0) ?? 0;

  const loadAll = async () => {
    if (loadAllActive || mapData.isPlaceholderData || !mapData.hasNextPage) return;
    loadAllCancelled.current = false;
    setLoadAllStopped(false);
    setLoadAllProgress("");
    setLoadAllActive(true);
    try {
      let count = loadedCount;
      while (count < 1000 && !loadAllCancelled.current) {
        const current = queryClient.getQueryData<InfiniteData<MapDataPageDto>>(mapDataQueryKey);
        if (!current?.pages.at(-1)?.nextCursor) break;
        const result = await mapData.fetchNextPage();
        if (result.isFetchNextPageError || loadAllCancelled.current) break;
        const updated = queryClient.getQueryData<InfiniteData<MapDataPageDto>>(mapDataQueryKey);
        count = updated?.pages.reduce((total, page) => total + page.items.length, 0) ?? count;
        setLoadAllProgress(`Loaded ${count}...`);
      }
      const finalData = queryClient.getQueryData<InfiniteData<MapDataPageDto>>(mapDataQueryKey);
      const finalCount = finalData?.pages.reduce((total, page) => total + page.items.length, 0) ?? 0;
      if (!loadAllCancelled.current && finalCount >= 1000 && finalData?.pages.at(-1)?.nextCursor) setLoadAllStopped(true);
    } finally {
      setLoadAllActive(false);
    }
  };

  const cancelLoadAll = () => {
    loadAllCancelled.current = true;
    setLoadAllActive(false);
    void queryClient.cancelQueries({ queryKey: mapDataQueryKey, exact: true });
  };

  const loading = mapData.isLoading || layers.isLoading || objectTypes.isLoading || polygonOptions.isLoading;
  const queryError = [layers.error, objectTypes.error, polygonOptions.error].find(Boolean);
  const error = errorMessage || queryError?.message || "";
  const unsavedCount = pendingObjects.length + pendingPolygons.length;
  const filterNotice = filters.mapViewOnly
    ? "Showing only items that match the table filters and the current map view"
    : "Showing only items that match the table filters";

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
          items={items}
          hidden={hidden}
          selected={selected}
          drawing={drawing}
          addingObject={addingObject}
          navigationRequest={navigationRequest}
          mapViewOnly={filters.mapViewOnly}
          onViewportChange={filters.reportViewport}
          loadedCount={loadedCount}
          moreAvailable={Boolean(mapData.hasNextPage)}
          filterNotice={filters.isFiltered ? filterNotice : ""}
          activeFilterCount={filters.activeFilterCount}
          onResetFilters={filters.resetAll}
          onSelect={(next: Selection) => { setSelected(next); setConfirmDeleteAll(false); }}
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
          hasAnyPolygons={(polygonOptions.data?.length ?? 0) > 0 || pendingPolygons.length > 0}
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
          filters={filters}
          objectTypes={types}
          polygonOptions={polygonOptions.data ?? []}
          loadedCount={loadedCount}
          hasNextPage={Boolean(mapData.hasNextPage)}
          isLoading={mapData.isLoading && items.length === 0}
          isFetching={mapData.isFetching && !mapData.isFetchingNextPage}
          error={mapData.error?.message ?? ""}
          isPlaceholderData={mapData.isPlaceholderData}
          isFetchingNextPage={mapData.isFetchingNextPage}
          loadAllActive={loadAllActive}
          loadAllProgress={loadAllProgress}
          loadAllStopped={loadAllStopped}
          onLoadMore={() => { void mapData.fetchNextPage(); }}
          onLoadAll={() => { void loadAll(); }}
          onCancelLoadAll={cancelLoadAll}
          onSelect={(next: Selection) => { setSelected(next); setConfirmDeleteAll(false); }}
          onDoubleClick={navigateToItem}
          onToggleVisibility={toggleVisibility}
        />
        {addingObject && <div className="mode-banner">Click the map to place a {types.find((type) => type.id === selectedType)?.label ?? "object"}<button onClick={() => setAddingObject(false)} aria-label="Cancel placement">×</button></div>}
        {drawing && <div className="mode-banner">{drawing === "Polygon" ? "Click vertices; double-click the final vertex or click the first point to close" : drawing === "Rectangle" ? "Click two opposite corners" : "Click the center, then set the radius"}<button onClick={() => setDrawing(null)} aria-label="Cancel drawing">×</button></div>}
      </aside>
    </main>
  );
}