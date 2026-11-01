export type GeoJsonPosition = [number, number];
export type LeafletPosition = [number, number];

export function geoJsonToLeaflet([lon, lat]: GeoJsonPosition): LeafletPosition {
  return [lat, lon];
}

export function leafletToGeoJson([lat, lon]: LeafletPosition): GeoJsonPosition {
  return [lon, lat];
}
