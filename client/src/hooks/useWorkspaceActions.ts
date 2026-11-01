// Coordinates saved-feature actions, draft edits, and related error feedback.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client";
import type { EditableFields } from "../components/DetailsCard";
import { centroidOfRing } from "../geometry/centroid";
import { leafletToGeoJson } from "../geometry/coordinates";
import { offsetPolygon, offsetPosition } from "../geometry/transforms";
import type { TableItem } from "../types/map";
import type { useDrafts } from "./useDrafts";
import type { useDrawing } from "./useDrawing";
import type { useMapData } from "./useMapData";
import type { useMapFilters } from "./useMapFilters";
import type { useSelection } from "./useSelection";

type UseWorkspaceActionsOptions = {
  drafts: ReturnType<typeof useDrafts>;
  drawing: ReturnType<typeof useDrawing>;
  filters: ReturnType<typeof useMapFilters>;
  mapState: ReturnType<typeof useMapData>;
  selection: ReturnType<typeof useSelection>;
};

export function useWorkspaceActions({ drafts, drawing, filters, mapState, selection }: UseWorkspaceActionsOptions) {
  const [errorMessage, setErrorMessage] = useState("");

  const deleteObject = useMutation({
    mutationFn: (id: string) => api.deleteObject(id),
    onSuccess: async () => { selection.setSelected(null); await mapState.invalidateMapData(); },
    onError: (error) => setErrorMessage(error.message),
  });

  const deletePolygon = useMutation({
    mutationFn: (id: string) => api.deletePolygon(id),
    onSuccess: async (_result, id) => {
      selection.setSelected(null);
      if (filters.within === id) filters.setWithin("");
      await mapState.invalidatePolygonsAndMapData();
    },
    onError: (error) => setErrorMessage(error.message),
  });

  const deleteAllPolygons = useMutation({
    mutationFn: api.deleteAllPolygons,
    onSuccess: async () => {
      drafts.setPolygons([]);
      selection.setSelected(null);
      selection.setConfirmDeleteAll(false);
      if (filters.within && (mapState.polygonOptions.data ?? []).some((polygon) => polygon.id === filters.within)) {
        filters.setWithin("");
      }
      await mapState.invalidatePolygonsAndMapData();
    },
    onError: (error) => setErrorMessage(error.message),
  });

  const deleteSelected = (kind: "object" | "polygon") => {
    const selected = selection.selected;
    if (selected?.kind !== kind) return;
    const pending = kind === "object" ? drafts.objects : drafts.polygons;
    if (pending.some((item) => item.id === selected.id)) {
      if (kind === "object") drafts.removeObject(selected.id);
      else drafts.removePolygon(selected.id);
      selection.setSelected(null);
      return;
    }
    if (kind === "object") deleteObject.mutate(selected.id);
    else deletePolygon.mutate(selected.id);
  };

  const handleDeleteAllPolygons = () => {
    if (!selection.confirmDeleteAll) {
      selection.setConfirmDeleteAll(true);
      return;
    }
    deleteAllPolygons.mutate();
  };

  const saveDetails = async (item: TableItem, fields: EditableFields) => {
    const itemWithGeometry = drawing.applyGeometry(item);
    const objectPoint = drawing.geometrySession?.kind === "object" && drawing.geometrySession.id === item.id
      ? drawing.geometrySession.point
      : item.kind === "object" && !item.saved
        ? item.point
        : undefined;
    const polygonShape = itemWithGeometry.kind === "polygon" && drawing.geometrySession?.kind === "polygon"
      ? drawing.geometrySession.shape
      : fields.shape;
    const polygonRadius = itemWithGeometry.kind === "polygon" && drawing.geometrySession?.kind === "polygon"
      ? drawing.geometrySession.radiusMeters
      : fields.radiusMeters;

    if (!item.saved) {
      if (item.kind === "object") {
        drafts.setObjects((current) => current.map((draft) => draft.id === item.id
          ? { ...draft, point: objectPoint ?? draft.point, name: fields.name, color: fields.color || undefined, layerId: fields.layerId, objectType: fields.objectType }
          : draft));
      } else {
        drafts.setPolygons((current) => current.map((draft) => draft.id === item.id
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
      drawing.setGeometrySession(null);
      return;
    }

    if (item.kind === "object") {
      const coordinates = drawing.geometrySession?.kind === "object" && drawing.geometrySession.id === item.id
        ? leafletToGeoJson(drawing.geometrySession.point)
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
    if (item.kind === "polygon") await mapState.invalidatePolygonsAndMapData();
    else await mapState.invalidateMapData();
    drawing.setGeometrySession(null);
  };

  const duplicateItem = (item: TableItem) => {
    const id = crypto.randomUUID();
    const name = `${item.name} (copy)`;
    if (item.kind === "object") {
      const point = offsetPosition(item.center.lat, item.center.lon);
      drafts.addObject({
        id,
        name,
        objectType: item.objectType,
        layerId: drawing.activeLayerId ?? item.layerId,
        color: item.color ?? undefined,
        point,
      });
    } else {
      const coordinates = offsetPolygon(item.coordinates);
      drafts.addPolygon({
        id,
        name,
        layerId: drawing.activeLayerId ?? item.layerId,
        color: item.color ?? undefined,
        shape: item.shape ?? "polygon",
        radiusMeters: item.radiusMeters ?? undefined,
        coordinates,
        center: centroidOfRing(coordinates[0]),
      });
    }
    selection.setSelected({ kind: item.kind, id });
  };

  const deleteDetailsItem = async (item: TableItem) => {
    if (item.saved) {
      if (item.kind === "object") {
        await api.deleteObject(item.id);
        await mapState.invalidateMapData();
      } else {
        await api.deletePolygon(item.id);
        if (filters.within === item.id) filters.setWithin("");
        await mapState.invalidatePolygonsAndMapData();
      }
    } else if (item.kind === "object") {
      drafts.removeObject(item.id);
    } else {
      drafts.removePolygon(item.id);
    }
    selection.setSelected(null);
  };

  return {
    errorMessage,
    setErrorMessage,
    deleteSelected,
    handleDeleteAllPolygons,
    saveDetails,
    duplicateItem,
    deleteDetailsItem,
  };
}
