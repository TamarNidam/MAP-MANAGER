import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polygon, TileLayer, useMap } from "react-leaflet";
import type { GeoPointDto, MapObjectDto, PolygonDto } from "../api/types";
import type { DrawingShape, PendingObject, PendingPolygon, Selection } from "../types/map";
import { geoJsonPolygonToLeaflet, geoJsonToLeaflet, type LeafletPosition } from "../map/coords";
import { objectIcon } from "../map/ObjectMarker";
import { ShapeDrawing } from "../map/ShapeDrawing";

const DEFAULT_CENTER: LeafletPosition = [32.0853, 34.7818];
const DEFAULT_ZOOM = 12;
const VIEW_STORAGE_KEY = "map-manager-view";

type MapViewProps = {
  objects: MapObjectDto[];
  polygons: PolygonDto[];
  pendingObjects: PendingObject[];
  pendingPolygons: PendingPolygon[];
  hidden: Set<string>;
  selected: Selection;
  drawing: DrawingShape | null;
  addingObject: boolean;
  selectedObjectType: string;
  navigationRequest: { kind: "object" | "polygon"; id: string; center: GeoPointDto; requestId: number } | null;
  onSelect: (selection: Selection) => void;
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
    if (request.kind === "object") {
      map.flyTo([request.center.lat, request.center.lon], Math.max(15, map.getZoom()));
      return;
    }

    const coordinates = props.polygons.find((polygon) => polygon.id === request.id)?.coordinates
      ?? props.pendingPolygons.find((polygon) => polygon.id === request.id)?.coordinates;
    if (!coordinates) return;
    const bounds = L.latLngBounds([]);
    geoJsonPolygonToLeaflet(coordinates).flat().forEach((point) => bounds.extend(point));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
  }, [map, request?.requestId]);

  return null;
}

function FitAllControl({ props }: { props: MapViewProps }) {
  const map = useMap();

  const fitAll = () => {
    const bounds = L.latLngBounds([]);
    const isVisible = (kind: "object" | "polygon", id: string) =>
      !props.hidden.has(`${kind}:${id}`) || (props.selected?.kind === kind && props.selected.id === id);

    for (const object of props.objects) {
      if (isVisible("object", object.id)) bounds.extend(geoJsonToLeaflet(object.coordinates));
    }
    for (const object of props.pendingObjects) {
      if (isVisible("object", object.id)) bounds.extend(object.point);
    }
    for (const polygon of props.polygons) {
      if (isVisible("polygon", polygon.id)) geoJsonPolygonToLeaflet(polygon.coordinates).flat().forEach((point) => bounds.extend(point));
    }
    for (const polygon of props.pendingPolygons) {
      if (isVisible("polygon", polygon.id)) geoJsonPolygonToLeaflet(polygon.coordinates).flat().forEach((point) => bounds.extend(point));
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
    <MapContainer center={view.center} zoom={view.zoom} scrollWheelZoom className="map-canvas">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <PersistMapView />
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
      {props.objects.map((object) => {
        const key = `object:${object.id}`;
        const selected = props.selected?.kind === "object" && props.selected.id === object.id;
        if (props.hidden.has(key) && !selected) return null;
        return (
          <Marker
            key={object.id}
            position={geoJsonToLeaflet(object.coordinates)}
            icon={objectIcon(object.objectType, selected, false, object.id)}
            eventHandlers={{ click: (event) => { L.DomEvent.stopPropagation(event.originalEvent); props.onSelect({ kind: "object", id: object.id }); } }}
          />
        );
      })}
      {props.pendingObjects.map((object) => {
        const key = `object:${object.id}`;
        const selected = props.selected?.kind === "object" && props.selected.id === object.id;
        if (props.hidden.has(key) && !selected) return null;
        return (
          <Marker
            key={object.id}
            position={object.point}
            icon={objectIcon(object.objectType, selected, true, object.id)}
            eventHandlers={{ click: (event) => { L.DomEvent.stopPropagation(event.originalEvent); props.onSelect({ kind: "object", id: object.id }); } }}
          />
        );
      })}
      {props.polygons.map((polygon) => {
        const key = `polygon:${polygon.id}`;
        const selected = props.selected?.kind === "polygon" && props.selected.id === polygon.id;
        if (props.hidden.has(key) && !selected) return null;
        return (
          <Polygon
            key={polygon.id}
            positions={geoJsonPolygonToLeaflet(polygon.coordinates)}
            ref={(layer) => {
              if (!layer) return;
              if (selected) layer.bringToFront();
              const path = layer.getElement();
              path?.setAttribute("data-feature-kind", "polygon");
              path?.setAttribute("data-feature-id", polygon.id);
            }}
            pathOptions={{ color: selected ? "#B7792D" : "#0F6B63", weight: selected ? 4 : 2, fillOpacity: selected ? 0.38 : 0.16, className: selected ? "selected-feature" : "" }}
            eventHandlers={{ click: (event) => { L.DomEvent.stopPropagation(event.originalEvent); props.onSelect({ kind: "polygon", id: polygon.id }); } }}
          />
        );
      })}
      {props.pendingPolygons.map((polygon) => {
        const key = `polygon:${polygon.id}`;
        const selected = props.selected?.kind === "polygon" && props.selected.id === polygon.id;
        if (props.hidden.has(key) && !selected) return null;
        return (
          <Polygon
            key={polygon.id}
            positions={geoJsonPolygonToLeaflet(polygon.coordinates)}
            ref={(layer) => {
              if (!layer) return;
              if (selected) layer.bringToFront();
              const path = layer.getElement();
              path?.setAttribute("data-feature-kind", "polygon");
              path?.setAttribute("data-feature-id", polygon.id);
            }}
            pathOptions={{ color: "#C1842D", weight: selected ? 4 : 2, dashArray: "6 6", fillColor: selected ? "#E6BD76" : "#F4E7CE", fillOpacity: selected ? 0.38 : 0.2, className: selected ? "selected-feature unsaved-feature" : "unsaved-feature" }}
            eventHandlers={{ click: (event) => { L.DomEvent.stopPropagation(event.originalEvent); props.onSelect({ kind: "polygon", id: polygon.id }); } }}
          />
        );
      })}
    </MapContainer>
  );
}

function FitIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z" /></svg>;
}