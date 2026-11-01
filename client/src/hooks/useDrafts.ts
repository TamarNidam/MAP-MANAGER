import { useState } from "react";
import type { PendingObject, PendingPolygon } from "../types/map";

export function useDrafts() {
  const [objects, setObjects] = useState<PendingObject[]>([]);
  const [polygons, setPolygons] = useState<PendingPolygon[]>([]);
  const [saving, setSaving] = useState(false);

  const addObject = (draft: PendingObject) => setObjects((current) => [...current, draft]);
  const addPolygon = (draft: PendingPolygon) => setPolygons((current) => [...current, draft]);
  const removeObject = (id: string) => setObjects((current) => current.filter((draft) => draft.id !== id));
  const removePolygon = (id: string) => setPolygons((current) => current.filter((draft) => draft.id !== id));

  const save = async (persist: (drafts: { objects: PendingObject[]; polygons: PendingPolygon[] }) => Promise<void>) => {
    if (saving || (!objects.length && !polygons.length)) return;
    setSaving(true);
    try {
      await persist({ objects, polygons });
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
    save,
    saving,
  };
}
