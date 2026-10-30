import assert from "node:assert/strict";
import test from "node:test";
import { geoJsonToLeaflet, leafletToGeoJson } from "./coords.ts";

test("coordinates swap between GeoJSON and Leaflet order", () => {
  assert.deepEqual(geoJsonToLeaflet([34.7818, 32.0853]), [32.0853, 34.7818]);
  assert.deepEqual(leafletToGeoJson([32.0853, 34.7818]), [34.7818, 32.0853]);
});