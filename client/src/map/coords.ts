export type GeoJsonPosition = [number, number];
export type LeafletPosition = [number, number];
export type DrawingShape = "Polygon" | "Rectangle" | "Circle";
export type GeoJsonBbox = [number, number, number, number];

export function geoJsonToLeaflet([lon, lat]: GeoJsonPosition): LeafletPosition {
  return [lat, lon];
}

export function leafletToGeoJson([lat, lon]: LeafletPosition): GeoJsonPosition {
  return [lon, lat];
}

export function leafletBoundsToGeoJsonBbox(west: number, south: number, east: number, north: number): GeoJsonBbox {
  return [west, south, east, north];
}

export function geoJsonPolygonToLeaflet(coordinates: number[][][]): LeafletPosition[][] {
  return coordinates.map((ring) => ring.map((position) => geoJsonToLeaflet(position as GeoJsonPosition)));
}

export function leafletPolygonToGeoJson(rings: LeafletPosition[][]): number[][][] {
  return rings.map((ring) => {
    const closedRing = ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
      ? [...ring, ring[0]]
      : ring;
    return closedRing.map((position) => leafletToGeoJson(position));
  });
}

export function rectangleToGeoJson(first: LeafletPosition, second: LeafletPosition): number[][][] {
  return leafletPolygonToGeoJson([[
    first,
    [first[0], second[1]],
    second,
    [second[0], first[1]],
  ]]);
}

export function geodesicCircleToGeoJson(
  center: LeafletPosition,
  edge: LeafletPosition,
  vertexCount = 64,
): number[][][] {
  const earthRadius = 6_371_008.8;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const toDegrees = (radians: number) => radians * 180 / Math.PI;
  const [centerLat, centerLon] = center.map(toRadians);
  const [edgeLat, edgeLon] = edge.map(toRadians);
  const deltaLat = edgeLat - centerLat;
  const deltaLon = edgeLon - centerLon;
  const haversine = Math.sin(deltaLat / 2) ** 2 + Math.cos(centerLat) * Math.cos(edgeLat) * Math.sin(deltaLon / 2) ** 2;
  const radiusMeters = earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  const angularRadius = radiusMeters / earthRadius;
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

  return leafletPolygonToGeoJson([positions]);
}