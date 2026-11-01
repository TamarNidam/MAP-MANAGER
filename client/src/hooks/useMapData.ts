import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { api } from "../api/client";
import { queryKeys } from "../api/queryKeys";
import type { MapDataPageDto, MapDataQuery } from "../api/types";
import { useMapQueries } from "./useMapQueries";

const PAGE_SIZE = 200;
const LOAD_ALL_LIMIT = 1000;

export function useMapData(query: MapDataQuery, generation: number) {
  const queryClient = useQueryClient();
  const queries = useMapQueries(query, generation);
  const queryKey = queryKeys.mapData(query, generation);
  const loadAllAbortController = useRef<AbortController | null>(null);
  const [loadAllActive, setLoadAllActive] = useState(false);
  const [loadAllProgress, setLoadAllProgress] = useState("");
  const [loadAllStopped, setLoadAllStopped] = useState(false);
  const [loadAllError, setLoadAllError] = useState("");
  const mapData = queries.mapData;
  const loadedCount = useMemo(
    () => mapData.data?.pages.reduce((count, page) => count + page.items.length, 0) ?? 0,
    [mapData.data],
  );

  useEffect(() => {
    loadAllAbortController.current?.abort();
    loadAllAbortController.current = null;
    setLoadAllActive(false);
    setLoadAllProgress("");
    setLoadAllStopped(false);
    setLoadAllError("");
  }, [generation]);

  const invalidateMapData = () => queryClient.invalidateQueries({ queryKey: queryKeys.mapDataRoot });

  const invalidatePolygonsAndMapData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.polygonOptions }),
      invalidateMapData(),
    ]);
  };

  const loadAll = async () => {
    if (loadAllActive || mapData.isPlaceholderData || !mapData.hasNextPage) return;
    const abortController = new AbortController();
    loadAllAbortController.current = abortController;
    setLoadAllActive(true);
    setLoadAllProgress("");
    setLoadAllStopped(false);
    setLoadAllError("");

    try {
      let data = queryClient.getQueryData<InfiniteData<MapDataPageDto, string | null>>(queryKey);
      let count = data?.pages.reduce((total, page) => total + page.items.length, 0) ?? 0;
      while (count < LOAD_ALL_LIMIT && !abortController.signal.aborted) {
        const cursor = data?.pages.at(-1)?.nextCursor;
        if (!cursor) break;
        const page = await api.getMapData({
          ...query,
          cursor,
          limit: Math.min(PAGE_SIZE, LOAD_ALL_LIMIT - count),
        }, abortController.signal);
        if (abortController.signal.aborted) break;
        if (!page.items.length) throw new Error("Map data paging returned an empty page with more results available.");

        queryClient.setQueryData<InfiniteData<MapDataPageDto, string | null>>(queryKey, (current) => {
          if (!current) return current;
          return {
            pages: [...current.pages, page],
            pageParams: [...current.pageParams, cursor],
          };
        });
        data = queryClient.getQueryData<InfiniteData<MapDataPageDto, string | null>>(queryKey);
        count = data?.pages.reduce((total, entry) => total + entry.items.length, 0) ?? count;
        setLoadAllProgress(`Loaded ${count}...`);
      }

      const finalData = queryClient.getQueryData<InfiniteData<MapDataPageDto, string | null>>(queryKey);
      if (!abortController.signal.aborted && count >= LOAD_ALL_LIMIT && finalData?.pages.at(-1)?.nextCursor) {
        setLoadAllStopped(true);
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        setLoadAllError(error instanceof Error ? error.message : "Unable to load all map data.");
      }
    } finally {
      if (loadAllAbortController.current === abortController) {
        loadAllAbortController.current = null;
      }
      setLoadAllActive(false);
    }
  };

  const cancelLoadAll = () => {
    loadAllAbortController.current?.abort();
    loadAllAbortController.current = null;
    setLoadAllActive(false);
  };

  return {
    ...queries,
    mapData,
    queryKey,
    loadedCount,
    loadAllActive,
    loadAllProgress,
    loadAllStopped,
    loadAllError,
    loadAll,
    cancelLoadAll,
    invalidateMapData,
    invalidatePolygonsAndMapData,
  };
}
