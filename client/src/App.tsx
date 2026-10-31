import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { api } from "./api/client";
import type { MapDataPageDto } from "./api/types";
import { DrawPanel } from "./components/DrawPanel";
import { MapDataPanel } from "./components/MapDataPanel.tsx";
import { DetailsCard, type EditableFields } from "./components/DetailsCard";
import { LayersPanel } from "./components/LayersPanel";
import { MapView } from "./components/MapView";
import { queryKeys } from "./api/queryKeys";
import { leafletToGeoJson, type DrawingShape, type LeafletPosition } from "./map/coords";
import { useMapQueries } from "./hooks/useMapQueries";
import type { PendingObject, PendingPolygon, Selection, TableItem } from "./types/map";
import { useMapFilters } from "./hooks/useMapFilters";

type GeometrySession =
  | {
    kind: "object";
    id: string;
    originalPoint: [number, number];
    point: [number, number];
    mode: "move" | null;
  }
  | {
    kind: "polygon";
    id: string;
    originalCoordinates: number[][][];
    coordinates: number[][][];
    originalShape: "polygon" | "rectangle" | "circle";
    shape: "polygon" | "rectangle" | "circle";
    originalRadiusMeters?: number;
    radiusMeters?: number;
    mode: "vertices" | "redraw" | null;
  };

function offsetPosition(lat: number, lon: number): [number, number] {
  const offsetMeters = 14;
  const nextLat = Math.min(90, lat + offsetMeters / 111_320);
  const nextLon = Math.min(180, lon + offsetMeters / (111_320 * Math.max(Math.cos(lat * Math.PI / 180), 0.000001)));
  return [nextLat, nextLon];
}

function offsetPolygon(coordinates: number[][][]): number[][][] {
  return coordinates.map((ring) => ring.map(([lon, lat]) => {
    const [nextLat, nextLon] = offsetPosition(lat, lon);
    return [nextLon, nextLat];
  }));
}

function copyCoordinates(coordinates: number[][][]): number[][][] {
  return coordinates.map((ring) => ring.map((position) => [...position]));
}

