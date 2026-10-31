import type { MutableRefObject } from "react";
import type { ObjectTypeDto, PolygonDto } from "../api/types";
import type { Selection, TableItem } from "../types/map";
import { useMapFilters } from "../hooks/useMapFilters";

type MapDataPanelProps = {
  items: TableItem[];
  selected: Selection;
  hidden: Set<string>;
  rowRefs: MutableRefObject<Map<string, HTMLTableRowElement>>;
  filters: ReturnType<typeof useMapFilters>;
  objectTypes: ObjectTypeDto[];
  polygonOptions: PolygonDto[];
  loadedCount: number;
  hasNextPage: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: string;
  isPlaceholderData: boolean;
  isFetchingNextPage: boolean;
  loadAllActive: boolean;
  loadAllProgress: string;
  loadAllStopped: boolean;
  onLoadMore: () => void;
  onLoadAll: () => void;
  onCancelLoadAll: () => void;
  onSelect: (selection: Selection) => void;
  onDoubleClick: (item: TableItem) => void;
  onToggleVisibility: (id: string) => void;
};

export function MapDataPanel(props: MapDataPanelProps) {
  const { filters } = props;
  const filterNotice = filters.mapViewOnly
    ? "Showing only items that match the table filters and the current map view"
    : "Showing only items that match the table filters";

  return (
    <section className="panel data-panel">
      <div className="panel-heading"><span className="panel-symbol data-symbol" /> <h2>Map Data</h2><span className="item-count">{props.items.length}</span></div>
      <div className="map-data-toolbar">
        <input
          type="search"
          value={filters.searchInput}
          onChange={(event) => filters.setSearchInput(event.target.value)}
          placeholder="Search map data"
          aria-label="Search map data"
        />
        <button className="button button-secondary" aria-expanded={filters.filtersOpen} onClick={() => filters.setFiltersOpen((open) => !open)}>
          Filters{filters.activeFilterCount ? ` (${filters.activeFilterCount})` : ""}
        </button>
        <button className={`button button-secondary map-only-toggle${filters.mapViewOnly ? " is-active" : ""}`} aria-pressed={filters.mapViewOnly} onClick={() => filters.setMapViewOnly(!filters.mapViewOnly)}>
          Map view only
        </button>
      </div>
      {filters.isFiltered && (
        <div className="table-filter-warning" role="status">
          <span>{filterNotice} · {filters.activeFilterCount} active filters</span>
          <button onClick={filters.resetAll}>Reset</button>
        </div>
      )}
      {filters.filtersOpen && (
        <div className="filter-panel">
          <label>Type
            <select value={filters.type} onChange={(event) => filters.setType(event.target.value)}>
              <option value="all">All</option>
              <option value="polygon">Polygon</option>
              {props.objectTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
            </select>
          </label>
          <label>Creator
            <input value={filters.creator} onChange={(event) => filters.setCreator(event.target.value)} placeholder="Exact creator" />
          </label>
          <label>Created
            <select value={filters.createdWithinDays ?? ""} onChange={(event) => filters.setCreatedWithinDays(event.target.value ? Number(event.target.value) : null)}>
              <option value="">Any time</option>
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
          <label>Inside polygon
            <select value={filters.within} onChange={(event) => filters.setWithin(event.target.value)}>
              <option value="">Any</option>
              {props.polygonOptions.map((polygon) => <option key={polygon.id} value={polygon.id}>{polygon.name}</option>)}
            </select>
          </label>
          <button className="filter-reset" onClick={filters.resetAll}>Reset all</button>
        </div>
      )}
      {filters.chips.length > 0 && <div className="filter-chips">{filters.chips.map((chip) => (
        <button key={chip.id} className="filter-chip" onClick={() => filters.removeChip(chip.id)} aria-label={`Remove ${chip.label}`}>
          {chip.label}<span aria-hidden="true">×</span>
        </button>
      ))}</div>}
      {props.isFetching && props.items.length > 0 && <p className="updating-line">Updating map data…</p>}
      {props.error && <div className="error-message" role="alert">{props.error}</div>}
      {props.isLoading && <div className="table-loading" aria-label="Loading map data"><span /><span /><span /></div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Object</th><th>Lat</th><th>Lon</th><th><span className="visually-hidden">Visibility</span></th></tr></thead>
          <tbody>
            {props.items.map((item) => {
              const key = `${item.kind}:${item.id}`;
              const isSelected = props.selected?.kind === item.kind && props.selected.id === item.id;
              const isHidden = props.hidden.has(item.id);
              return (
                <tr
                  key={key}
                  ref={(element) => { if (element) props.rowRefs.current.set(key, element); else props.rowRefs.current.delete(key); }}
                  className={`${isSelected ? "is-selected" : ""}${isHidden ? " is-hidden" : ""}`}
                  onClick={() => props.onSelect({ kind: item.kind, id: item.id })}
                  onDoubleClick={() => props.onDoubleClick(item)}
                  aria-selected={isSelected}
                >
                  <td>{item.label}{!item.saved && <span className="unsaved-dot" title="Unsaved" />}</td>
                  <td>{item.center.lat.toFixed(5)}</td>
                  <td>{item.center.lon.toFixed(5)}</td>
                  <td>
                    <button className="eye-button" aria-label={`${isHidden ? "Show" : "Hide"} ${item.label}`} title={`${isHidden ? "Show" : "Hide"} on map`} onClick={(event) => { event.stopPropagation(); props.onToggleVisibility(item.id); }}>
                      {isHidden ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!props.isLoading && !props.items.length && !props.error && <p className="empty-state">No items match</p>}
      </div>
      <div className="table-footer">
        <span>Loaded {props.loadedCount}{props.hasNextPage ? " · more available" : ""}</span>
        {props.hasNextPage && (
          <div className="load-controls">
            {props.loadAllActive
              ? <button className="button button-secondary" onClick={props.onCancelLoadAll}>Cancel</button>
              : <>
                <button className="button button-secondary" disabled={props.isPlaceholderData || props.isFetchingNextPage} onClick={props.onLoadMore}>{props.isFetchingNextPage ? "Loading…" : "Load more"}</button>
                <button className="button button-primary" disabled={props.isPlaceholderData || props.isFetchingNextPage} onClick={props.onLoadAll}>Load all</button>
              </>}
          </div>
        )}
      </div>
      {props.loadAllProgress && <p className="load-progress">{props.loadAllProgress}</p>}
      {props.loadAllStopped && <p className="load-cap">Stopped at 1000. Narrow the filters.</p>}
    </section>
  );
}

function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

function EyeOffIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a15 15 0 0 1-3.1 3.6M6.2 6.3C3.5 8 2 12 2 12s3.5 6 10 6a10 10 0 0 0 3-.5" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
}
