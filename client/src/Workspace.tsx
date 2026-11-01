import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api/client";
import { ObjectsPanel } from "./components/ObjectsPanel";
import { PolygonPanel } from "./components/PolygonPanel";
import { MapDataPanel } from "./components/MapDataPanel.tsx";
import { DetailsCard, type EditableFields } from "./components/DetailsCard";
import { MapView } from "./components/MapView";
import { queryKeys } from "./api/queryKeys";
import { createCircleDraft } from "./geometry/circles";
import { centroidOfRing } from "./geometry/centroid";
import { nextDefaultName } from "./geometry/defaultNames";
import { geoJsonToLeaflet, leafletToGeoJson, type LeafletPosition } from "./geometry/coordinates";
import type { DrawingShape } from "./map/coords";
import { useDrafts } from "./hooks/useDrafts";
import { useMapData } from "./hooks/useMapData";
import { useSelection } from "./hooks/useSelection";
import type { PendingPolygon, Selection, TableItem } from "./types/map";
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
    return leafletToGeoJson([nextLat, nextLon]);
  }));
}

function copyCoordinates(coordinates: number[][][]): number[][][] {
  return coordinates.map((ring) => ring.map((position) => [...position]));
}

export default function Workspace() {
  const queryClient = useQueryClient();
  const filters = useMapFilters();
  const mapState = useMapData(filters.mapDataQuery, filters.generation);
  const { mapData, layers, objectTypes, polygonOptions, loadedCount } = mapState;
  const drafts = useDrafts();
  const {
    objects: pendingObjects, polygons: pendingPolygons,
    addObject: addObjectDraft, addPolygon: addPolygonDraft,
    removeObject: removeObjectDraft, removePolygon: removePolygonDraft,
  } = drafts;
  const setPendingObjects = drafts.setObjects;
  const setPendingPolygons = drafts.setPolygons;
  const savingDrafts = drafts.saving;
  const {
    selected, setSelected, hidden, hiddenLayerIds, setHiddenLayerIds,
    toggleVisibility, toggleLayerVisibility,
  } = useSelection();
  const [activeLayerId, setActiveLayerId] = useState("");
  const [geometrySession, setGeometrySession] = useState<GeometrySession | null>(null);
  const [detailsResetToken, setDetailsResetToken] = useState(0);
  const [drawing, setDrawing] = useState<DrawingShape | null>(null);
  const [addingObject, setAddingObject] = useState<string | null>(null);
  const [selectedPolygonShape, setSelectedPolygonShape] = useState<DrawingShape>("Polygon");
  const [selectedObjectType, setSelectedObjectType] = useState("marker");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [navigationRequest, setNavigationRequest] = useState<{ item: TableItem; requestId: number } | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const navigationRequestId = useRef(0);

  const defaultLayer = layers.data?.find((layer) => layer.name.toLowerCase() === "default");
  const types = objectTypes.data ?? [];
  const allLayers = layers.data ?? [];
  const activeLayer = allLayers.find((layer) => layer.id === activeLayerId) ?? defaultLayer ?? allLayers[0];
  const layerColors = useMemo(() => Object.fromEntries((layers.data ?? []).map((layer) => [layer.id, layer.color])), [layers.data]);
  const savedItems = useMemo(() => mapData.data?.pages.flatMap((page) => page.items) ?? [], [mapData.data]);
  const defaultObjectNames = useMemo(() => {
    const names = [
      ...savedItems.map((item) => item.name),
      ...pendingObjects.flatMap((item) => item.name ? [item.name] : []),
    ];
    return new Map(pendingObjects.map((item) => {
      const prefix = types.find((type) => type.id === item.objectType)?.label ?? "Object";
      const name = item.name ?? nextDefaultName(prefix, names);
      names.push(name);
      return [item.id, name];
    }));
  }, [pendingObjects, savedItems, types]);
  const defaultPolygonNames = useMemo(() => {
    const names = [
      ...savedItems.map((item) => item.name),
      ...pendingPolygons.flatMap((item) => item.name ? [item.name] : []),
    ];
    return new Map(pendingPolygons.map((item) => {
      const name = item.name ?? nextDefaultName("Polygon", names);
      names.push(name);
      return [item.id, name];
    }));
  }, [pendingPolygons, savedItems]);

  useEffect(() => {
    if (activeLayerId && allLayers.some((layer) => layer.id === activeLayerId)) return;
    if (activeLayer) setActiveLayerId(activeLayer.id);
  }, [activeLayerId, activeLayer, allLayers]);

  useEffect(() => {
    if (types.length && !types.some((type) => type.id === selectedObjectType)) {
      setSelectedObjectType(types[0].id);
    }
  }, [types, selectedObjectType]);

  useEffect(() => {
    if (filters.within && mapData.error instanceof ApiError && mapData.error.status === 404) {
      filters.setWithin("");
      setErrorMessage("The selected inside polygon no longer exists; the filter was cleared.");
    }
  }, [filters.within, filters.setWithin, mapData.error]);

  const refresh = mapState.invalidateMapData;
  const refreshPolygonsAndMapData = mapState.invalidatePolygonsAndMapData;

  const deleteObject = useMutation({
    mutationFn: (id: string) => api.deleteObject(id),
    onSuccess: async () => { setSelected(null); await refresh(); },
    onError: (error) => setErrorMessage(error.message),
  });

  const deletePolygon = useMutation({
    mutationFn: (id: string) => api.deletePolygon(id),
    onSuccess: async (_result, id) => {
      setSelected(null);
      if (filters.within === id) filters.setWithin("");
      await refreshPolygonsAndMapData();
    },
    onError: (error) => setErrorMessage(error.message),
  });

  const deleteAllPolygons = useMutation({
    mutationFn: api.deleteAllPolygons,
    onSuccess: async () => {
      drafts.setPolygons([]);
      setSelected(null);
      setConfirmDeleteAll(false);
      if (filters.within && (polygonOptions.data ?? []).some((polygon) => polygon.id === filters.within)) {
        filters.setWithin("");
      }
      await refreshPolygonsAndMapData();
    },
    onError: (error) => setErrorMessage(error.message),
  });

  const saveDrafts = async () => {
    await drafts.save(async ({ objects: objectDrafts, polygons: polygonDrafts }) => {
      setErrorMessage("");
      try {
        const objectPayload = objectDrafts.map((item) => ({
          name: item.name ?? defaultObjectNames.get(item.id)!,
          objectType: item.objectType,
          layerId: item.layerId ?? activeLayer!.id,
          createdBy: "Map Manager",
          ...(item.color ? { color: item.color } : {}),
          coordinates: leafletToGeoJson(item.point),
        }));
        const polygonPayload = polygonDrafts.map((item) => ({
          name: item.name ?? defaultPolygonNames.get(item.id)!,
          layerId: item.layerId ?? activeLayer!.id,
          createdBy: "Map Manager",
          ...(item.color ? { color: item.color } : {}),
          ...(item.shape ? { shape: item.shape } : {}),
          ...(item.shape === "circle" && item.radiusMeters !== undefined ? { radiusMeters: item.radiusMeters } : {}),
          coordinates: item.coordinates,
        }));
        const objectRequest = objectPayload.length ? api.createObjects(objectPayload) : undefined;
        const polygonRequest = polygonPayload.length ? api.createPolygons(polygonPayload) : undefined;

        const [objectResult, polygonResult] = await Promise.all([
          objectRequest
            ? objectRequest.then((value) => ({ value }), (reason: unknown) => ({ reason }))
            : Promise.resolve(undefined),
          polygonRequest
            ? polygonRequest.then((value) => ({ value }), (reason: unknown) => ({ reason }))
            : Promise.resolve(undefined),
        ]);
        const failures: string[] = [];
        if (objectResult && "reason" in objectResult) {
          failures.push(`Objects: ${objectResult.reason instanceof Error ? objectResult.reason.message : String(objectResult.reason)}`);
        }
        if (polygonResult && "reason" in polygonResult) {
          failures.push(`Polygons: ${polygonResult.reason instanceof Error ? polygonResult.reason.message : String(polygonResult.reason)}`);
        }

        const objectSaved = objectResult && "value" in objectResult;
        const polygonSaved = polygonResult && "value" in polygonResult;
        if (failures.length) {
          const rollbacks = [
            ...(objectSaved ? objectResult.value.map((item) => api.deleteObject(item.id)) : []),
            ...(polygonSaved ? polygonResult.value.map((item) => api.deletePolygon(item.id)) : []),
          ];
          const rollbackResults = await Promise.allSettled(rollbacks);
          const rollbackFailures = rollbackResults.flatMap((result) =>
            result.status === "rejected"
              ? [`Rollback failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`]
              : []);

          if (objectSaved || polygonSaved) {
            try {
              if (polygonSaved) await refreshPolygonsAndMapData();
              else await refresh();
            } catch (error) {
              rollbackFailures.push(`The list could not be refreshed: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
          setErrorMessage([...failures, ...rollbackFailures].join(" "));
          return;
        }

        if (objectSaved) {
          setPendingObjects((current) => current.filter((item) => !objectDrafts.some((draft) => draft.id === item.id)));
          setSelected((current) => {
            if (current?.kind !== "object") return current;
            const index = objectDrafts.findIndex((item) => item.id === current.id);
            return index >= 0 && objectResult.value[index] ? { kind: "object", id: objectResult.value[index].id } : current;
          });
        }
        if (polygonSaved) {
          setPendingPolygons((current) => current.filter((item) => !polygonDrafts.some((draft) => draft.id === item.id)));
          setSelected((current) => {
            if (current?.kind !== "polygon") return current;
            const index = polygonDrafts.findIndex((item) => item.id === current.id);
            return index >= 0 && polygonResult.value[index] ? { kind: "polygon", id: polygonResult.value[index].id } : current;
          });
        }

        if (objectSaved || polygonSaved) {
        try {
          if (polygonSaved) await refreshPolygonsAndMapData();
          else await refresh();
        } catch (error) {
            setErrorMessage(`Saved, but the list could not be refreshed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to save drafts.");
      }
    });
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
      setActiveLayerId(defaultLayer?.id ?? allLayers.find((layer) => layer.id !== id)?.id ?? "");
    }
    if (defaultLayer) {
      setPendingObjects((current) => current.map((draft) => draft.layerId === id ? { ...draft, layerId: defaultLayer.id } : draft));
      setPendingPolygons((current) => current.map((draft) => draft.layerId === id ? { ...draft, layerId: defaultLayer.id } : draft));
    }
  };

  const items = useMemo(() => {
    const drafts: TableItem[] = [
      ...pendingObjects.map((item): TableItem => {
        const label = defaultObjectNames.get(item.id)!;
        return { ...item, kind: "object", label, name: label, layerId: item.layerId ?? activeLayer?.id ?? "", center: { lat: item.point[0], lon: item.point[1] }, createdAt: "", saved: false };
      }),
      ...pendingPolygons.map((item): TableItem => {
        const label = defaultPolygonNames.get(item.id)!;
        return { ...item, kind: "polygon", label, name: label, layerId: item.layerId ?? activeLayer?.id ?? "", createdAt: "", saved: false };
      }),
    ];
    return [...drafts, ...savedItems.map((item): TableItem => ({ ...item, label: item.name, saved: true }))];
  }, [pendingObjects, pendingPolygons, savedItems, activeLayer, defaultObjectNames, defaultPolygonNames]);

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
      const center = geometrySession.coordinates[0]?.length
        ? centroidOfRing(geometrySession.coordinates[0])
        : item.center;
      return {
        ...item,
        coordinates: geometrySession.coordinates,
        center,
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
      if (shape === "circle" && coordinates[0]?.[0]) {
        const edgePoint = geoJsonToLeaflet(coordinates[0][0] as [number, number]);
        const circle = createCircleDraft(center, edgePoint);
        setGeometrySession({
          ...geometrySession,
          coordinates: circle.coordinates,
          shape: "circle",
          radiusMeters: circle.radiusMeters,
          mode: null,
        });
      } else {
        setGeometrySession({
          ...geometrySession,
          coordinates,
          shape,
          radiusMeters: undefined,
          mode: null,
        });
      }
      setDrawing(null);
      return;
    }
    const shape = drawing?.toLowerCase() as PendingPolygon["shape"] ?? "polygon";
    const draftGeometry = shape === "circle" && coordinates[0]?.[0]
      ? createCircleDraft(center, geoJsonToLeaflet(coordinates[0][0] as [number, number]))
      : { coordinates, center: centroidOfRing(coordinates[0]), shape: shape ?? "polygon" };
    addPolygonDraft({ id, ...draftGeometry, layerId: activeLayer?.id });
    setSelected({ kind: "polygon", id });
    setDrawing(null);
  };

  const placeObject = (point: [number, number]) => {
    if (!addingObject) return;
    const id = crypto.randomUUID();
    addObjectDraft({ id, objectType: addingObject, point, layerId: activeLayer?.id });
    setSelected({ kind: "object", id });
    setAddingObject(null);
  };

  const deleteSelected = (kind: "object" | "polygon") => {
    if (selected?.kind !== kind) return;
    const pending = kind === "object" ? pendingObjects : pendingPolygons;
    if (pending.some((item) => item.id === selected.id)) {
      if (kind === "object") removeObjectDraft(selected.id);
      else removePolygonDraft(selected.id);
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
    if (item.kind === "polygon") await refreshPolygonsAndMapData();
    else await refresh();
    setGeometrySession(null);
  };

  const duplicateItem = (item: TableItem) => {
    const id = crypto.randomUUID();
    const name = `${item.name} (copy)`;
    if (item.kind === "object") {
      const point = offsetPosition(item.center.lat, item.center.lon);
      addObjectDraft({
        id,
        name,
        objectType: item.objectType,
        layerId: activeLayer?.id ?? item.layerId,
        color: item.color ?? undefined,
        point,
      });
    } else {
      const coordinates = offsetPolygon(item.coordinates);
      addPolygonDraft({
        id,
        name,
        layerId: activeLayer?.id ?? item.layerId,
        color: item.color ?? undefined,
        shape: item.shape ?? "polygon",
        radiusMeters: item.radiusMeters ?? undefined,
        coordinates,
        center: centroidOfRing(coordinates[0]),
      });
    }
    setSelected({ kind: item.kind, id });
  };

  const deleteDetailsItem = async (item: TableItem) => {
    if (item.saved) {
      if (item.kind === "object") {
        await api.deleteObject(item.id);
        await refresh();
      } else {
        await api.deletePolygon(item.id);
        if (filters.within === item.id) filters.setWithin("");
        await refreshPolygonsAndMapData();
      }
    } else if (item.kind === "object") {
      removeObjectDraft(item.id);
    } else {
      removePolygonDraft(item.id);
    }
    setSelected(null);
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
            onClose={() => {
              if (geometrySession) cancelGeometry();
              setSelected(null);
            }}
          />
        )}
        <div className="map-attribution">Tel Aviv, Israel <span>·</span> OpenStreetMap</div>
      </section>
      <aside className="sidebar">
        {!defaultLayer && !layers.isLoading && <div className="error-message" role="alert">Default layer was not found.</div>}
        {loading && <div className="loading-line">Loading map data…</div>}
        <PolygonPanel
          active={!geometrySession && Boolean(drawing) && !addingObject}
          selected={selected?.kind === "polygon"}
          pendingCount={unsavedCount}
          shape={selectedPolygonShape}
          confirmDeleteAll={confirmDeleteAll}
          actionsDisabled={geometrySession !== null || savingDrafts || !activeLayer}
          error={error}
          onDismissError={() => setErrorMessage("")}
          onShapeChange={(shape) => {
            setSelectedPolygonShape(shape);
            if (drawing) setDrawing(null);
          }}
          onAdd={() => addPolygon(selectedPolygonShape)}
          onCancelAdd={() => setDrawing(null)}
          onSave={() => { void saveDrafts(); }}
          onDelete={() => deleteSelected("polygon")}
          onDeleteAll={handleDeleteAllPolygons}
        />
        <ObjectsPanel
          objectTypes={types}
          selectedType={selectedObjectType}
          active={!geometrySession && Boolean(addingObject)}
          selected={selected?.kind === "object"}
          pendingCount={unsavedCount}
          actionsDisabled={geometrySession !== null || savingDrafts || !activeLayer}
          onSelectType={(type) => {
            setSelectedObjectType(type);
            if (addingObject) setAddingObject(null);
          }}
          onAdd={() => addObject(selectedObjectType)}
          onCancelAdd={() => setAddingObject(null)}
          onSave={() => { void saveDrafts(); }}
          onDelete={() => deleteSelected("object")}
        />
        <MapDataPanel
          view={{ items: visibleItems, selected, hidden, layerColors, rowRefs }}
          filters={filters}
          query={{ objectTypes: types, polygonOptions: polygonOptions.data ?? [] }}
          paging={{
            loadedCount,
            hasNextPage: Boolean(mapData.hasNextPage),
            isLoading: mapData.isLoading && items.length === 0,
            isFetching: mapData.isFetching && !mapData.isFetchingNextPage,
            error: mapData.error?.message ?? mapState.loadAllError,
            isPlaceholderData: mapData.isPlaceholderData,
            isFetchingNextPage: mapData.isFetchingNextPage,
            loadAllActive: mapState.loadAllActive,
            loadAllProgress: mapState.loadAllProgress,
            loadAllStopped: mapState.loadAllStopped,
          }}
          layers={{
            layers: allLayers,
            activeLayerId: activeLayer?.id ?? "",
            hiddenLayerIds,
            onSetActive: setActiveLayerId,
            onToggleVisibility: toggleLayerVisibility,
            onCreate: createLayer,
            onUpdate: updateLayer,
            onDelete: deleteLayer,
          }}
          actions={{
            onLoadMore: () => { void mapData.fetchNextPage(); },
            onLoadAll: () => { void mapState.loadAll(); },
            onCancelLoadAll: mapState.cancelLoadAll,
            onSelect: handleSelect,
            onDoubleClick: navigateToItem,
            onToggleVisibility: toggleVisibility,
          }}
        />
        {addingObject && <div className="mode-banner">Click the map to place a {types.find((type) => type.id === addingObject)?.label ?? "object"}<button onClick={() => setAddingObject(null)} aria-label="Cancel placement">×</button></div>}
        {drawing && <div className="mode-banner">{drawing === "Polygon" ? "Click vertices; double-click the final vertex or click the first point to close" : drawing === "Rectangle" ? "Click two opposite corners" : "Click the center, then set the radius"}<button onClick={() => setDrawing(null)} aria-label="Cancel drawing">×</button></div>}
      </aside>
    </main>
  );
}