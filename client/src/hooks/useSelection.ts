// Keeps selection and visibility state synchronized across the map and table.
import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Selection, TableItem } from "../types/map";

type SelectionSyncOptions = {
  items: TableItem[];
  selected: Selection;
  setSelected: Dispatch<SetStateAction<Selection>>;
  hiddenLayerIds: Set<string>;
  clearGeometrySession: () => void;
  rowRefs: MutableRefObject<Map<string, HTMLTableRowElement>>;
};

export function useSelection() {
  const [selected, setSelected] = useState<Selection>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(() => new Set());
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const navigationRequestId = useRef(0);
  const [navigationRequest, setNavigationRequest] = useState<{ item: TableItem; requestId: number } | null>(null);

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

  const handleSelect = (next: Selection, geometrySessionActive: boolean) => {
    if (geometrySessionActive) return;
    setSelected(next);
    setConfirmDeleteAll(false);
  };

  const navigateToItem = (item: TableItem, geometrySessionActive: boolean) => {
    if (geometrySessionActive) return;
    setSelected({ kind: item.kind, id: item.id });
    navigationRequestId.current += 1;
    setNavigationRequest({ item, requestId: navigationRequestId.current });
  };

  return {
    selected,
    setSelected,
    hidden,
    hiddenLayerIds,
    setHiddenLayerIds,
    toggleVisibility,
    toggleLayerVisibility,
    handleSelect,
    navigateToItem,
    rowRefs,
    navigationRequest,
    confirmDeleteAll,
    setConfirmDeleteAll,
  };
}

export function useSelectionSync({
  items,
  selected,
  setSelected,
  hiddenLayerIds,
  clearGeometrySession,
  rowRefs,
}: SelectionSyncOptions) {
  useEffect(() => {
    if (!selected) return;
    const item = items.find((entry) => entry.kind === selected.kind && entry.id === selected.id);
    if (item) rowRefs.current.get(`${selected.kind}:${selected.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [items, rowRefs, selected]);

  useEffect(() => {
    if (!selected) return;
    const item = items.find((entry) => entry.kind === selected.kind && entry.id === selected.id);
    if (!item) {
      setSelected(null);
      clearGeometrySession();
      return;
    }
    if (hiddenLayerIds.has(item.layerId)) {
      setSelected(null);
      clearGeometrySession();
    }
  }, [clearGeometrySession, hiddenLayerIds, items, selected, setSelected]);
}
