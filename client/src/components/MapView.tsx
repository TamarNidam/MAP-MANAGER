import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polygon, TileLayer, useMap } from "react-leaflet";
import type { DrawingShape, Selection, TableItem } from "../types/map";
import { geoJsonPolygonToLeaflet, geoJsonToLeaflet, leafletBoundsToGeoJsonBbox, leafletPolygonToGeoJson, type LeafletPosition } from "../map/coords";
import { objectIcon } from "../map/ObjectMarker";
import { ShapeDrawing } from "../map/ShapeDrawing";

const DEFAULT_CENTER: LeafletPosition = [32.0853, 34.7818];
const DEFAULT_ZOOM = 12;
const VIEW_STORAGE_KEY = "map-manager-view";

type MapViewProps = {
  items: TableItem[];
  hidden: Set<string>;
  hiddenLayerIds: Set<string>;
  layerColors: Record<string, string>;
  selected: Selection;
  geometryEdit: { kind: "object" | "polygon"; id: string; mode: "move" | "vertices" | "redraw" | null } | null;
  drawing: DrawingShape | null;
  addingObject: boolean;
  navigationRequest: { item: TableItem; requestId: number } | null;
  mapViewOnly: boolean;
  onViewportChange: (bbox: [number, number, number, number], zoom: number) => void;
  loadedCount: number;
  moreAvailable: boolean;
  filterNotice: string;
  activeFilterCount: number;
  onResetFilters: () => void;
  onSelect: (selection: Selection) => void;
  onObjectMoveEnd: (id: string, point: LeafletPosition) => void;
  onPolygonGeometryChange: (id: string, coordinates: number[][][]) => void;
  onObjectPlace: (point: [number, number]) => void;
  onPolygonDrawn: (coordinates: number[][][], center: LeafletPosition) => void;
  onCancelDrawing: () => void;
};

function readStoredView(): { center: LeafletPosition; zoom: number } {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (!stored) return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
    const parsed = JSON.parse(stored) as { center?: unknown; zoom?: unknown };
    if (!Array.isArray(parsed.center) || parsed.center.length !== 2 || !parsed.center.every(Number.isFinite) || typeof parsed.zoom !== "number" || !Number.isFinite(parsed.zoom)) {
      return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
    }
    return { center: parsed.center as LeafletPosition, zoom: parsed.zoom };
  } catch {
    return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  }
}

type GeomanPolygon = L.Polygon & {
  pm: {
    enable: (options?: { allowSelfIntersection?: boolean }) => void;
    disable: () => void;
  };
};

function EditablePolygon({ item, selected, unsaved, color, editMode, onSelect, onGeometryChange }: {
  item: Extract<TableItem, { kind: "polygon" }>;
  selected: boolean;
  unsaved: boolean;
  color: string;
  editMode: boolean;
  onSelect: () => void;
  onGeometryChange: (coordinates: number[][][]) => void;
}) {
  const [layer, setLayer] = useState<L.Polygon | null>(null);
  const onGeometryChangeRef = useRef(onGeometryChange);
  onGeometryChangeRef.current = onGeometryChange;
  const setPolygonRef = useCallback((polygon: L.Polygon | null) => {
    setLayer(polygon);
    if (!polygon) return;
    if (selected) polygon.bringToFront();
    const path = polygon.getElement();
    path?.setAttribute("data-feature-kind", "polygon");
    path?.setAttribute("data-feature-id", item.id);
  }, [item.id, selected]);

  useEffect(() => {
    if (!layer || !editMode) return;
    const editable = layer as GeomanPolygon;
    const updateGeometry = () => {
      const rings = layer.getLatLngs() as L.LatLng[][];
      onGeometryChangeRef.current(leafletPolygonToGeoJson(rings.map((ring) => ring.map(({ lat, lng }) => [lat, lng] as LeafletPosition))));
    };
    editable.pm.enable({ allowSelfIntersection: true });
    layer.on("pm:edit", updateGeometry);
    layer.on("pm:vertexadded", updateGeometry);
    layer.on("pm:vertexremoved", updateGeometry);
    return () => {
      layer.off("pm:edit", updateGeometry);
      layer.off("pm:vertexadded", updateGeometry);
      layer.off("pm:vertexremoved", updateGeometry);
      editable.pm.disable();
    };
  }, [layer, editMode]);

  return (
    <Polygon
      positions={geoJsonPolygonToLeaflet(item.coordinates)}
      ref={setPolygonRef}
      pathOptions={{
        color,
        weight: selected ? 4 : 2,
        dashArray: unsaved ? "6 6" : undefined,
        fillColor: color,
        fillOpacity: selected ? 0.38 : unsaved ? 0.2 : 0.16,
        className: `${unsaved ? "unsaved-feature" : ""}${selected ? " selected-feature" : ""}`,
      }}
      eventHandlers={{
        click: (event) => { L.DomEvent.stopPropagation(event.originalEvent); onSelect(); },
        contextmenu: (event) => {
          L.DomEvent.preventDefault(event.originalEvent);
          L.DomEvent.stopPropagation(event.originalEvent);
          onSelect();
        },
      }}
    />
  );
}

function PersistMapView() {
  const map = useMap();

  useEffect(() => {
    const saveView = () => {
      try {
        const center = map.getCenter();
        localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ center: [center.lat, center.lng], zoom: map.getZoom() }));
      } catch {
        return;
      }
    };
    saveView();
    map.on("moveend", saveView);
    map.on("zoomend", saveView);
    map.on("dragend", saveView);
    return () => {
      map.off("moveend", saveView);
      map.off("zoomend", saveView);
      map.off("dragend", saveView);
    };
  }, [map]);

  return null;
}

