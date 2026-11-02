// Owns draft collections, display models, generated names, and batch saving.
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { api } from "../api/client";
import { withRetry } from "../api/retry";
import type { MapDataItemDto, ObjectTypeDto } from "../api/types";
import { nextDefaultName } from "../geometry/defaultNames";
import { leafletToGeoJson } from "../geometry/coordinates";
import type { PendingObject, PendingPolygon, Selection, TableItem } from "../types/map";

type UseDraftsOptions = {
  activeLayerId?: string;
  objectTypes: ObjectTypeDto[];
  savedItems: MapDataItemDto[];
  setSelected: Dispatch<SetStateAction<Selection>>;
  refresh: () => Promise<unknown>;
  refreshPolygonsAndMapData: () => Promise<unknown>;
};

export function useDrafts({
  activeLayerId,
  objectTypes,
  savedItems,
  setSelected,
  refresh,
  refreshPolygonsAndMapData,
}: UseDraftsOptions) {
  const [objects, setObjects] = useState<PendingObject[]>([]);
  const [polygons, setPolygons] = useState<PendingPolygon[]>([]);
  const [saving, setSaving] = useState(false);

  const objectNames = useMemo(() => {
    const names = [
      ...savedItems.map((item) => item.name),
      ...objects.flatMap((item) => item.name ? [item.name] : []),
    ];
    return new Map(objects.map((item) => {
      const prefix = objectTypes.find((type) => type.id === item.objectType)?.label ?? "Object";
      const name = item.name ?? nextDefaultName(prefix, names);
      names.push(name);
      return [item.id, name];
    }));
  }, [objects, objectTypes, savedItems]);

  const polygonNames = useMemo(() => {
    const names = [
      ...savedItems.map((item) => item.name),
      ...polygons.flatMap((item) => item.name ? [item.name] : []),
    ];
    return new Map(polygons.map((item) => {
      const name = item.name ?? nextDefaultName("Polygon", names);
      names.push(name);
      return [item.id, name];
    }));
  }, [polygons, savedItems]);

  const items = useMemo(() => {
    const drafts: TableItem[] = [
      ...objects.map((item): TableItem => {
        const label = objectNames.get(item.id)!;
        return {
          ...item,
          kind: "object",
          label,
          name: label,
          layerId: item.layerId ?? activeLayerId ?? "",
          center: { lat: item.point[0], lon: item.point[1] },
          createdAt: "",
          saved: false,
        };
      }),
      ...polygons.map((item): TableItem => {
        const label = polygonNames.get(item.id)!;
        return { ...item, kind: "polygon", label, name: label, layerId: item.layerId ?? activeLayerId ?? "", createdAt: "", saved: false };
      }),
    ];
    return [...drafts, ...savedItems.map((item): TableItem => ({ ...item, label: item.name, saved: true }))];
  }, [objects, polygons, savedItems, activeLayerId, objectNames, polygonNames]);

  const addObject = (draft: PendingObject) => setObjects((current) => [...current, draft]);
  const addPolygon = (draft: PendingPolygon) => setPolygons((current) => [...current, draft]);
  const removeObject = (id: string) => setObjects((current) => current.filter((draft) => draft.id !== id));
  const removePolygon = (id: string) => setPolygons((current) => current.filter((draft) => draft.id !== id));

  const reassignLayer = (deletedId: string, defaultId: string) => {
    setObjects((current) => current.map((draft) => draft.layerId === deletedId ? { ...draft, layerId: defaultId } : draft));
    setPolygons((current) => current.map((draft) => draft.layerId === deletedId ? { ...draft, layerId: defaultId } : draft));
  };

  const saveDrafts = async (setErrorMessage: (message: string) => void) => {
    if (saving || (!objects.length && !polygons.length)) return;
    setSaving(true);
    setErrorMessage("");
    const describe = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
    try {
      // clientId is the draft's UUID: if a response is lost and Save is retried, the server returns the existing record.
      const objectPayload = objects.map((item) => ({
        clientId: item.id,
        name: item.name ?? objectNames.get(item.id)!,
        objectType: item.objectType,
        layerId: item.layerId ?? activeLayerId!,
        createdBy: "Map Manager",
        ...(item.color ? { color: item.color } : {}),
        coordinates: leafletToGeoJson(item.point),
      }));
      const polygonPayload = polygons.map((item) => ({
        clientId: item.id,
        name: item.name ?? polygonNames.get(item.id)!,
        layerId: item.layerId ?? activeLayerId!,
        createdBy: "Map Manager",
        ...(item.color ? { color: item.color } : {}),
        ...(item.shape ? { shape: item.shape } : {}),
        ...(item.shape === "circle" && item.radiusMeters !== undefined ? { radiusMeters: item.radiusMeters } : {}),
        coordinates: item.coordinates,
      }));
      const [objectResult, polygonResult] = await Promise.allSettled([
        objectPayload.length ? withRetry(() => api.createObjects(objectPayload)) : Promise.resolve(undefined),
        polygonPayload.length ? withRetry(() => api.createPolygons(polygonPayload)) : Promise.resolve(undefined),
      ]);

      // No client-side rollback: saved drafts leave state, failed ones stay so Save can be retried.
      const failures: string[] = [];
      let anySaved = false;
      if (objectResult.status === "rejected") {
        failures.push(`Objects were not saved: ${describe(objectResult.reason)}`);
      } else if (objectResult.value) {
        const saved = objectResult.value;
        anySaved = true;
        setObjects((current) => current.filter((item) => !objects.some((draft) => draft.id === item.id)));
        setSelected((current) => {
          if (current?.kind !== "object") return current;
          const index = objects.findIndex((item) => item.id === current.id);
          return index >= 0 && saved[index] ? { kind: "object", id: saved[index].id } : current;
        });
      }
      if (polygonResult.status === "rejected") {
        failures.push(`Polygons were not saved: ${describe(polygonResult.reason)}`);
      } else if (polygonResult.value) {
        const saved = polygonResult.value;
        anySaved = true;
        setPolygons((current) => current.filter((item) => !polygons.some((draft) => draft.id === item.id)));
        setSelected((current) => {
          if (current?.kind !== "polygon") return current;
          const index = polygons.findIndex((item) => item.id === current.id);
          return index >= 0 && saved[index] ? { kind: "polygon", id: saved[index].id } : current;
        });
      }

      if (anySaved) {
        try {
          if (polygonResult.status === "fulfilled" && polygonResult.value) await refreshPolygonsAndMapData();
          else await refresh();
        } catch (error) {
          failures.push(`Saved, but the list could not be refreshed: ${describe(error)}`);
        }
      }
      if (failures.length) {
        const kept = objectResult.status === "rejected" || polygonResult.status === "rejected";
        setErrorMessage([...failures, ...(kept ? ["The unsaved drafts were kept; press Save to retry."] : [])].join(". "));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save drafts.");
    } finally {
      setSaving(false);
    }
  };

  return {
    objects,
    setObjects,
    polygons,
    setPolygons,
    addObject,
    addPolygon,
    removeObject,
    removePolygon,
    reassignLayer,
    saveDrafts,
    saving,
    items,
    objectNames,
    polygonNames,
    unsavedCount: objects.length + polygons.length,
  };
}
