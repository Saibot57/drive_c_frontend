'use client';

import { useCallback, useRef } from 'react';
import { usePlannerNotice } from '@/hooks/usePlannerNotice';
import { useWorkspace } from './WorkspaceContext';
import { useWorkspaceSync } from './useWorkspaceSync';
import { useWorkspaceHistory } from './useWorkspaceHistory';
import { workspaceService } from '../services/workspaceService';
import type { ElementType, SurfaceElement, ViewportState } from '../types/workspace.types';
import type { Point } from './useElementDrag';
import type { Box } from './useElementResize';
import {
  DEFAULT_ELEMENT_WIDTH,
  DEFAULT_ELEMENT_HEIGHT,
  DEBOUNCE_POSITION_MS,
  DEBOUNCE_CONTENT_MS,
  UNDO_NOTICE_MS,
  GRID_SIZE,
} from '../types/constants';
import { screenToCanvas, snapToGrid } from '../types/utils';

/** Storlekar som passar innehållet bättre än standardrutan. */
const SIZE_BY_TYPE: Partial<Record<ElementType, { w: number; h: number }>> = {
  sticky: { w: 200, h: 200 },
  kanban: { w: 480, h: 320 },
  pdf: { w: 480, h: 600 },
  image: { w: 320, h: 240 },
  link: { w: 280, h: 220 },
};

