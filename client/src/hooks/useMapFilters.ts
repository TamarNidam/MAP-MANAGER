import { useEffect, useRef, useState } from "react";
import type { MapDataQuery } from "../api/types";

type Bbox = [number, number, number, number];

type FilterChip = {
  id: string;
  label: string;
};

type ViewportRequest = {
  raw: Bbox;
  padded: Bbox;
  zoom: number;
};

function padBbox([minLon, minLat, maxLon, maxLat]: Bbox): Bbox {
  const lonPadding = (maxLon - minLon) * 0.25;
  const latPadding = (maxLat - minLat) * 0.25;
  return [
    Math.max(-180, minLon - lonPadding),
    Math.max(-90, minLat - latPadding),
    Math.min(180, maxLon + lonPadding),
    Math.min(90, maxLat + latPadding),
  ];
}

function bboxToQuery(bbox: Bbox): string {
  return bbox.map(String).join(",");
}

function contains(outer: Bbox, inner: Bbox): boolean {
  return outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
}

export function useMapFilters() {
  const [searchInput, setSearchInputState] = useState("");
  const [query, setQuery] = useState("");
  const [type, setTypeState] = useState("all");
  const [creator, setCreatorState] = useState("");
  const [createdWithinDays, setCreatedWithinDaysState] = useState<number | null>(null);
  const [within, setWithinState] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapViewOnly, setMapViewOnlyState] = useState(false);
  const [bbox, setBbox] = useState("");
  const [generation, setGeneration] = useState(0);
  const mapViewOnlyRef = useRef(false);
  const lastViewportRef = useRef<ViewportRequest | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bboxRef = useRef("");
  const previousQueryRef = useRef(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (previousQueryRef.current === next) return;
      previousQueryRef.current = next;
      setQuery(next);
      setGeneration((current) => current + 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => () => {
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
  }, []);

  const commit = <T,>(current: T, next: T, setter: (value: T) => void) => {
    if (current === next) return;
    setter(next);
    setGeneration((value) => value + 1);
  };

  const setSearchInput = (value: string) => setSearchInputState(value);
  const setType = (value: string) => commit(type, value, setTypeState);
  const setCreator = (value: string) => commit(creator, value, setCreatorState);
  const setCreatedWithinDays = (value: number | null) => commit(createdWithinDays, value, setCreatedWithinDaysState);
  const setWithin = (value: string) => commit(within, value, setWithinState);

  const setMapViewOnly = (value: boolean) => {
    if (mapViewOnly === value) return;
    mapViewOnlyRef.current = value;
    setMapViewOnlyState(value);
    lastViewportRef.current = null;
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    if (!value) {
      bboxRef.current = "";
      setBbox("");
      setGeneration((current) => current + 1);
    }
  };

  const reportViewport = (raw: Bbox, zoom: number) => {
    if (!mapViewOnlyRef.current) return;
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    viewportTimerRef.current = setTimeout(() => {
      if (!mapViewOnlyRef.current) return;
      const previous = lastViewportRef.current;
      const zoomChanged = previous !== null && Math.abs(zoom - previous.zoom) >= 1;
      if (previous && !zoomChanged && contains(previous.padded, raw)) return;

      const padded = padBbox(raw);
      lastViewportRef.current = { raw, padded, zoom };
      const nextBbox = bboxToQuery(padded);
      if (bboxRef.current === nextBbox && !zoomChanged) return;
      bboxRef.current = nextBbox;
      setBbox(nextBbox);
      setGeneration((value) => value + 1);
    }, 300);
  };

  const resetAll = () => {
    setSearchInputState("");
    setQuery("");
    previousQueryRef.current = "";
    setTypeState("all");
    setCreatorState("");
    setCreatedWithinDaysState(null);
    setWithinState("");
    mapViewOnlyRef.current = false;
    setMapViewOnlyState(false);
    lastViewportRef.current = null;
    bboxRef.current = "";
    setBbox("");
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    setGeneration((current) => current + 1);
  };

  const chips: FilterChip[] = [];
  if (query) chips.push({ id: "q", label: `Search: ${query}` });
  if (type !== "all") chips.push({ id: "type", label: `Type: ${type}` });
  if (creator.trim()) chips.push({ id: "creator", label: `Creator: ${creator.trim()}` });
  if (createdWithinDays) chips.push({ id: "created", label: `Created: ${createdWithinDays} days` });
  if (within) chips.push({ id: "within", label: "Inside polygon" });

  const removeChip = (id: string) => {
    if (id === "q") {
      setSearchInputState("");
      if (query) {
        setQuery("");
        previousQueryRef.current = "";
        setGeneration((value) => value + 1);
      }
    } else if (id === "type") setType("all");
    else if (id === "creator") setCreator("");
    else if (id === "created") setCreatedWithinDays(null);
    else if (id === "within") setWithin("");
  };

  const mapDataQuery: MapDataQuery = {
    ...(type !== "all" ? { type } : {}),
    ...(creator.trim() ? { creator: creator.trim() } : {}),
    ...(createdWithinDays ? { createdWithinDays } : {}),
    ...(within ? { within } : {}),
    ...(query ? { q: query } : {}),
    ...(mapViewOnly && bbox ? { bbox } : {}),
    limit: 100,
  };

  return {
    searchInput,
    setSearchInput,
    type,
    setType,
    creator,
    setCreator,
    createdWithinDays,
    setCreatedWithinDays,
    within,
    setWithin,
    filtersOpen,
    setFiltersOpen,
    mapViewOnly,
    setMapViewOnly,
    bbox,
    generation,
    mapDataQuery,
    chips,
    activeFilterCount: chips.length,
    isFiltered: chips.length > 0 || mapViewOnly,
    removeChip,
    resetAll,
    reportViewport,
  };
}
