// Composes domain hooks into the props consumed by the workspace layout.
import { useMemo } from "react";
import { useDrafts } from "./useDrafts";
import { useDrawing } from "./useDrawing";
import { useLayerManagement } from "./useLayerManagement";
import { useMapData } from "./useMapData";
import { useMapFilters } from "./useMapFilters";
import { useSelection, useSelectionSync } from "./useSelection";
import { useWorkspaceActions } from "./useWorkspaceActions";
import type { WorkspaceViewProps } from "../WorkspaceView";

export function useWorkspaceViewModel(): WorkspaceViewProps {
  const filters = useMapFilters();
  const mapState = useMapData(filters.mapDataQuery, filters.generation, { id: filters.within, setId: filters.setWithin });
  const selection = useSelection();
  const objectTypes = mapState.objectTypes.data ?? [];
  const allLayers = mapState.layers.data ?? [];
  const layers = useLayerManagement({ layers: allLayers, setHiddenLayerIds: selection.setHiddenLayerIds });
  const drafts = useDrafts({
    activeLayerId: layers.activeLayer?.id,
    objectTypes,
    savedItems: mapState.savedItems,
    setSelected: selection.setSelected,
    refresh: mapState.invalidateMapData,
    refreshPolygonsAndMapData: mapState.invalidatePolygonsAndMapData,
  });
  const drawing = useDrawing({
    activeLayerId: layers.activeLayer?.id,
    addObjectDraft: drafts.addObject,
    addPolygonDraft: drafts.addPolygon,
    objectTypes,
    setSelected: selection.setSelected,
  });
  const actions = useWorkspaceActions({ drafts, drawing, filters, mapState, selection });
  const items = drafts.items;
  const visibleItems = useMemo(
    () => items.filter((item) => !selection.hiddenLayerIds.has(item.layerId)).map(drawing.applyGeometry),
    [items, selection.hiddenLayerIds, drawing.geometrySession],
  );
  useSelectionSync({
    items,
    selected: selection.selected,
    setSelected: selection.setSelected,
    hiddenLayerIds: selection.hiddenLayerIds,
    clearGeometrySession: drawing.clearGeometrySession,
    rowRefs: selection.rowRefs,
  });

  const selectedItem = selection.selected
    ? items.find((item) => item.kind === selection.selected?.kind && item.id === selection.selected.id)
    : undefined;
  const selectedWithGeometry = selectedItem ? drawing.applyGeometry(selectedItem) : undefined;
  const loading = mapState.mapData.isLoading || mapState.layers.isLoading
    || mapState.objectTypes.isLoading || mapState.polygonOptions.isLoading;
  const queryError = [mapState.layers.error, mapState.objectTypes.error, mapState.polygonOptions.error].find(Boolean);
  const error = actions.errorMessage || mapState.withinError || queryError?.message || "";
  const filterNotice = filters.mapViewOnly
    ? "Showing only items that match the table filters and the current map view"
    : "Showing only items that match the table filters";

  return {
    unsavedCount: drafts.unsavedCount,
    map: {
        items: visibleItems,
        hidden: selection.hidden,
        hiddenLayerIds: selection.hiddenLayerIds,
        layerColors: layers.layerColors,
        selected: selection.selected,
        geometryEdit: drawing.geometrySession
          ? { kind: drawing.geometrySession.kind, id: drawing.geometrySession.id, mode: drawing.geometrySession.mode }
          : null,
        drawing: drawing.drawing,
        addingObject: Boolean(drawing.addingObject),
        navigationRequest: selection.navigationRequest,
        mapViewOnly: filters.mapViewOnly,
        onViewportChange: filters.reportViewport,
        loadedCount: mapState.loadedCount,
        moreAvailable: Boolean(mapState.mapData.hasNextPage),
        filterNotice: filters.isFiltered ? filterNotice : "",
        activeFilterCount: filters.activeFilterCount,
        onResetFilters: filters.resetAll,
        onSelect: (next) => selection.handleSelect(next, drawing.geometrySession !== null),
        onObjectMoveEnd: drawing.moveObject,
        onPolygonGeometryChange: drawing.editPolygonGeometry,
        onObjectPlace: drawing.placeObject,
        onPolygonDrawn: drawing.onPolygonDrawn,
        onCancelDrawing: drawing.cancelDrawing,
    },
    details: selectedWithGeometry ? {
        item: selectedWithGeometry,
        layers: allLayers,
        onSaveChanges: actions.saveDetails,
        onDuplicate: actions.duplicateItem,
        onDelete: actions.deleteDetailsItem,
        geometryMode: drawing.geometrySession?.mode ?? null,
        geometryPending: Boolean(drawing.geometryPending),
        geometrySessionActive: drawing.geometrySession !== null,
        resetToken: drawing.detailsResetToken,
        onStartGeometry: (mode) => drawing.startGeometryEdit(selectedWithGeometry, mode),
        onStopGeometryMode: drawing.stopGeometryMode,
        onCancel: drawing.cancelGeometry,
        onClose: () => {
          if (drawing.geometrySession) drawing.cancelGeometry();
          selection.setSelected(null);
        },
    } : null,
    sidebar: {
        defaultLayerMissing: !layers.defaultLayer && !mapState.layers.isLoading,
        loading,
        polygon: {
          active: !drawing.geometrySession && Boolean(drawing.drawing) && !drawing.addingObject,
          selected: selection.selected?.kind === "polygon",
          pendingCount: drafts.unsavedCount,
          shape: drawing.selectedPolygonShape,
          confirmDeleteAll: selection.confirmDeleteAll,
          deleteAllCount: actions.deleteAllCount,
          actionsDisabled: drawing.geometrySession !== null || drafts.saving || actions.countingDeleteAll || !layers.activeLayer,
          error,
          onDismissError: () => { actions.setErrorMessage(""); mapState.dismissWithinError(); },
          onShapeChange: (shape) => {
            drawing.setSelectedPolygonShape(shape);
            if (drawing.drawing) drawing.setDrawing(null);
          },
          onAdd: () => drawing.addPolygon(drawing.selectedPolygonShape, () => selection.setConfirmDeleteAll(false)),
          onCancelAdd: () => drawing.setDrawing(null),
          onSave: () => { void drafts.saveDrafts(actions.setErrorMessage); },
          onDelete: () => actions.deleteSelected("polygon"),
          onDeleteAll: () => { void actions.handleDeleteAllPolygons(); },
        },
        objects: {
          objectTypes,
          selectedType: drawing.selectedObjectType,
          active: !drawing.geometrySession && Boolean(drawing.addingObject),
          selected: selection.selected?.kind === "object",
          pendingCount: drafts.unsavedCount,
          actionsDisabled: drawing.geometrySession !== null || drafts.saving || !layers.activeLayer,
          onSelectType: (type) => {
            drawing.setSelectedObjectType(type);
            if (drawing.addingObject) drawing.setAddingObject(null);
          },
          onAdd: () => drawing.addObject(drawing.selectedObjectType, () => selection.setConfirmDeleteAll(false)),
          onCancelAdd: () => drawing.setAddingObject(null),
          onSave: () => { void drafts.saveDrafts(actions.setErrorMessage); },
          onDelete: () => actions.deleteSelected("object"),
        },
        mapData: {
          view: { items: visibleItems, selected: selection.selected, hidden: selection.hidden, layerColors: layers.layerColors, rowRefs: selection.rowRefs },
          filters,
          query: { objectTypes, polygonOptions: mapState.polygonOptions.data ?? [] },
          paging: {
            loadedCount: mapState.loadedCount,
            hasNextPage: Boolean(mapState.mapData.hasNextPage),
            isLoading: mapState.mapData.isLoading && items.length === 0,
            isFetching: mapState.mapData.isFetching && !mapState.mapData.isFetchingNextPage,
            error: mapState.mapData.error?.message ?? mapState.loadAllError ?? mapState.withinError,
            isPlaceholderData: mapState.mapData.isPlaceholderData,
            isFetchingNextPage: mapState.mapData.isFetchingNextPage,
            loadAllActive: mapState.loadAllActive,
            loadAllProgress: mapState.loadAllProgress,
            loadAllStopped: mapState.loadAllStopped,
          },
          layers: {
            layers: allLayers,
            activeLayerId: layers.activeLayer?.id ?? "",
            hiddenLayerIds: selection.hiddenLayerIds,
            onSetActive: layers.setActiveLayerId,
            onToggleVisibility: selection.toggleLayerVisibility,
            onCreate: layers.createLayer,
            onUpdate: layers.updateLayer,
            onDelete: (id) => layers.deleteLayer(id, drafts.reassignLayer),
          },
          actions: {
            onLoadMore: () => { void mapState.loadMore(); },
            onLoadAll: () => { void mapState.loadAll(); },
            onCancelLoadAll: mapState.cancelLoadAll,
            onSelect: (next) => selection.handleSelect(next, drawing.geometrySession !== null),
            onDoubleClick: (item) => selection.navigateToItem(item, drawing.geometrySession !== null),
            onToggleVisibility: selection.toggleVisibility,
          },
        },
        addingObjectLabel: drawing.addingObject
          ? objectTypes.find((type) => type.id === drawing.addingObject)?.label ?? "object"
          : "",
        drawing: drawing.drawing,
    },
  };
}
