import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { queryKeys } from "../api/queryKeys";
import type { MapDataQuery } from "../api/types";

export function useMapQueries(query: MapDataQuery, generation: number) {
  const mapData = useInfiniteQuery({
    queryKey: queryKeys.mapData(query, generation),
    queryFn: ({ pageParam, signal }) => api.getMapData({ ...query, cursor: pageParam ?? undefined }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const layers = useQuery({ queryKey: queryKeys.layers, queryFn: api.getLayers });
  const objectTypes = useQuery({ queryKey: queryKeys.objectTypes, queryFn: api.getObjectTypes });
  const polygonOptions = useQuery({ queryKey: queryKeys.polygonOptions, queryFn: api.getPolygons });

  return { mapData, layers, objectTypes, polygonOptions };
}