// Owns the active layer and layer management requests.
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { queryKeys } from "../api/queryKeys";
import type { LayerDto, LayerRequest } from "../api/types";

type UseLayerManagementOptions = {
  layers: LayerDto[];
  setHiddenLayerIds: Dispatch<SetStateAction<Set<string>>>;
};

export function useLayerManagement({ layers, setHiddenLayerIds }: UseLayerManagementOptions) {
  const queryClient = useQueryClient();
  const [activeLayerId, setActiveLayerId] = useState("");
  const defaultLayer = layers.find((layer) => layer.name.toLowerCase() === "default");
  const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? defaultLayer ?? layers[0];
  const layerColors = useMemo(() => Object.fromEntries(layers.map((layer) => [layer.id, layer.color])), [layers]);

  useEffect(() => {
    if (activeLayerId && layers.some((layer) => layer.id === activeLayerId)) return;
    if (activeLayer) setActiveLayerId(activeLayer.id);
  }, [activeLayerId, activeLayer, layers]);

  const createLayer = async (layer: LayerRequest) => {
    const created = await api.createLayer(layer);
    await queryClient.invalidateQueries({ queryKey: queryKeys.layers });
    setActiveLayerId(created.id);
  };

  const updateLayer = async (id: string, layer: LayerRequest) => {
    await api.updateLayer(id, layer);
    await queryClient.invalidateQueries({ queryKey: queryKeys.layers });
  };

  const deleteLayer = async (id: string, reassignDrafts: (deletedId: string, defaultId: string) => void) => {
    await api.deleteLayer(id);
    await queryClient.invalidateQueries({ queryKey: queryKeys.layers });
    setHiddenLayerIds((current) => new Set([...current].filter((hiddenId) => hiddenId !== id)));
    if (activeLayerId === id) {
      setActiveLayerId(defaultLayer?.id ?? layers.find((layer) => layer.id !== id)?.id ?? "");
    }
    if (defaultLayer) reassignDrafts(id, defaultLayer.id);
  };

  return {
    activeLayerId,
    setActiveLayerId,
    activeLayer,
    defaultLayer,
    layerColors,
    createLayer,
    updateLayer,
    deleteLayer,
  };
}
