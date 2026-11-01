// Handles map gestures for drawing shapes and placing objects.
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { CircleMarker, Polygon, Polyline, useMap } from "react-leaflet";
import type { DrawingShape, Selection } from "../types/map";
import { centroidOfRing } from "../geometry/centroid";
import { createCircleDraft } from "../geometry/circles";
import type { LeafletPosition } from "../geometry/coordinates";
import {
  geoJsonPolygonToLeaflet,
  leafletPolygonToGeoJson,
  rectangleToGeoJson,
} from "./coords";

type ShapeDrawingProps = {
  shape: DrawingShape | null;
  addingObject: boolean;
  onShapeComplete: (coordinates: number[][][], center: LeafletPosition) => void;
  onObjectPlace: (point: LeafletPosition) => void;
  onSelect: (selection: Selection) => void;
  onCancel: () => void;
};

type DragState = {
  shape: "Rectangle" | "Circle";
  start: LeafletPosition;
  startPoint: L.Point;
  wasDraggingEnabled: boolean;
};

type PointerPosition = { point: L.Point; latlng: L.LatLng };

export function ShapeDrawing(props: ShapeDrawingProps) {
  const map = useMap();
  const propsRef = useRef(props);
  propsRef.current = props;
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const polygonPointsRef = useRef<LeafletPosition[]>([]);
  const [polygonPoints, setPolygonPoints] = useState<LeafletPosition[]>([]);
  const [polygonCursor, setPolygonCursor] = useState<LeafletPosition | null>(null);
  const [dragPreview, setDragPreview] = useState<LeafletPosition[][] | null>(null);

  useEffect(() => {
    const container = map.getContainer();
    const hasActiveMode = props.shape !== null || props.addingObject;
    container.classList.toggle("map-drawing-active", hasActiveMode);
    const doubleClickZoomWasEnabled = map.doubleClickZoom.enabled();
    if (props.shape === "Polygon") map.doubleClickZoom.disable();

    return () => {
      container.classList.remove("map-drawing-active");
      if (doubleClickZoomWasEnabled) map.doubleClickZoom.enable();
    };
  }, [map, props.shape, props.addingObject]);

  useEffect(() => {
    const clearPolygon = () => {
      polygonPointsRef.current = [];
      setPolygonPoints([]);
      setPolygonCursor(null);
    };

    const restoreDragging = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragPreview(null);
      if (drag?.wasDraggingEnabled) map.dragging.enable();
    };

    const cancelMode = () => {
      restoreDragging();
      clearPolygon();
      propsRef.current.onCancel();
    };

    const pointerFromTouch = (touch: Touch): PointerPosition => {
      const bounds = map.getContainer().getBoundingClientRect();
      const point = L.point(touch.clientX - bounds.left, touch.clientY - bounds.top);
      return { point, latlng: map.containerPointToLatLng(point) };
    };

    const previewFor = (shape: "Rectangle" | "Circle", start: LeafletPosition, end: LeafletPosition) => {
      if (shape === "Rectangle") return geoJsonPolygonToLeaflet(rectangleToGeoJson(start, end));
      return geoJsonPolygonToLeaflet(createCircleDraft(start, end).coordinates);
    };

    const updateDrag = (position: PointerPosition) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.startPoint.distanceTo(position.point) < 5) {
        setDragPreview(null);
        return;
      }
      const end: LeafletPosition = [position.latlng.lat, position.latlng.lng];
      setDragPreview(previewFor(drag.shape, drag.start, end));
    };

    const startDrag = (latlng: L.LatLng, point: L.Point, originalEvent: Event) => {
      const shape = propsRef.current.shape;
      if (shape !== "Rectangle" && shape !== "Circle") return;
      const mouseEvent = originalEvent as MouseEvent;
      if (typeof mouseEvent.button === "number" && mouseEvent.button !== 0) return;
      originalEvent.preventDefault();
      L.DomEvent.stopPropagation(originalEvent);
      const wasDraggingEnabled = map.dragging.enabled();
      if (wasDraggingEnabled) map.dragging.disable();
      dragRef.current = {
        shape,
        start: [latlng.lat, latlng.lng],
        startPoint: point,
        wasDraggingEnabled,
      };
      setDragPreview(null);
    };

    const finishDrag = (position: PointerPosition) => {
      const drag = dragRef.current;
      if (!drag) return;
      const largeEnough = drag.startPoint.distanceTo(position.point) >= 5;
      if (largeEnough) {
        const end: LeafletPosition = [position.latlng.lat, position.latlng.lng];
        const coordinates = previewFor(drag.shape, drag.start, end);
        const geoJson = leafletPolygonToGeoJson(coordinates);
        const center: LeafletPosition = drag.shape === "Circle"
          ? drag.start
          : [(drag.start[0] + end[0]) / 2, (drag.start[1] + end[1]) / 2];
        restoreDragging();
        suppressClickRef.current = true;
        window.setTimeout(() => { suppressClickRef.current = false; }, 300);
        propsRef.current.onShapeComplete(geoJson, center);
        return;
      }
      restoreDragging();
    };

    const onMouseDown = (event: L.LeafletMouseEvent) => {
      startDrag(event.latlng, map.latLngToContainerPoint(event.latlng), event.originalEvent);
    };

    const onMouseMove = (event: L.LeafletMouseEvent) => {
      const position = { point: map.latLngToContainerPoint(event.latlng), latlng: event.latlng };
      if (dragRef.current) updateDrag(position);
      if (propsRef.current.shape === "Polygon") setPolygonCursor([event.latlng.lat, event.latlng.lng]);
    };

    const onMouseUp = (event: L.LeafletMouseEvent) => {
      finishDrag({ point: map.latLngToContainerPoint(event.latlng), latlng: event.latlng });
    };

    const onTouchStart = (event: TouchEvent) => {
      if (!event.changedTouches.length) return;
      const position = pointerFromTouch(event.changedTouches[0]);
      startDrag(position.latlng, position.point, event);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!dragRef.current || !event.changedTouches.length) return;
      event.preventDefault();
      updateDrag(pointerFromTouch(event.changedTouches[0]));
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!dragRef.current || !event.changedTouches.length) return;
      finishDrag(pointerFromTouch(event.changedTouches[0]));
    };

    const onTouchCancel = () => {
      if (propsRef.current.shape || propsRef.current.addingObject || dragRef.current) cancelMode();
    };

    const appendPolygonPoint = (point: LeafletPosition) => {
      const points = polygonPointsRef.current;
      if (points.length && map.latLngToContainerPoint(points[points.length - 1]).distanceTo(map.latLngToContainerPoint(point)) < 2) return;
      const next = [...points, point];
      polygonPointsRef.current = next;
      setPolygonPoints(next);
    };

    const completePolygon = () => {
      const points = polygonPointsRef.current;
      if (points.length < 3) return false;
      const coordinates = leafletPolygonToGeoJson([points]);
      clearPolygon();
      const centroid = centroidOfRing(coordinates[0]);
      propsRef.current.onShapeComplete(coordinates, [centroid.lat, centroid.lon]);
      return true;
    };

    const onMapClick = (event: L.LeafletMouseEvent) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (event.layer) return;
      const target = event.originalEvent.target;
      if (target instanceof Element) {
        const feature = target.closest<HTMLElement>("[data-feature-kind][data-feature-id]");
        if (feature?.dataset.featureKind && feature.dataset.featureId) {
          propsRef.current.onSelect({ kind: feature.dataset.featureKind as "object" | "polygon", id: feature.dataset.featureId });
          return;
        }
        if (target.closest(".leaflet-interactive, .leaflet-marker-icon")) return;
      }
      const current = propsRef.current;
      const point: LeafletPosition = [event.latlng.lat, event.latlng.lng];
      if (current.shape === "Polygon") {
        const points = polygonPointsRef.current;
        if (points.length >= 3 && map.latLngToContainerPoint(points[0]).distanceTo(map.latLngToContainerPoint(point)) <= 12) {
          completePolygon();
          return;
        }
        appendPolygonPoint(point);
      } else if (current.shape === "Rectangle" || current.shape === "Circle") {
        return;
      } else if (current.addingObject) {
        current.onObjectPlace(point);
      } else {
        current.onSelect(null);
      }
    };

    const onDoubleClick = (event: L.LeafletMouseEvent) => {
      if (propsRef.current.shape !== "Polygon") return;
      appendPolygonPoint([event.latlng.lat, event.latlng.lng]);
      completePolygon();
      L.DomEvent.stopPropagation(event.originalEvent);
      L.DomEvent.preventDefault(event.originalEvent);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (propsRef.current.shape || propsRef.current.addingObject || dragRef.current)) cancelMode();
    };

    const container = map.getContainer();
    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);
    map.on("click", onMapClick);
    map.on("dblclick", onDoubleClick);
    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: false });
    container.addEventListener("touchcancel", onTouchCancel);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      restoreDragging();
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      map.off("click", onMapClick);
      map.off("dblclick", onDoubleClick);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchCancel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [map]);

  const polygonLine = polygonCursor && polygonPoints.length
    ? [polygonPoints[polygonPoints.length - 1], polygonCursor]
    : [];
  const closingLine = polygonCursor && polygonPoints.length >= 3
    ? [polygonCursor, polygonPoints[0]]
    : [];

  return (
    <>
      {polygonLine.length > 0 && <Polyline positions={polygonLine} pathOptions={{ color: "#0F6B63", weight: 1.5, interactive: false }} />}
      {closingLine.length > 0 && <Polyline positions={closingLine} pathOptions={{ color: "#0F6B63", weight: 1, opacity: 0.3, dashArray: "3 4", interactive: false }} />}
      {polygonPoints.map((point, index) => (
        <CircleMarker key={`${point[0]}:${point[1]}:${index}`} center={point} radius={index === 0 ? 5 : 3} pathOptions={{ color: "#0F6B63", weight: 1.5, fillColor: "#fff", fillOpacity: 1, interactive: false }} />
      ))}
      {dragPreview && <Polygon positions={dragPreview} pathOptions={{ color: "#0F6B63", weight: 2, fillOpacity: 0.12, interactive: false }} />}
    </>
  );
}
