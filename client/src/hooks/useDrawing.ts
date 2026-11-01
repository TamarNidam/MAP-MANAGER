// Owns active drawing modes and editable feature geometry.
import { useCallback, useEffect, useState } from "react";
import { createCircleDraft } from "../geometry/circles";
import { centroidOfRing } from "../geometry/centroid";
import { geoJsonToLeaflet, leafletToGeoJson, type LeafletPosition } from "../geometry/coordinates";
import { copyCoordinates } from "../geometry/transforms";
import type { DrawingShape } from "../map/coords";
import type { PendingPolygon, Selection, TableItem } from "../types/map";

export type GeometrySession =
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

type UseDrawingOptions = {
  activeLayerId?: string;
  addObjectDraft: (draft: { id: string; objectType: string; point: [number, number]; layerId?: string }) => void;
  addPolygonDraft: (draft: PendingPolygon) => void;
  objectTypes: { id: string }[];
  setSelected: (selection: Selection) => void;
};

export function useDrawing({ activeLayerId, addObjectDraft, addPolygonDraft, objectTypes, setSelected }: UseDrawingOptions) {
  const [geometrySession, setGeometrySession] = useState<GeometrySession | null>(null);
  const [detailsResetToken, setDetailsResetToken] = useState(0);
  const [drawing, setDrawing] = useState<DrawingShape | null>(null);
  const [addingObject, setAddingObject] = useState<string | null>(null);
  const [selectedPolygonShape, setSelectedPolygonShape] = useState<DrawingShape>("Polygon");
  const [selectedObjectType, setSelectedObjectType] = useState("marker");
  const clearGeometrySession = useCallback(() => setGeometrySession(null), []);

  useEffect(() => {
    if (objectTypes.length && !objectTypes.some((type) => type.id === selectedObjectType)) {
      setSelectedObjectType(objectTypes[0].id);
    }
  }, [objectTypes, selectedObjectType]);

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

  const addPolygon = (shape: DrawingShape, resetConfirmation: () => void) => {
    setAddingObject(null);
    resetConfirmation();
    setDrawing(shape);
  };

  const addObject = (type: string, resetConfirmation: () => void) => {
    setDrawing(null);
    resetConfirmation();
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
        setGeometrySession({ ...geometrySession, coordinates, shape, radiusMeters: undefined, mode: null });
      }
      setDrawing(null);
      return;
    }
    const shape = drawing?.toLowerCase() as PendingPolygon["shape"] ?? "polygon";
    const draftGeometry = shape === "circle" && coordinates[0]?.[0]
      ? createCircleDraft(center, geoJsonToLeaflet(coordinates[0][0] as [number, number]))
      : { coordinates, center: centroidOfRing(coordinates[0]), shape: shape ?? "polygon" };
    addPolygonDraft({ id, ...draftGeometry, layerId: activeLayerId });
    setSelected({ kind: "polygon", id });
    setDrawing(null);
  };

  const placeObject = (point: [number, number]) => {
    if (!addingObject) return;
    const id = crypto.randomUUID();
    addObjectDraft({ id, objectType: addingObject, point, layerId: activeLayerId });
    setSelected({ kind: "object", id });
    setAddingObject(null);
  };

  const cancelDrawing = () => {
    if (geometrySession) cancelGeometry();
    else { setDrawing(null); setAddingObject(null); }
  };

  return {
    activeLayerId,
    geometrySession,
    setGeometrySession,
    clearGeometrySession,
    detailsResetToken,
    drawing,
    setDrawing,
    addingObject,
    setAddingObject,
    selectedPolygonShape,
    setSelectedPolygonShape,
    selectedObjectType,
    setSelectedObjectType,
    geometryPending,
    applyGeometry,
    startGeometryEdit,
    stopGeometryMode,
    cancelGeometry,
    moveObject,
    editPolygonGeometry,
    addPolygon,
    addObject,
    onPolygonDrawn,
    placeObject,
    cancelDrawing,
  };
}
