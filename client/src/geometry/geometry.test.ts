import { describe, expect, it } from "vitest";
import { centroidOfRing } from "./centroid";
import { createCircleDraft, haversineDistanceMeters } from "./circles";
import { nextDefaultName } from "./defaultNames";
import { geoJsonToLeaflet, leafletToGeoJson } from "./coordinates";
import { closeRing } from "./rings";

describe("centroidOfRing", () => {
  it("calculates a square centroid", () => {
    expect(centroidOfRing([[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]])).toEqual({ lat: 2, lon: 2 });
  });

  it("calculates an area-weighted L-shape centroid", () => {
    const ring = [
      [34, 32], [36, 32], [36, 33], [35, 33], [35, 34], [34, 34], [34, 32],
    ];
    expect(centroidOfRing(ring)).toEqual({ lat: 32 + 5 / 6, lon: 34 + 5 / 6 });
  });

  it("falls back to the vertex mean for a zero-area ring", () => {
    expect(centroidOfRing([[0, 0], [2, 0], [1, 0], [0, 0]])).toEqual({ lat: 0, lon: 1 });
  });

  it("returns the same centroid when ring winding is reversed", () => {
    const ring = [[34, 32], [36, 32], [36, 33], [35, 33], [35, 34], [34, 34], [34, 32]];
    expect(centroidOfRing([...ring].reverse())).toEqual(centroidOfRing(ring));
  });
});

describe("geometry helpers", () => {
  it("creates a closed 64-point circle draft with its measured radius", () => {
    const center: [number, number] = [0, 0];
    const edge: [number, number] = [0, 0.008993203637];
    const draft = createCircleDraft(center, edge);
    expect(draft.shape).toBe("circle");
    expect(draft.radiusMeters).toBeCloseTo(1000, 1);
    expect(draft.coordinates[0]).toHaveLength(65);
    expect(draft.coordinates[0][0]).toEqual(draft.coordinates[0][64]);
    expect(haversineDistanceMeters(center, edge)).toBe(draft.radiusMeters);
  });

  it("converts GeoJSON [lon,lat] and Leaflet [lat,lon]", () => {
    expect(geoJsonToLeaflet([34.78, 32.08])).toEqual([32.08, 34.78]);
    expect(leafletToGeoJson([32.08, 34.78])).toEqual([34.78, 32.08]);
  });

  it("closes a ring without duplicating an already closed endpoint", () => {
    const open = [[1, 2], [3, 4]];
    expect(closeRing(open)).toEqual([[1, 2], [3, 4], [1, 2]]);
    expect(closeRing([[1, 2], [1, 2]])).toEqual([[1, 2], [1, 2]]);
    expect(closeRing([])).toEqual([]);
  });

  it("generates the next default name from the maximum existing suffix", () => {
    expect(nextDefaultName("Polygon", ["Polygon 3", "Polygon 11", "Other 40", "Polygon 8"])).toBe("Polygon 12");
    expect(nextDefaultName("Polygon", ["Polygon 15 "])).toBe("Polygon 16");
  });
});
