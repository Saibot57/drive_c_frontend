'use client';

import { useCallback, useRef } from 'react';
import { useWorkspace } from './WorkspaceContext';
import { workspaceService } from '../services/workspaceService';
import type { ElementType, ViewportState } from '../types/workspace.types';
import { DEFAULT_ELEMENT_WIDTH, DEFAULT_ELEMENT_HEIGHT, DEBOUNCE_POSITION_MS, DEBOUNCE_CONTENT_MS } from '../types/constants';
import { screenToCanvas, snapToGrid } from '../types/utils';
import { GRID_SIZE } from '../types/constants';

export function useWorkspaceData() {
  const { state, dispatch } = useWorkspace();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function debounced(key: string, fn: () => Promise<unknown>, delay: number) {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      try {
        await fn();
      } catch (err) {
        console.error('Workspace sync failed:', err);
      }
    }, delay);
  }

  // ── Load surfaces ──
  const loadSurfaces = useCallback(async () => {
    try {
      const surfaces = await workspaceService.getSurfaces();
      dispatch({ type: 'SET_SURFACES', surfaces });
      if (surfaces.length > 0 && !state.activeSurfaceId) {
        dispatch({ type: 'SET_ACTIVE_SURFACE', surfaceId: surfaces[0].id });
        await loadSurfaceElements(surfaces[0].id);
      }
    } catch (err) {
      console.error('Failed to load surfaces:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load elements for a surface ──
  const loadSurfaceElements = useCallback(async (surfaceId: string) => {
    try {
      const placements = await workspaceService.getSurfaceElements(surfaceId);
      dispatch({ type: 'SET_PLACEMENTS', placements });
      const elements = placements
        .filter((p) => p.element)
        .map((p) => p.element!);
      dispatch({ type: 'SET_ELEMENTS', elements });
    } catch (err) {
      console.error('Failed to load surface elements:', err);
    }
  }, [dispatch]);

  // ── Select surface ──
  const selectSurface = useCallback(async (surfaceId: string) => {
    dispatch({ type: 'SET_ACTIVE_SURFACE', surfaceId });
    await loadSurfaceElements(surfaceId);
  }, [dispatch, loadSurfaceElements]);

  // ── Create surface ──
  const createSurface = useCallback(async (name: string) => {
    try {
      const surface = await workspaceService.createSurface(name);
      dispatch({ type: 'ADD_SURFACE', surface });
      dispatch({ type: 'SET_ACTIVE_SURFACE', surfaceId: surface.id });
      dispatch({ type: 'SET_PLACEMENTS', placements: [] });
      return surface;
    } catch (err) {
      console.error('Failed to create surface:', err);
      return null;
    }
  }, [dispatch]);

  // ── Create + place element ──
  const createAndPlaceElement = useCallback(async (
    type: ElementType,
    viewport: ViewportState,
    containerWidth: number,
    containerHeight: number,
  ) => {
    if (!state.activeSurfaceId) return;

    const defaultContent = getDefaultContent(type);
    const elWidth =
      type === 'sticky' ? 200 :
      type === 'kanban' ? 480 :
      type === 'pdf' ? 480 :
      type === 'image' ? 320 :
      DEFAULT_ELEMENT_WIDTH;
    const elHeight =
      type === 'sticky' ? 200 :
      type === 'kanban' ? 320 :
      type === 'pdf' ? 600 :
      type === 'image' ? 240 :
      DEFAULT_ELEMENT_HEIGHT;
    try {
      const element = await workspaceService.createElement(type, 'Untitled', defaultContent);
      dispatch({ type: 'SET_ELEMENT', element });

      const center = screenToCanvas(
        containerWidth / 2,
        containerHeight / 2,
        viewport.panX,
        viewport.panY,
        viewport.zoom,
      );

      const placement = await workspaceService.placeElement(state.activeSurfaceId, {
        element_id: element.id,
        position_x: snapToGrid(center.x - elWidth / 2, GRID_SIZE),
        position_y: snapToGrid(center.y - elHeight / 2, GRID_SIZE),
        width: elWidth,
        height: elHeight,
        is_locked: false,
      });
      dispatch({ type: 'ADD_PLACEMENT', placement });
      dispatch({ type: 'SELECT_ELEMENT', elementId: element.id });
    } catch (err) {
      console.error('Failed to create element:', err);
    }
  }, [state.activeSurfaceId, dispatch]);

  // ── Update element content (debounced) ──
  const updateElementContent = useCallback((elementId: string, content: unknown) => {
    dispatch({
      type: 'SET_ELEMENT',
      element: { ...state.elements[elementId], content },
    });
    debounced(`content-${elementId}`, () =>
      workspaceService.updateElement(elementId, { content }),
      DEBOUNCE_CONTENT_MS,
    );
  }, [state.elements, dispatch]);

  // ── Update element title ──
  const updateElementTitle = useCallback((elementId: string, title: string) => {
    dispatch({
      type: 'SET_ELEMENT',
      element: { ...state.elements[elementId], title },
    });
    debounced(`title-${elementId}`, () =>
      workspaceService.updateElement(elementId, { title }),
      DEBOUNCE_CONTENT_MS,
    );
  }, [state.elements, dispatch]);

  // ── Move placement (debounced) ──
  const movePlacement = useCallback((placementId: string, x: number, y: number) => {
    dispatch({
      type: 'UPDATE_PLACEMENT',
      placementId,
      changes: { position_x: x, position_y: y },
    });
    debounced(`pos-${placementId}`, () =>
      workspaceService.updatePlacement(placementId, { position_x: x, position_y: y }),
      DEBOUNCE_POSITION_MS,
    );
  }, [dispatch]);

  // ── Resize placement (debounced) ──
  const resizePlacement = useCallback((placementId: string, width: number, height: number) => {
    dispatch({
      type: 'UPDATE_PLACEMENT',
      placementId,
      changes: { width, height },
    });
    debounced(`size-${placementId}`, () =>
      workspaceService.updatePlacement(placementId, { width, height }),
      DEBOUNCE_POSITION_MS,
    );
  }, [dispatch]);

  // ── Toggle lock ──
  const toggleLock = useCallback(async (placementId: string) => {
    const p = state.placements.find((pl) => pl.id === placementId);
    if (!p) return;
    const newLocked = !p.is_locked;
    dispatch({
      type: 'UPDATE_PLACEMENT',
      placementId,
      changes: { is_locked: newLocked },
    });
    try {
      await workspaceService.updatePlacement(placementId, { is_locked: newLocked });
    } catch (err) {
      console.error('Failed to toggle lock:', err);
      dispatch({ type: 'UPDATE_PLACEMENT', placementId, changes: { is_locked: !newLocked } });
    }
  }, [state.placements, dispatch]);

  // ── Move to storage / canvas ──
  const moveToStorage = useCallback(async (placementId: string) => {
    dispatch({ type: 'UPDATE_PLACEMENT', placementId, changes: { is_on_canvas: false } });
    try {
      await workspaceService.updatePlacement(placementId, { is_on_canvas: false });
    } catch (err) {
      console.error('Failed to move to storage:', err);
      dispatch({ type: 'UPDATE_PLACEMENT', placementId, changes: { is_on_canvas: true } });
    }
  }, [dispatch]);

  const moveToCanvas = useCallback(async (placementId: string) => {
    dispatch({ type: 'UPDATE_PLACEMENT', placementId, changes: { is_on_canvas: true } });
    try {
      await workspaceService.updatePlacement(placementId, { is_on_canvas: true });
    } catch (err) {
      console.error('Failed to move to canvas:', err);
      dispatch({ type: 'UPDATE_PLACEMENT', placementId, changes: { is_on_canvas: false } });
    }
  }, [dispatch]);

  // ── Delete element ──
  const deleteElement = useCallback(async (elementId: string) => {
    dispatch({ type: 'REMOVE_ELEMENT', elementId });
    try {
      await workspaceService.deleteElement(elementId);
    } catch (err) {
      console.error('Failed to delete element:', err);
    }
  }, [dispatch]);

  // ── Mirror element ──
  const mirrorElement = useCallback(async (elementId: string, targetSurfaceId: string) => {
    try {
      const result = await workspaceService.mirrorElement(elementId, targetSurfaceId);
      // If we're viewing the target surface, add the placement
      if (state.activeSurfaceId === targetSurfaceId) {
        dispatch({ type: 'ADD_PLACEMENT', placement: result });
        if (result.element) {
          dispatch({ type: 'SET_ELEMENT', element: result.element });
        }
      }
    } catch (err) {
      console.error('Failed to mirror element:', err);
    }
  }, [state.activeSurfaceId, dispatch]);

  // ── Copy element ──
  const copyElement = useCallback(async (elementId: string, targetSurfaceId: string) => {
    try {
      const result = await workspaceService.copyElement(elementId, targetSurfaceId);
      if (state.activeSurfaceId === targetSurfaceId) {
        dispatch({ type: 'ADD_PLACEMENT', placement: result });
        if (result.element) {
          dispatch({ type: 'SET_ELEMENT', element: result.element });
        }
      }
    } catch (err) {
      console.error('Failed to copy element:', err);
    }
  }, [state.activeSurfaceId, dispatch]);

  // ── Rename surface ──
  const renameSurface = useCallback(async (surfaceId: string, name: string) => {
    dispatch({ type: 'UPDATE_SURFACE', surfaceId, changes: { name } });
    try {
      await workspaceService.updateSurface(surfaceId, { name });
    } catch (err) {
      console.error('Failed to rename surface:', err);
    }
  }, [dispatch]);

  // ── Archive / unarchive surface ──
  const archiveSurface = useCallback(async (surfaceId: string) => {
    dispatch({ type: 'UPDATE_SURFACE', surfaceId, changes: { is_archived: true } });
    try {
      await workspaceService.updateSurface(surfaceId, { is_archived: true });
      // Switch to another surface if we archived the active one
      if (state.activeSurfaceId === surfaceId) {
        const remaining = state.surfaces.filter((s) => s.id !== surfaceId && !s.is_archived);
        if (remaining.length > 0) {
          await selectSurface(remaining[0].id);
        } else {
          dispatch({ type: 'SET_ACTIVE_SURFACE', surfaceId: '' });
          dispatch({ type: 'SET_PLACEMENTS', placements: [] });
        }
      }
    } catch (err) {
      console.error('Failed to archive surface:', err);
      dispatch({ type: 'UPDATE_SURFACE', surfaceId, changes: { is_archived: false } });
    }
  }, [state.activeSurfaceId, state.surfaces, selectSurface, dispatch]);

  const unarchiveSurface = useCallback(async (surfaceId: string) => {
    dispatch({ type: 'UPDATE_SURFACE', surfaceId, changes: { is_archived: false } });
    try {
      await workspaceService.updateSurface(surfaceId, { is_archived: false });
    } catch (err) {
      console.error('Failed to unarchive surface:', err);
      dispatch({ type: 'UPDATE_SURFACE', surfaceId, changes: { is_archived: true } });
    }
  }, [dispatch]);

  // ── Delete surface ──
  const deleteSurface = useCallback(async (surfaceId: string) => {
    dispatch({ type: 'REMOVE_SURFACE', surfaceId });
    try {
      await workspaceService.deleteSurface(surfaceId);
      if (state.activeSurfaceId === surfaceId) {
        const remaining = state.surfaces.filter((s) => s.id !== surfaceId);
        if (remaining.length > 0) {
          await selectSurface(remaining[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to delete surface:', err);
    }
  }, [state.activeSurfaceId, state.surfaces, selectSurface, dispatch]);

  return {
    state,
    dispatch,
    loadSurfaces,
    loadSurfaceElements,
    selectSurface,
    createSurface,
    createAndPlaceElement,
    updateElementContent,
    updateElementTitle,
    renameSurface,
    movePlacement,
    resizePlacement,
    toggleLock,
    moveToStorage,
    moveToCanvas,
    deleteElement,
    mirrorElement,
    copyElement,
    archiveSurface,
    unarchiveSurface,
    deleteSurface,
  };
}

function getDefaultContent(type: ElementType): unknown {
  switch (type) {
    case 'text':
      return { type: 'doc', content: [{ type: 'paragraph' }] };
    case 'table':
      return { headers: ['Kolumn 1', 'Kolumn 2'], rows: [['', '']], cellColors: {}, borderColor: '#e5e7eb' };
    case 'mindmap':
      return { root: { id: '1', label: 'Central nod', children: [] } };
    case 'list':
      return { items: [{ id: '1', text: '', done: false }] };
    case 'kanban':
      return {
        columns: [
          { id: '1', title: 'Att göra', cards: [] },
          { id: '2', title: 'Pågår', cards: [] },
          { id: '3', title: 'Klart', cards: [] },
        ],
      };
    case 'sticky':
      return { text: '', color: '#fef9c3' };
    case 'pdf':
      return { source: null };
    case 'image':
      return { source: null };
    default:
      return null;
  }
}
