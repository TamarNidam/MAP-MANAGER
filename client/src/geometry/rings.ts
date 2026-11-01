export function closeRing<T extends number[]>(ring: T[]): T[] {
  if (!ring.length) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}