function NavigateToItem({ props }: { props: MapViewProps }) {
  const map = useMap();
  const request = props.navigationRequest;

  useEffect(() => {
    if (!request) return;
    if (request.item.kind === "object") {
      map.flyTo([request.item.center.lat, request.item.center.lon], Math.max(15, map.getZoom()));
      return;
    }

    const bounds = L.latLngBounds([]);
    geoJsonPolygonToLeaflet(request.item.coordinates).flat().forEach((point) => bounds.extend(point));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
  }, [map, request?.requestId]);

  return null;
}

function ViewportReporter({ props }: { props: MapViewProps }) {
  const map = useMap();
  const onChange = useRef(props.onViewportChange);
  onChange.current = props.onViewportChange;

  useEffect(() => {
    const report = () => {
      const bounds = map.getBounds();
      onChange.current(leafletBoundsToGeoJsonBbox(bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()), map.getZoom());
    };
    report();
    map.on("moveend", report);
    map.on("zoomend", report);
    return () => {
      map.off("moveend", report);
      map.off("zoomend", report);
    };
  }, [map, props.mapViewOnly]);

  return null;
}

function FitAllControl({ props }: { props: MapViewProps }) {
  const map = useMap();

  const fitAll = () => {
    const bounds = L.latLngBounds([]);
    for (const item of props.items) {
      const selected = props.selected?.kind === item.kind && props.selected.id === item.id;
      if (props.hidden.has(item.id) && !selected) continue;
      if (props.hiddenLayerIds.has(item.layerId) && !selected) continue;
      if (item.kind === "object") {
        bounds.extend(item.saved ? geoJsonToLeaflet(item.coordinates) : item.point);
      } else {
        geoJsonPolygonToLeaflet(item.coordinates).flat().forEach((point) => bounds.extend(point));
      }
    }

    if (!bounds.isValid()) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    } else if (bounds.getSouthWest().equals(bounds.getNorthEast())) {
      map.setView(bounds.getCenter(), 14);
    } else {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    }
  };

  return (
    <button className="fit-all-control" onClick={(event) => { event.stopPropagation(); fitAll(); }} title="Fit all visible items" aria-label="Fit all visible items">
      <FitIcon />
    </button>
  );
}

export function MapView(props: MapViewProps) {
  const [view] = useState(readStoredView);

  return (
    <>
      <MapContainer center={view.center} zoom={view.zoom} scrollWheelZoom className="map-canvas">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <PersistMapView />
        <ViewportReporter props={props} />
        <FitAllControl props={props} />
        <NavigateToItem props={props} />
        <ShapeDrawing
          shape={props.drawing}
          addingObject={props.addingObject}
          onShapeComplete={props.onPolygonDrawn}
          onObjectPlace={props.onObjectPlace}
          onSelect={props.onSelect}
          onCancel={props.onCancelDrawing}
        />
        {props.items.map((item) => {
          const selected = props.selected?.kind === item.kind && props.selected.id === item.id;
          if (props.hidden.has(item.id) && !selected) return null;
          if (props.hiddenLayerIds.has(item.layerId) && !selected) return null;

          if (item.kind === "object") {
            const position = item.saved ? geoJsonToLeaflet(item.coordinates) : item.point;
            const color = item.color ?? props.layerColors[item.layerId];
            const moving = props.geometryEdit?.kind === "object" && props.geometryEdit.id === item.id && props.geometryEdit.mode === "move";
            return (
              <Marker
                key={`${item.kind}:${item.id}`}
                position={position}
                icon={objectIcon(item.objectType, selected, !item.saved, item.id, color)}
                draggable={moving}
                eventHandlers={{
                  click: (event) => { L.DomEvent.stopPropagation(event.originalEvent); props.onSelect({ kind: "object", id: item.id }); },
                  dragend: (event) => {
                    const point = event.target.getLatLng();
                    props.onObjectMoveEnd(item.id, [point.lat, point.lng]);
                  },
                  contextmenu: (event) => {
                    L.DomEvent.preventDefault(event.originalEvent);
                    L.DomEvent.stopPropagation(event.originalEvent);
                    props.onSelect({ kind: "object", id: item.id });
                  },
                }}
              />
            );
          }

          const unsaved = !item.saved;
          const color = item.color ?? props.layerColors[item.layerId] ?? "#0F6B63";
          return (
            <EditablePolygon
              key={`${item.kind}:${item.id}`}
              item={item}
              selected={selected}
              unsaved={unsaved}
              color={color}
              editMode={props.geometryEdit?.kind === "polygon" && props.geometryEdit.id === item.id && props.geometryEdit.mode === "vertices"}
              onSelect={() => props.onSelect({ kind: "polygon", id: item.id })}
              onGeometryChange={(coordinates) => props.onPolygonGeometryChange(item.id, coordinates)}
            />
          );
        })}
      </MapContainer>
      {props.filterNotice && (
        <div className="map-filter-banner" role="status">
          <span>{props.filterNotice} · {props.activeFilterCount} active filters</span>
          <button onClick={props.onResetFilters}>Reset</button>
        </div>
      )}
      <div className="map-data-status">Loaded {props.loadedCount}{props.moreAvailable ? " · more available" : ""}</div>
    </>
  );
}

function FitIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z" /></svg>;
}