export function useWorkspaceData() {
  const { state, dispatch } = useWorkspace();
  const { plannerNotice, showNotice, dismissNotice } = usePlannerNotice();
  const { saveStatus, track } = useWorkspaceSync(showNotice);
  const { pushUndo, undo, clearHistory, canUndo } = useWorkspaceHistory();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Senaste kända state, för closures som annars skulle läsa en gammal render.
  const stateRef = useRef(state);
  stateRef.current = state;

  /**
   * Fördröjd skrivning. Position och storlek ändras många gånger i sekunden
   * under en dragning; utan den här skulle varje musrörelse bli ett anrop.
   */
  const debounced = useCallback((
    key: string,
    label: string,
    fn: () => Promise<unknown>,
    delay: number,
  ) => {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => { void track(label, fn); }, delay);
  }, [track]);

  // ── Ytor ──

  const loadSurfaceElements = useCallback(async (surfaceId: string) => {
    const placements = await track('hämta ytans element', () =>
      workspaceService.getSurfaceElements(surfaceId),
    );
    if (!placements) return;
    dispatch({ type: 'SET_PLACEMENTS', placements });
    dispatch({
      type: 'SET_ELEMENTS',
      elements: placements.filter((p) => p.element).map((p) => p.element!),
    });
  }, [dispatch, track]);

  const loadSurfaces = useCallback(async () => {
    const surfaces = await track('hämta ytorna', () => workspaceService.getSurfaces());
    if (!surfaces) return;
    dispatch({ type: 'SET_SURFACES', surfaces });

    if (surfaces.length > 0) {
      if (!stateRef.current.activeSurfaceId) {
        dispatch({ type: 'SET_ACTIVE_SURFACE', surfaceId: surfaces[0].id });
        await loadSurfaceElements(surfaces[0].id);
      }
      return;
    }

    // Ett tomt konto hade ingen yta alls, och då gjorde skapa-knapparna
    // ingenting utan att säga varför. Första ytan skapas nu åt användaren.
    const surface = await track('skapa den första ytan', () =>
      workspaceService.createSurface('Yta 1'),
    );
    if (!surface) return;
    dispatch({ type: 'ADD_SURFACE', surface });
    dispatch({ type: 'SET_ACTIVE_SURFACE', surfaceId: surface.id });
    dispatch({ type: 'SET_PLACEMENTS', placements: [] });
  }, [dispatch, loadSurfaceElements, track]);

  const selectSurface = useCallback(async (surfaceId: string) => {
    if (surfaceId === stateRef.current.activeSurfaceId) return;
    dispatch({ type: 'SET_ACTIVE_SURFACE', surfaceId });
    // Ångra-stacken pekar på element som inte längre syns.
    clearHistory();
    await loadSurfaceElements(surfaceId);
  }, [dispatch, loadSurfaceElements, clearHistory]);

  const createSurface = useCallback(async (name: string) => {
    const surface = await track('skapa ytan', () => workspaceService.createSurface(name));
    if (!surface) return null;
    dispatch({ type: 'ADD_SURFACE', surface });
    dispatch({ type: 'SET_ACTIVE_SURFACE', surfaceId: surface.id });
    dispatch({ type: 'SET_PLACEMENTS', placements: [] });
    clearHistory();
    return surface;
  }, [dispatch, track, clearHistory]);

  const renameSurface = useCallback(async (surfaceId: string, name: string) => {
    const previous = stateRef.current.surfaces.find((s) => s.id === surfaceId)?.name;
    dispatch({ type: 'UPDATE_SURFACE', surfaceId, changes: { name } });
    const ok = await track('byta namn på ytan', () =>
      workspaceService.updateSurface(surfaceId, { name }),
    );
    if (ok && previous && previous !== name) {
      pushUndo({
        label: 'namnbytet',
        undo: async () => {
          dispatch({ type: 'UPDATE_SURFACE', surfaceId, changes: { name: previous } });
          await track('återställa namnet', () =>
            workspaceService.updateSurface(surfaceId, { name: previous }),
          );
        },
      });
    }
  }, [dispatch, track, pushUndo]);

  const archiveSurface = useCallback(async (surfaceId: string) => {
    dispatch({ type: 'UPDATE_SURFACE', surfaceId, changes: { is_archived: true } });
    const ok = await track('arkivera ytan', () =>
      workspaceService.updateSurface(surfaceId, { is_archived: true }),
    );
    if (!ok) {
      dispatch({ type: 'UPDATE_SURFACE', surfaceId, changes: { is_archived: false } });
      return;
    }

    if (stateRef.current.activeSurfaceId === surfaceId) {
      const remaining = stateRef.current.surfaces.filter(
        (s) => s.id !== surfaceId && !s.is_archived,
      );
      if (remaining.length > 0) {
        await selectSurface(remaining[0].id);
      } else {
        dispatch({ type: 'SET_ACTIVE_SURFACE', surfaceId: '' });
        dispatch({ type: 'SET_PLACEMENTS', placements: [] });
      }
    }
    showNotice('Ytan arkiverades.', 'success');
  }, [dispatch, track, selectSurface, showNotice]);

  const unarchiveSurface = useCallback(async (surfaceId: string) => {
    dispatch({ type: 'UPDATE_SURFACE', surfaceId, changes: { is_archived: false } });
    const ok = await track('återställa ytan', () =>
      workspaceService.updateSurface(surfaceId, { is_archived: false }),
    );
    if (!ok) dispatch({ type: 'UPDATE_SURFACE', surfaceId, changes: { is_archived: true } });
  }, [dispatch, track]);

  /** Hård radering — ytan och dess placeringar är borta. Bekräftas i skalet. */
  const deleteSurface = useCallback(async (surfaceId: string) => {
    const remaining = stateRef.current.surfaces.filter((s) => s.id !== surfaceId);
    dispatch({ type: 'REMOVE_SURFACE', surfaceId });
    const ok = await track('ta bort ytan', () => workspaceService.deleteSurface(surfaceId));
    if (!ok) {
      await loadSurfaces();
      return;
    }
    clearHistory();
    if (stateRef.current.activeSurfaceId === surfaceId && remaining.length > 0) {
      dispatch({ type: 'SET_ACTIVE_SURFACE', surfaceId: remaining[0].id });
      await loadSurfaceElements(remaining[0].id);
    }
    showNotice('Ytan togs bort.', 'success');
  }, [dispatch, track, loadSurfaces, loadSurfaceElements, clearHistory, showNotice]);

  // ── Element ──

  const createAndPlaceElement = useCallback(async (
    type: ElementType,
    viewport: ViewportState,
    containerWidth: number,
    containerHeight: number,
  ) => {
    const surfaceId = stateRef.current.activeSurfaceId;
    if (!surfaceId) {
      showNotice('Skapa en yta först.', 'warning');
      return;
    }

    const size = SIZE_BY_TYPE[type] ?? { w: DEFAULT_ELEMENT_WIDTH, h: DEFAULT_ELEMENT_HEIGHT };
    const element = await track('skapa elementet', () =>
      workspaceService.createElement(type, 'Untitled', getDefaultContent(type)),
    );
    if (!element) return;
    dispatch({ type: 'SET_ELEMENT', element });

    const center = screenToCanvas(
      containerWidth / 2,
      containerHeight / 2,
      viewport.panX,
      viewport.panY,
      viewport.zoom,
    );

    const placement = await track('placera elementet', () =>
      workspaceService.placeElement(surfaceId, {
        element_id: element.id,
        position_x: snapToGrid(center.x - size.w / 2, GRID_SIZE),
        position_y: snapToGrid(center.y - size.h / 2, GRID_SIZE),
        width: size.w,
        height: size.h,
        is_locked: false,
      }),
    );
    if (!placement) return;

    dispatch({ type: 'ADD_PLACEMENT', placement });
    dispatch({ type: 'SELECT_ELEMENT', elementId: element.id });
    pushUndo({
      label: 'det nya elementet',
      undo: async () => {
        dispatch({ type: 'REMOVE_ELEMENT', elementId: element.id });
        await track('ta bort elementet', () => workspaceService.deleteElement(element.id));
      },
    });
  }, [dispatch, track, pushUndo, showNotice]);

  const updateElementContent = useCallback((elementId: string, content: unknown) => {
    const current = stateRef.current.elements[elementId];
    if (!current) return;
    dispatch({ type: 'SET_ELEMENT', element: { ...current, content } });
    // Innehållsändringar hamnar medvetet inte i ångra-stacken: redigerarna är
    // textfält och contenteditable som har webbläsarens egen ångring, och två
    // konkurrerande Ctrl+Z hade tagit ut varandra.
    debounced(`content-${elementId}`, 'spara innehållet', () =>
      workspaceService.updateElement(elementId, { content }), DEBOUNCE_CONTENT_MS);
  }, [dispatch, debounced]);

  const updateElementTitle = useCallback((elementId: string, title: string) => {
    const current = stateRef.current.elements[elementId];
    if (!current) return;
    const previous = current.title;
    dispatch({ type: 'SET_ELEMENT', element: { ...current, title } });
    debounced(`title-${elementId}`, 'spara namnet', () =>
      workspaceService.updateElement(elementId, { title }), DEBOUNCE_CONTENT_MS);

    if (previous !== title) {
      pushUndo({
        label: 'namnbytet',
        undo: () => updateElementTitle(elementId, previous),
      });
    }
  }, [dispatch, debounced, pushUndo]);

  // ── Geometri ──

  const movePlacement = useCallback((placementId: string, x: number, y: number) => {
    dispatch({ type: 'UPDATE_PLACEMENT', placementId, changes: { position_x: x, position_y: y } });
    debounced(`pos-${placementId}`, 'spara positionen', () =>
      workspaceService.updatePlacement(placementId, { position_x: x, position_y: y }),
      DEBOUNCE_POSITION_MS);
  }, [dispatch, debounced]);

  const resizePlacement = useCallback((placementId: string, width: number, height: number) => {
    dispatch({ type: 'UPDATE_PLACEMENT', placementId, changes: { width, height } });
    debounced(`size-${placementId}`, 'spara storleken', () =>
      workspaceService.updatePlacement(placementId, { width, height }),
      DEBOUNCE_POSITION_MS);
  }, [dispatch, debounced]);

  /** Anropas när dragningen släpps, inte under den. Se useElementDrag. */
  const commitMove = useCallback((placementId: string, from: Point) => {
    pushUndo({
      label: 'flytten',
      undo: () => movePlacement(placementId, from.x, from.y),
    });
  }, [pushUndo, movePlacement]);

  const commitResize = useCallback((placementId: string, from: Box) => {
    pushUndo({
      label: 'storleksändringen',
      undo: () => {
        resizePlacement(placementId, from.width, from.height);
        movePlacement(placementId, from.x, from.y);
      },
    });
  }, [pushUndo, resizePlacement, movePlacement]);

  // ── Lås och förråd ──

  const setPlacementFlag = useCallback(async (
    placementId: string,
    field: 'is_locked' | 'is_on_canvas',
    value: boolean,
    label: string,
    undoLabel: string,
  ) => {
    dispatch({ type: 'UPDATE_PLACEMENT', placementId, changes: { [field]: value } });
    const ok = await track(label, () =>
      workspaceService.updatePlacement(placementId, { [field]: value }),
    );
    if (!ok) {
      dispatch({ type: 'UPDATE_PLACEMENT', placementId, changes: { [field]: !value } });
      return;
    }
    pushUndo({
      label: undoLabel,
      undo: () => setPlacementFlag(placementId, field, !value, label, undoLabel),
    });
  }, [dispatch, track, pushUndo]);

  const toggleLock = useCallback((placementId: string) => {
    const p = stateRef.current.placements.find((pl) => pl.id === placementId);
    if (!p) return;
    return setPlacementFlag(placementId, 'is_locked', !p.is_locked, 'ändra låset', 'låsningen');
  }, [setPlacementFlag]);

  const moveToStorage = useCallback((placementId: string) =>
    setPlacementFlag(placementId, 'is_on_canvas', false, 'flytta till förrådet', 'flytten till förrådet'),
  [setPlacementFlag]);

  const moveToCanvas = useCallback((placementId: string) =>
    setPlacementFlag(placementId, 'is_on_canvas', true, 'lägga på canvas', 'flytten till canvas'),
  [setPlacementFlag]);

  // ── Radering ──

  /** Tar bort elementet från den här ytan. Speglingar på andra ytor rörs inte. */
  const removePlacement = useCallback(async (placementId: string) => {
    const surfaceId = stateRef.current.activeSurfaceId;
    const p = stateRef.current.placements.find((pl) => pl.id === placementId);
    if (!p || !surfaceId) return;

    dispatch({ type: 'REMOVE_PLACEMENT', placementId });
    const ok = await track('ta bort elementet från ytan', () =>
      workspaceService.deletePlacement(placementId),
    );
    if (!ok) {
      dispatch({ type: 'ADD_PLACEMENT', placement: p });
      return;
    }

    const restore = async () => {
      const placement = await track('lägga tillbaka elementet', () =>
        workspaceService.placeElement(surfaceId, {
          element_id: p.element_id,
          position_x: p.position_x,
          position_y: p.position_y,
          width: p.width,
          height: p.height,
          is_locked: p.is_locked,
        }),
      );
      if (placement) dispatch({ type: 'ADD_PLACEMENT', placement });
    };

    pushUndo({ label: 'borttagningen från ytan', undo: restore });
    showNotice('Borttaget från ytan.', 'success', {
      durationMs: UNDO_NOTICE_MS,
      action: { label: 'Ångra', onClick: () => { void restore(); dismissNotice(); } },
    });
  }, [dispatch, track, pushUndo, showNotice, dismissNotice]);

  /** Mjuk radering — elementet försvinner från alla ytor tills det återställs. */
  const deleteElement = useCallback(async (elementId: string) => {
    const element = stateRef.current.elements[elementId];
    dispatch({ type: 'REMOVE_ELEMENT', elementId });

    const ok = await track('ta bort elementet', () =>
      workspaceService.deleteElement(elementId),
    );
    if (!ok) {
      // Den optimistiska borttagningen gäller inte längre — läs om ytan.
      const surfaceId = stateRef.current.activeSurfaceId;
      if (surfaceId) await loadSurfaceElements(surfaceId);
      return;
    }

    const restore = async () => {
      const restored = await track('återställa elementet', () =>
        workspaceService.restoreElement(elementId),
      );
      if (!restored) return;
      // Elementet kan ha legat på flera ytor. En omläsning är det enda som
      // säkert ger tillbaka rätt placeringar på den yta man står på.
      const surfaceId = stateRef.current.activeSurfaceId;
      if (surfaceId) await loadSurfaceElements(surfaceId);
    };

    pushUndo({ label: 'raderingen', undo: restore });

    const onSeveral = (element?.surface_count ?? 1) > 1;
    showNotice(
      onSeveral
        ? `"${element?.title ?? 'Elementet'}" togs bort från ${element!.surface_count} ytor.`
        : 'Elementet togs bort.',
      'success',
      {
        durationMs: UNDO_NOTICE_MS,
        action: { label: 'Ångra', onClick: () => { void restore(); dismissNotice(); } },
      },
    );
  }, [dispatch, track, pushUndo, loadSurfaceElements, showNotice, dismissNotice]);

  // ── Spegla och kopiera ──

  const placeCopy = useCallback(async (
    elementId: string,
    targetSurfaceId: string,
    mode: 'mirror' | 'copy',
  ) => {
    const label = mode === 'mirror' ? 'spegla elementet' : 'kopiera elementet';
    const result = await track(label, () =>
      mode === 'mirror'
        ? workspaceService.mirrorElement(elementId, targetSurfaceId)
        : workspaceService.copyElement(elementId, targetSurfaceId),
    );
    if (!result) return;

    if (stateRef.current.activeSurfaceId === targetSurfaceId) {
      dispatch({ type: 'ADD_PLACEMENT', placement: result });
      if (result.element) dispatch({ type: 'SET_ELEMENT', element: result.element });
    }

    // En spegling lägger källelementet på ännu en yta. Utan den här
    // uppräkningen skulle "Ta bort från den här ytan" ligga kvar som
    // avstängd fram till nästa omläsning, trots att den nu är meningsfull.
    if (mode === 'mirror') {
      const source = stateRef.current.elements[elementId];
      if (source) {
        dispatch({
          type: 'SET_ELEMENT',
          element: { ...source, surface_count: (source.surface_count ?? 1) + 1 },
        });
      }
    }

    const target = stateRef.current.surfaces.find((s) => s.id === targetSurfaceId);
    showNotice(
      `${mode === 'mirror' ? 'Speglat' : 'Kopierat'} till "${target?.name ?? 'ytan'}".`,
      'success',
    );
  }, [dispatch, track, showNotice]);

  const mirrorElement = useCallback((elementId: string, targetSurfaceId: string) =>
    placeCopy(elementId, targetSurfaceId, 'mirror'), [placeCopy]);

  const copyElement = useCallback((elementId: string, targetSurfaceId: string) =>
    placeCopy(elementId, targetSurfaceId, 'copy'), [placeCopy]);

  // ── Ångra ──

  const handleUndo = useCallback(async () => {
    const label = await undo();
    if (label) showNotice(`Ångrade ${label}.`, 'success');
  }, [undo, showNotice]);

  return {
    state,
    dispatch,
    plannerNotice,
    dismissNotice,
    saveStatus,
    canUndo,
    handleUndo,
    loadSurfaces,
    loadSurfaceElements,
    selectSurface,
    createSurface,
    renameSurface,
    archiveSurface,
    unarchiveSurface,
    deleteSurface,
    createAndPlaceElement,
    updateElementContent,
    updateElementTitle,
    movePlacement,
    resizePlacement,
    commitMove,
    commitResize,
    toggleLock,
    moveToStorage,
    moveToCanvas,
    removePlacement,
    deleteElement,
    mirrorElement,
    copyElement,
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
    case 'link':
      return { url: '' };
    default:
      return null;
  }
}

export type { SurfaceElement };
