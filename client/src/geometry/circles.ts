import { leafletToGeoJson, type LeafletPosition } from "./coordinates";
import { closeRing } from "./rings";

const EARTH_RADIUS_METERS = 6_371_008.8;
const CIRCLE_VERTEX_COUNT = 64;

export function haversineDistanceMeters(first: LeafletPosition, second: LeafletPosition): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = radians(second[0] - first[0]);
  const deltaLon = radians(second[1] - first[1]);
  const firstLat = radians(first[0]);
  const secondLat = radians(second[0]);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function geodesicCircleToGeoJson(
  center: LeafletPosition,
  edge: LeafletPosition,
  vertexCount = CIRCLE_VERTEX_COUNT,
): number[][][] {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const toDegrees = (radians: number) => radians * 180 / Math.PI;
  const radiusMeters = haversineDistanceMeters(center, edge);
  const angularRadius = radiusMeters / EARTH_RADIUS_METERS;
  const [centerLat, centerLon] = center.map(toRadians);
  const positions: LeafletPosition[] = [];

  for (let index = 0; index < vertexCount; index += 1) {
    const bearing = 2 * Math.PI * index / vertexCount;
    const lat = Math.asin(
      Math.sin(centerLat) * Math.cos(angularRadius)
      + Math.cos(centerLat) * Math.sin(angularRadius) * Math.cos(bearing),
    );
    const lon = centerLon + Math.atan2(
      Math.sin(bearing) * Math.sin(angularRadius) * Math.cos(centerLat),
      Math.cos(angularRadius) - Math.sin(centerLat) * Math.sin(lat),
    );
    positions.push([toDegrees(lat), ((toDegrees(lon) + 540) % 360) - 180]);
  }

  return [closeRing(positions).map(leafletToGeoJson)];
}

export function createCircleDraft(center: LeafletPosition, edgePoint: LeafletPosition) {
  return {
    coordinates: geodesicCircleToGeoJson(center, edgePoint),
    center: { lat: center[0], lon: center[1] },
    radiusMeters: haversineDistanceMeters(center, edgePoint),
    shape: "circle" as const,
  };
}
