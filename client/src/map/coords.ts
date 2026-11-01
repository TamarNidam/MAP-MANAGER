// Converts geometry between map projections and the shared GeoJSON helpers.
import { geoJsonToLeaflet, leafletToGeoJson, type GeoJsonPosition, type LeafletPosition } from "../geometry/coordinates";
import { closeRing } from "../geometry/rings";

export type { GeoJsonPosition, LeafletPosition } from "../geometry/coordinates";
export type DrawingShape = "Polygon" | "Rectangle" | "Circle";
export type GeoJsonBbox = [number, number, number, number];

export { geoJsonToLeaflet, leafletToGeoJson };

export function leafletBoundsToGeoJsonBbox(west: number, south: number, east: number, north: number): GeoJsonBbox {
  return [west, south, east, north];
}

export function geoJsonPolygonToLeaflet(coordinates: number[][][]): LeafletPosition[][] {
  return coordinates.map((ring) => ring.map((position) => geoJsonToLeaflet(position as GeoJsonPosition)));
}

export function leafletPolygonToGeoJson(rings: LeafletPosition[][]): number[][][] {
  return rings.map((ring) => closeRing(ring).map((position) => leafletToGeoJson(position)));
}

export function rectangleToGeoJson(first: LeafletPosition, second: LeafletPosition): number[][][] {
  return leafletPolygonToGeoJson([[
    first,
    [first[0], second[1]],
    second,
    [second[0], first[1]],
  ]]);
}
