// Owns draft collections, display models, generated names, and batch saving.
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { api } from "../api/client";
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
    try {
      const objectPayload = objects.map((item) => ({
        name: item.name ?? objectNames.get(item.id)!,
        objectType: item.objectType,
        layerId: item.layerId ?? activeLayerId!,
        createdBy: "Map Manager",
        ...(item.color ? { color: item.color } : {}),
        coordinates: leafletToGeoJson(item.point),
      }));
      const polygonPayload = polygons.map((item) => ({
        name: item.name ?? polygonNames.get(item.id)!,
        layerId: item.layerId ?? activeLayerId!,
        createdBy: "Map Manager",
        ...(item.color ? { color: item.color } : {}),
        ...(item.shape ? { shape: item.shape } : {}),
        ...(item.shape === "circle" && item.radiusMeters !== undefined ? { radiusMeters: item.radiusMeters } : {}),
        coordinates: item.coordinates,
      }));
      const [objectResult, polygonResult] = await Promise.all([
        objectPayload.length
          ? api.createObjects(objectPayload).then((value) => ({ value }), (reason: unknown) => ({ reason }))
          : Promise.resolve(undefined),
        polygonPayload.length
          ? api.createPolygons(polygonPayload).then((value) => ({ value }), (reason: unknown) => ({ reason }))
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
        setObjects((current) => current.filter((item) => !objects.some((draft) => draft.id === item.id)));
        setSelected((current) => {
          if (current?.kind !== "object") return current;
          const index = objects.findIndex((item) => item.id === current.id);
          return index >= 0 && objectResult.value[index] ? { kind: "object", id: objectResult.value[index].id } : current;
        });
      }
      if (polygonSaved) {
        setPolygons((current) => current.filter((item) => !polygons.some((draft) => draft.id === item.id)));
        setSelected((current) => {
          if (current?.kind !== "polygon") return current;
          const index = polygons.findIndex((item) => item.id === current.id);
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
