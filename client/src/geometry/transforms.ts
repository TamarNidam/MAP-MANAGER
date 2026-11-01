// Small geometry transforms used when editing and duplicating map features.
import { leafletToGeoJson } from "./coordinates";

export function offsetPosition(lat: number, lon: number): [number, number] {
  const offsetMeters = 14;
  const nextLat = Math.min(90, lat + offsetMeters / 111_320);
  const nextLon = Math.min(180, lon + offsetMeters / (111_320 * Math.max(Math.cos(lat * Math.PI / 180), 0.000001)));
  return [nextLat, nextLon];
}

export function offsetPolygon(coordinates: number[][][]): number[][][] {
  return coordinates.map((ring) => ring.map(([lon, lat]) => {
    const [nextLat, nextLon] = offsetPosition(lat, lon);
    return leafletToGeoJson([nextLat, nextLon]);
  }));
}

export function copyCoordinates(coordinates: number[][][]): number[][][] {
  return coordinates.map((ring) => ring.map((position) => [...position]));
}
