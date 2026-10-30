import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function useMapQueries() {
  const objects = useQuery({ queryKey: ["objects"], queryFn: api.getObjects });
  const polygons = useQuery({ queryKey: ["polygons"], queryFn: api.getPolygons });
  const layers = useQuery({ queryKey: ["layers"], queryFn: api.getLayers });
  const objectTypes = useQuery({ queryKey: ["object-types"], queryFn: api.getObjectTypes });

  return { objects, polygons, layers, objectTypes };
}