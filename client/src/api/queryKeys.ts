import type { MapDataQuery } from "./types";

export const queryKeys = {
  mapDataRoot: ["map-data"] as const,
  mapData: (query: MapDataQuery, generation: number) => ["map-data", query, generation] as const,
  layers: ["layers"] as const,
  objectTypes: ["object-types"] as const,
  polygonOptions: ["polygon-options"] as const,
};
