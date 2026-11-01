export type GeoPoint = { lat: number; lon: number };

const MIN_AREA = 1e-12;

export function centroidOfRing(ring: number[][]): GeoPoint {
  const vertexCount = ring.length - 1;
  const originLon = ring[0][0];
  const originLat = ring[0][1];
  let twiceArea = 0;
  let lonSum = 0;
  let latSum = 0;

  for (let index = 0; index < vertexCount; index += 1) {
    const x1 = ring[index][0] - originLon;
    const y1 = ring[index][1] - originLat;
    const x2 = ring[index + 1][0] - originLon;
    const y2 = ring[index + 1][1] - originLat;
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    lonSum += (x1 + x2) * cross;
    latSum += (y1 + y2) * cross;
  }

  if (Math.abs(twiceArea / 2) < MIN_AREA) {
    const vertices = ring.slice(0, vertexCount);
    return {
      lat: vertices.reduce((sum, point) => sum + point[1], 0) / vertexCount,
      lon: vertices.reduce((sum, point) => sum + point[0], 0) / vertexCount,
    };
  }

  return {
    lat: originLat + latSum / (3 * twiceArea),
    lon: originLon + lonSum / (3 * twiceArea),
  };
}
