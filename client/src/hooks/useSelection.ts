import { useState } from "react";
import type { Selection } from "../types/map";

export function useSelection() {
  const [selected, setSelected] = useState<Selection>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(() => new Set());

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

  return {
    selected,
    setSelected,
    hidden,
    hiddenLayerIds,
    setHiddenLayerIds,
    toggleVisibility,
    toggleLayerVisibility,
  };
}
