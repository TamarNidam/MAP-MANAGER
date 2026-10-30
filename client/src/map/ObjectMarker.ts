import L from "leaflet";

const artwork: Record<string, string> = {
  marker: '<path d="M18 3a9 9 0 0 0-9 9c0 6 9 15 9 15s9-9 9-15a9 9 0 0 0-9-9Zm0 12a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" fill="currentColor"/>',
  jeep: '<path d="M7 12h15l3 4v5h-2a3 3 0 0 1-6 0h-4a3 3 0 0 1-6 0H5v-6l2-3Zm2 2-1 3h4v-3H9Zm6 0v3h7l-2-3h-5ZM8 20a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm11 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z" fill="currentColor"/><path d="M10 8h8l2 3H8l2-3Z" fill="currentColor"/>',
  truck: '<path d="M4 8h14v11H4V8Zm14 4h4l3 3v4h-7v-7Zm-10 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" fill="currentColor"/><path d="M20 14v2h3l-2-2h-1Z" fill="white"/>',
  helicopter: '<path d="M4 11h20v2H4v-2Zm8-5h4l2 5h-8l2-5Zm-2 8h8l-2 4h-4l-2-4Zm-5 5h6v2H5v-2Zm13 0h6v2h-6v-2Zm-8-15h6v2h-6V4Z" fill="currentColor"/>',
  drone: '<path d="M18 15a3 3 0 0 0-2.8 2H12v-5h4.2a3 3 0 1 0 0-2H12V8h3.2a3 3 0 1 0 0-2H10v4H6.8a3 3 0 1 0 0 2H10v5H6.8a3 3 0 1 0 0 2H12v-2h3.2a3 3 0 1 0 2.8-2Z" fill="currentColor"/>',
  tower: '<path d="M17 3 15 7h3l-1 4h2l-2 4h3l-3 10h-3l1-8H9l1 8H7L4 15h3l-2-4h2l-1-4h3L7 3h10Zm-4 14h2l1-6h-4l1 6Z" fill="currentColor"/>',
};

export function objectIcon(typeId: string, selected = false): L.DivIcon {
  const icon = artwork[typeId] ?? artwork.marker;
  const html = `<span class="map-object-icon${selected ? " is-selected" : ""}"><svg viewBox="0 0 36 36" aria-hidden="true">${icon}</svg></span>`;
  const size = selected ? 42 : 36;
  return L.divIcon({ html, className: "map-object-marker", iconSize: [size, size], iconAnchor: [size / 2, size - 6] });
}

export function typeIconMarkup(typeId: string): string {
  return `<svg viewBox="0 0 36 36" aria-hidden="true">${artwork[typeId] ?? artwork.marker}</svg>`;
}