function distanceMeters(first: [number, number], second: [number, number]): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = radians(second[0] - first[0]);
  const deltaLon = radians(second[1] - first[1]);
  const firstLat = radians(first[0]);
  const secondLat = radians(second[0]);
  const haversine = Math.sin(deltaLat / 2) ** 2 + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLon / 2) ** 2;
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export default function App() {
  const queryClient = useQueryClient();
  const filters = useMapFilters();
  const { mapData, layers, objectTypes, polygonOptions } = useMapQueries(filters.mapDataQuery, filters.generation);
  const [pendingObjects, setPendingObjects] = useState<PendingObject[]>([]);
  const [pendingPolygons, setPendingPolygons] = useState<PendingPolygon[]>([]);
  const [selected, setSelected] = useState<Selection>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(() => new Set());
  const [activeLayerId, setActiveLayerId] = useState("");
  const [geometrySession, setGeometrySession] = useState<GeometrySession | null>(null);
  const [detailsResetToken, setDetailsResetToken] = useState(0);
  const [drawing, setDrawing] = useState<DrawingShape | null>(null);
  const [addingObject, setAddingObject] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [savingDrafts, setSavingDrafts] = useState(false);
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
  const allLayers = layers.data ?? [];
  const activeLayer = allLayers.find((layer) => layer.id === activeLayerId) ?? defaultLayer ?? allLayers[0];
  const layerColors = useMemo(() => Object.fromEntries((layers.data ?? []).map((layer) => [layer.id, layer.color])), [layers.data]);
  const savedItems = useMemo(() => mapData.data?.pages.flatMap((page) => page.items) ?? [], [mapData.data]);

  useEffect(() => {
    if (activeLayerId && allLayers.some((layer) => layer.id === activeLayerId)) return;
    if (activeLayer) setActiveLayerId(activeLayer.id);
  }, [activeLayerId, activeLayer, allLayers]);

  useEffect(() => {
    loadAllCancelled.current = true;
    setLoadAllActive(false);
    setLoadAllProgress("");
    setLoadAllStopped(false);
  }, [filters.generation]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.mapDataRoot });

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

  const saveDrafts = async () => {
    if (savingDrafts || (!pendingObjects.length && !pendingPolygons.length)) return;
    setSavingDrafts(true);
    setErrorMessage("");
    const objectDrafts = pendingObjects;
    const polygonDrafts = pendingPolygons;
    const objectRequest = objectDrafts.length
      ? api.createObjects(objectDrafts.map((item, index) => ({
        name: item.name ?? `${types.find((type) => type.id === item.objectType)?.label ?? "Object"} ${savedItems.length + index + 1}`,
        objectType: item.objectType,
        layerId: item.layerId ?? activeLayer!.id,
        createdBy: "Map Manager",
        ...(item.color ? { color: item.color } : {}),
        coordinates: leafletToGeoJson(item.point),
      })))
      : undefined;
    const polygonRequest = polygonDrafts.length
      ? api.createPolygons(polygonDrafts.map((item, index) => ({
        name: item.name ?? `Polygon ${savedItems.length + index + 1}`,
        layerId: item.layerId ?? activeLayer!.id,
        createdBy: "Map Manager",
        ...(item.color ? { color: item.color } : {}),
        ...(item.shape ? { shape: item.shape } : {}),
        ...(item.shape === "circle" && item.radiusMeters !== undefined ? { radiusMeters: item.radiusMeters } : {}),
        coordinates: item.coordinates,
      })))
      : undefined;

    try {
      const [objectResult, polygonResult] = await Promise.all([
        objectRequest
          ? objectRequest.then((value) => ({ value }), (reason: unknown) => ({ reason }))
          : Promise.resolve(undefined),
        polygonRequest
          ? polygonRequest.then((value) => ({ value }), (reason: unknown) => ({ reason }))
          : Promise.resolve(undefined),
      ]);
      const failures: string[] = [];
      let saved = false;

      if (objectResult && "value" in objectResult) {
        saved = true;
        setPendingObjects((current) => current.filter((item) => !objectDrafts.some((draft) => draft.id === item.id)));
        setSelected((current) => {
          if (current?.kind !== "object") return current;
          const index = objectDrafts.findIndex((item) => item.id === current.id);
          return index >= 0 && objectResult.value[index] ? { kind: "object", id: objectResult.value[index].id } : current;
        });
      } else if (objectResult && "reason" in objectResult) {
        failures.push(`Objects: ${objectResult.reason instanceof Error ? objectResult.reason.message : String(objectResult.reason)}`);
      }

      if (polygonResult && "value" in polygonResult) {
        saved = true;
        setPendingPolygons((current) => current.filter((item) => !polygonDrafts.some((draft) => draft.id === item.id)));
        setSelected((current) => {
          if (current?.kind !== "polygon") return current;
          const index = polygonDrafts.findIndex((item) => item.id === current.id);
          return index >= 0 && polygonResult.value[index] ? { kind: "polygon", id: polygonResult.value[index].id } : current;
        });
      } else if (polygonResult && "reason" in polygonResult) {
        failures.push(`Polygons: ${polygonResult.reason instanceof Error ? polygonResult.reason.message : String(polygonResult.reason)}`);
      }

      if (saved) {
        try {
          await refresh();
        } catch (error) {
          failures.push(`Saved, but the list could not be refreshed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (failures.length) setErrorMessage(failures.join(" "));
    } finally {
      setSavingDrafts(false);
    }
  };

  const createLayer = async (layer: { name: string; color: string }) => {
    const created = await api.createLayer(layer);
    await queryClient.invalidateQueries({ queryKey: queryKeys.layers });
    setActiveLayerId(created.id);
  };

  const updateLayer = async (id: string, layer: { name: string; color: string }) => {
    await api.updateLayer(id, layer);
    await queryClient.invalidateQueries({ queryKey: queryKeys.layers });
  };

  const deleteLayer = async (id: string) => {
    await api.deleteLayer(id);
    await queryClient.invalidateQueries({ queryKey: queryKeys.layers });
    setHiddenLayerIds((current) => new Set([...current].filter((hiddenId) => hiddenId !== id)));
    if (activeLayerId === id) {
      setActiveLayerId(allLayers.find((layer) => layer.id !== id)?.id ?? "");
    }
  };

  const items = useMemo(() => {
    const drafts: TableItem[] = [
      ...pendingObjects.map((item, index): TableItem => {
        const label = item.name ?? `${types.find((type) => type.id === item.objectType)?.label ?? "Object"} ${savedItems.length + index + 1}`;
        return { ...item, kind: "object", label, name: label, layerId: item.layerId ?? activeLayer?.id ?? "", center: { lat: item.point[0], lon: item.point[1] }, createdAt: "", saved: false };
      }),
      ...pendingPolygons.map((item, index): TableItem => {
        const label = item.name ?? `Polygon ${savedItems.length + index + 1}`;
        return { ...item, kind: "polygon", label, name: label, layerId: item.layerId ?? activeLayer?.id ?? "", createdAt: "", saved: false };
      }),
    ];
    return [...drafts, ...savedItems.map((item): TableItem => ({ ...item, label: item.name, saved: true }))];
  }, [pendingObjects, pendingPolygons, savedItems, types, activeLayer]);

  useEffect(() => {
    if (!selected) return;
    const item = items.find((entry) => entry.kind === selected.kind && entry.id === selected.id);
    if (item && hiddenLayerIds.has(item.layerId)) {
      setSelected(null);
      setGeometrySession(null);
    }
  }, [hiddenLayerIds, items, selected]);

  const geometryPending = geometrySession !== null && (
    geometrySession.kind === "object"
      ? geometrySession.point[0] !== geometrySession.originalPoint[0] || geometrySession.point[1] !== geometrySession.originalPoint[1]
      : JSON.stringify(geometrySession.coordinates) !== JSON.stringify(geometrySession.originalCoordinates)
        || geometrySession.shape !== geometrySession.originalShape
        || geometrySession.radiusMeters !== geometrySession.originalRadiusMeters
  );

  const applyGeometry = (item: TableItem): TableItem => {
    if (!geometrySession || geometrySession.kind !== item.kind || geometrySession.id !== item.id) return item;
    if (item.kind === "object" && geometrySession.kind === "object") {
      return item.saved
        ? { ...item, coordinates: leafletToGeoJson(geometrySession.point), center: { lat: geometrySession.point[0], lon: geometrySession.point[1] } }
        : { ...item, point: geometrySession.point, center: { lat: geometrySession.point[0], lon: geometrySession.point[1] } };
    }
    if (item.kind === "polygon" && geometrySession.kind === "polygon") {
      const positions = geometrySession.coordinates[0] ?? [];
      const ringLength = positions.length > 1 && positions[0][0] === positions[positions.length - 1][0] && positions[0][1] === positions[positions.length - 1][1]
        ? positions.length - 1
        : positions.length;
      const center = ringLength
        ? positions.slice(0, ringLength).reduce<[number, number]>((sum, [lon, lat]) => [sum[0] + lat / ringLength, sum[1] + lon / ringLength], [0, 0])
        : [item.center.lat, item.center.lon] as [number, number];
      return {
        ...item,
        coordinates: geometrySession.coordinates,
        center: { lat: center[0], lon: center[1] },
        shape: geometrySession.shape,
        radiusMeters: geometrySession.shape === "circle" ? geometrySession.radiusMeters : undefined,
      };
    }
    return item;
  };

  const visibleItems = useMemo(
    () => items.filter((item) => !hiddenLayerIds.has(item.layerId)).map(applyGeometry),
    [items, hiddenLayerIds, geometrySession],
  );

  const handleSelect = (next: Selection) => {
    if (geometrySession) return;
    setSelected(next);
    setConfirmDeleteAll(false);
  };

  const startGeometryEdit = (item: TableItem, mode: "move" | "vertices" | "redraw") => {
    if (geometrySession) {
      if (geometrySession.kind === item.kind && geometrySession.id === item.id) {
        if (geometrySession.kind === "object" && mode === "move") setGeometrySession({ ...geometrySession, mode });
        if (geometrySession.kind === "polygon" && mode !== "move") setGeometrySession({ ...geometrySession, mode });
      }
      if (mode === "redraw" && item.kind === "polygon") {
        const shape = geometrySession.kind === "polygon" ? geometrySession.shape : item.shape ?? "polygon";
        setDrawing(shape === "rectangle" ? "Rectangle" : shape === "circle" ? "Circle" : "Polygon");
      }
      return;
    }
    if (item.kind === "object") {
      const point = item.saved ? [item.center.lat, item.center.lon] as [number, number] : item.point;
      setGeometrySession({ kind: "object", id: item.id, originalPoint: point, point, mode: "move" });
      return;
    }
    const shape = item.shape ?? "polygon";
    setGeometrySession({
      kind: "polygon",
      id: item.id,
      originalCoordinates: copyCoordinates(item.coordinates),
      coordinates: copyCoordinates(item.coordinates),
      originalShape: shape,
      shape,
      originalRadiusMeters: item.radiusMeters ?? undefined,
      radiusMeters: item.radiusMeters ?? undefined,
      mode: mode === "redraw" ? "redraw" : "vertices",
    });
    if (mode === "redraw") setDrawing(shape === "rectangle" ? "Rectangle" : shape === "circle" ? "Circle" : "Polygon");
  };

  const stopGeometryMode = () => {
    setGeometrySession((current) => current ? { ...current, mode: null } as GeometrySession : null);
    setDrawing(null);
  };

  const cancelGeometry = () => {
    setGeometrySession(null);
    setDrawing(null);
    setDetailsResetToken((value) => value + 1);
  };

  useEffect(() => {
    if (!geometrySession) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      cancelGeometry();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [geometrySession]);

  const moveObject = (id: string, point: [number, number]) => {
    setGeometrySession((current) => current?.kind === "object" && current.id === id ? { ...current, point } : current);
  };

  const editPolygonGeometry = (id: string, coordinates: number[][][]) => {
    setGeometrySession((current) => {
      if (current?.kind !== "polygon" || current.id !== id) return current;
      return { ...current, coordinates, shape: "polygon", radiusMeters: undefined, mode: "vertices" };
    });
  };

  useEffect(() => {
    if (!selected) return;
    rowRefs.current.get(`${selected.kind}:${selected.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [items, selected]);

  useEffect(() => {
    if (selected && !items.some((item) => item.id === selected.id && item.kind === selected.kind)) {
      setSelected(null);
      setGeometrySession(null);
    }
  }, [items, selected]);

  const addPolygon = (shape: DrawingShape) => {
    setAddingObject(null);
    setConfirmDeleteAll(false);
    setDrawing(shape);
  };

  const addObject = (type: string) => {
    setDrawing(null);
    setConfirmDeleteAll(false);
    setAddingObject(type);
  };

  const onPolygonDrawn = (coordinates: number[][][], center: LeafletPosition) => {
    const id = crypto.randomUUID();
    if (geometrySession?.kind === "polygon" && geometrySession.mode === "redraw") {
      const shape = geometrySession.shape;
      const firstPoint = coordinates[0]?.[0];
      const radiusMeters = shape === "circle" && firstPoint
        ? distanceMeters(center, [firstPoint[1], firstPoint[0]])
        : undefined;
      setGeometrySession({ ...geometrySession, coordinates, shape, radiusMeters, mode: null });
      setDrawing(null);
      return;
    }
    const shape = drawing?.toLowerCase() as PendingPolygon["shape"] ?? "polygon";
    setPendingPolygons((current) => [...current, { id, coordinates, center: { lat: center[0], lon: center[1] }, layerId: activeLayer?.id, shape }]);
    setSelected({ kind: "polygon", id });
    setDrawing(null);
  };

  const placeObject = (point: [number, number]) => {
    if (!addingObject) return;
    const id = crypto.randomUUID();
    setPendingObjects((current) => [...current, { id, objectType: addingObject, point, layerId: activeLayer?.id }]);
    setSelected({ kind: "object", id });
    setAddingObject(null);
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

  const handleDeleteAllPolygons = () => {
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

  const toggleLayerVisibility = (id: string) => {
    setHiddenLayerIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const navigateToItem = (item: TableItem) => {
    if (geometrySession) return;
    setSelected({ kind: item.kind, id: item.id });
    navigationRequestId.current += 1;
    setNavigationRequest({ item, requestId: navigationRequestId.current });
  };

  const saveDetails = async (item: TableItem, fields: EditableFields) => {
    const itemWithGeometry = applyGeometry(item);
    const objectPoint = geometrySession?.kind === "object" && geometrySession.id === item.id
      ? geometrySession.point
      : item.kind === "object" && !item.saved
        ? item.point
        : undefined;
    const polygonShape = itemWithGeometry.kind === "polygon" && geometrySession?.kind === "polygon"
      ? geometrySession.shape
      : fields.shape;
    const polygonRadius = itemWithGeometry.kind === "polygon" && geometrySession?.kind === "polygon"
      ? geometrySession.radiusMeters
      : fields.radiusMeters;
    if (!item.saved) {
      if (item.kind === "object") {
        setPendingObjects((current) => current.map((draft) => draft.id === item.id
          ? { ...draft, point: objectPoint ?? draft.point, name: fields.name, color: fields.color || undefined, layerId: fields.layerId, objectType: fields.objectType }
          : draft));
      } else {
        setPendingPolygons((current) => current.map((draft) => draft.id === item.id
          ? {
            ...draft,
            coordinates: itemWithGeometry.kind === "polygon" ? itemWithGeometry.coordinates : draft.coordinates,
            center: itemWithGeometry.kind === "polygon" ? itemWithGeometry.center : draft.center,
            name: fields.name,
            color: fields.color || undefined,
            layerId: fields.layerId,
            shape: polygonShape,
            radiusMeters: polygonShape === "circle" ? polygonRadius : undefined,
          }
          : draft));
      }
      setGeometrySession(null);
      return;
    }

    if (item.kind === "object") {
      const coordinates = geometrySession?.kind === "object" && geometrySession.id === item.id
        ? leafletToGeoJson(geometrySession.point)
        : item.coordinates;
      await api.updateObject(item.id, {
        name: fields.name,
        objectType: fields.objectType,
        layerId: fields.layerId,
        ...(fields.color ? { color: fields.color } : {}),
        coordinates,
      });
    } else {
      await api.updatePolygon(item.id, {
        name: fields.name,
        layerId: fields.layerId,
        ...(fields.color ? { color: fields.color } : {}),
        shape: polygonShape,
        ...(polygonShape === "circle" && polygonRadius !== undefined ? { radiusMeters: polygonRadius } : {}),
        coordinates: itemWithGeometry.kind === "polygon" ? itemWithGeometry.coordinates : item.coordinates,
      });
    }
    await refresh();
    setGeometrySession(null);
  };

  const duplicateItem = (item: TableItem) => {
    const id = crypto.randomUUID();
    const name = `${item.name} (copy)`;
    if (item.kind === "object") {
      const point = offsetPosition(item.center.lat, item.center.lon);
      setPendingObjects((current) => [...current, {
        id,
        name,
        objectType: item.objectType,
        layerId: activeLayer?.id ?? item.layerId,
        color: item.color ?? undefined,
        point,
      }]);
    } else {
      const center = offsetPosition(item.center.lat, item.center.lon);
      setPendingPolygons((current) => [...current, {
        id,
        name,
        layerId: activeLayer?.id ?? item.layerId,
        color: item.color ?? undefined,
        shape: item.shape ?? "polygon",
        radiusMeters: item.radiusMeters ?? undefined,
        coordinates: offsetPolygon(item.coordinates),
        center: { lat: center[0], lon: center[1] },
      }]);
    }
    setSelected({ kind: item.kind, id });
  };

  const deleteDetailsItem = async (item: TableItem) => {
    if (item.saved) {
      if (item.kind === "object") await api.deleteObject(item.id);
      else await api.deletePolygon(item.id);
      await refresh();
    } else if (item.kind === "object") {
      setPendingObjects((current) => current.filter((draft) => draft.id !== item.id));
    } else {
      setPendingPolygons((current) => current.filter((draft) => draft.id !== item.id));
    }
    setSelected(null);
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
  const selectedItem = selected ? items.find((item) => item.kind === selected.kind && item.id === selected.id) : undefined;
  const selectedWithGeometry = selectedItem ? applyGeometry(selectedItem) : undefined;
  const geometryMode = geometrySession?.mode ?? null;

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
          items={visibleItems}
          hidden={hidden}
          hiddenLayerIds={hiddenLayerIds}
          layerColors={layerColors}
          selected={selected}
          geometryEdit={geometrySession ? { kind: geometrySession.kind, id: geometrySession.id, mode: geometrySession.mode } : null}
          drawing={drawing}
          addingObject={Boolean(addingObject)}
          navigationRequest={navigationRequest}
          mapViewOnly={filters.mapViewOnly}
          onViewportChange={filters.reportViewport}
          loadedCount={loadedCount}
          moreAvailable={Boolean(mapData.hasNextPage)}
          filterNotice={filters.isFiltered ? filterNotice : ""}
          activeFilterCount={filters.activeFilterCount}
          onResetFilters={filters.resetAll}
          onSelect={handleSelect}
          onObjectMoveEnd={moveObject}
          onPolygonGeometryChange={editPolygonGeometry}
          onObjectPlace={placeObject}
          onPolygonDrawn={onPolygonDrawn}
          onCancelDrawing={() => {
            if (geometrySession) cancelGeometry();
            else { setDrawing(null); setAddingObject(null); }
          }}
        />
        {selectedWithGeometry && (
          <DetailsCard
            key={`${selectedWithGeometry.kind}:${selectedWithGeometry.id}`}
            item={selectedWithGeometry}
            layers={layers.data ?? []}
            objectTypes={types}
            onSaveChanges={saveDetails}
            onDuplicate={duplicateItem}
            onDelete={deleteDetailsItem}
            geometryMode={geometryMode}
            geometryPending={Boolean(geometryPending)}
            geometrySessionActive={geometrySession !== null}
            resetToken={detailsResetToken}
            onStartGeometry={(mode) => startGeometryEdit(selectedWithGeometry, mode)}
            onStopGeometryMode={stopGeometryMode}
            onCancel={cancelGeometry}
          />
        )}
        <div className="map-attribution">Tel Aviv, Israel <span>·</span> OpenStreetMap</div>
      </section>
      <aside className="sidebar">
        {!defaultLayer && !layers.isLoading && <div className="error-message" role="alert">Default layer was not found.</div>}
        {loading && <div className="loading-line">Loading map data…</div>}
        <DrawPanel
          objectTypes={types}
          pendingCount={unsavedCount}
          hasSelection={Boolean(selected)}
          confirmDeleteAll={confirmDeleteAll}
          error={error}
          onDismissError={() => setErrorMessage("")}
          actionsDisabled={geometrySession !== null || savingDrafts || !activeLayer}
          onAddPolygon={addPolygon}
          onAddObject={addObject}
          onSave={() => { void saveDrafts(); }}
          onDeleteSelected={() => { if (selected) deleteSelected(selected.kind); }}
          onDeleteAllPolygons={handleDeleteAllPolygons}
        />
        <MapDataPanel
          items={visibleItems}
          selected={selected}
          hidden={hidden}
          layerColors={layerColors}
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
          onSelect={handleSelect}
          onDoubleClick={navigateToItem}
          onToggleVisibility={toggleVisibility}
        />
        <LayersPanel
          layers={allLayers}
          activeLayerId={activeLayer?.id ?? ""}
          hiddenLayerIds={hiddenLayerIds}
          onSetActive={setActiveLayerId}
          onToggleVisibility={toggleLayerVisibility}
          onCreate={createLayer}
          onUpdate={updateLayer}
          onDelete={deleteLayer}
        />
        {addingObject && <div className="mode-banner">Click the map to place a {types.find((type) => type.id === addingObject)?.label ?? "object"}<button onClick={() => setAddingObject(null)} aria-label="Cancel placement">×</button></div>}
        {drawing && <div className="mode-banner">{drawing === "Polygon" ? "Click vertices; double-click the final vertex or click the first point to close" : drawing === "Rectangle" ? "Click two opposite corners" : "Click the center, then set the radius"}<button onClick={() => setDrawing(null)} aria-label="Cancel drawing">×</button></div>}
      </aside>
    </main>
  );
}