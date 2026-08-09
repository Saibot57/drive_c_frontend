'use client';

import { useCallback, useRef } from 'react';
import { usePlannerNotice } from '@/hooks/usePlannerNotice';
import { useWorkspace } from './WorkspaceContext';
import { useWorkspaceSync } from './useWorkspaceSync';
import { useWorkspaceHistory } from './useWorkspaceHistory';
import { themeWheelService } from '@/services/themeWheelService';
import { workspaceService } from '../services/workspaceService';
import { buildWheelParts, type WheelPartMode } from '../utils/wheelExplode';
import { DAY_RULER_WIDTH, buildScheduleDays } from '../utils/scheduleDayImport';
import type { PlannerActivity } from '@/types/schedule';
import { partCardSize, partViewBox, straightSize } from '../utils/wheelPartGeometry';
import type { WheelPartContent } from '../types/wheelPart.types';
import type { ScheduleDayContent } from '../types/scheduleDay.types';
import type { ElementType, SurfaceElement, ViewportState } from '../types/workspace.types';
import type { Point } from './useElementDrag';
import type { Box } from './useElementResize';
import {
  DEFAULT_ELEMENT_WIDTH,
  DEFAULT_ELEMENT_HEIGHT,
  DEBOUNCE_POSITION_MS,
  DEBOUNCE_CONTENT_MS,
  DEBOUNCE_VIEWPORT_MS,
  UNDO_NOTICE_MS,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  FIT_PADDING_PX,
  GRID_SIZE,
  MAX_EXPLODE_PARTS,
} from '../types/constants';
import { batchBounds, clamp, screenToCanvas, snapToGrid } from '../types/utils';

/** Storlekar som passar innehållet bättre än standardrutan. */
const SIZE_BY_TYPE: Partial<Record<ElementType, { w: number; h: number }>> = {
  sticky: { w: 200, h: 200 },
  kanban: { w: 480, h: 320 },
  pdf: { w: 480, h: 600 },
  image: { w: 320, h: 240 },
  link: { w: 280, h: 220 },
  // Hjulet är runt och behöver plats för sina etiketter. Se MIN_WHEEL_REF_SIZE.
  wheel_ref: { w: 380, h: 420 },
  // Bara reserv. En sprängning måttsätter varje del efter dess egna
  // proportioner ur hjulet; hit kommer man först om en del speglas eller
  // kopieras till en annan yta, där geometrin inte följer med.
  wheel_part: { w: 220, h: 220 },
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

  // ── Vy ──

  /** Återställer den vy ytan senast lämnades i. */
  const applyStoredViewport = useCallback((surfaceId: string) => {
    const surface = stateRef.current.surfaces.find((s) => s.id === surfaceId);
    if (!surface) return;
    dispatch({
      type: 'SET_VIEWPORT',
      viewport: {
        panX: surface.viewport_x ?? 0,
        panY: surface.viewport_y ?? 0,
        zoom: surface.viewport_zoom || DEFAULT_ZOOM,
      },
    });
  }, [dispatch]);

  /**
   * Panorering och zoom sparas fördröjt. En dragning ger hundratals ändringar,
   * och vyn är inte värd ett anrop per musrörelse.
   */
  const saveViewport = useCallback((viewport: ViewportState) => {
    const surfaceId = stateRef.current.activeSurfaceId;
    if (!surfaceId) return;
    debounced(`viewport-${surfaceId}`, 'spara vyn', () =>
      workspaceService.updateSurface(surfaceId, {
        viewport_x: viewport.panX,
        viewport_y: viewport.panY,
        viewport_zoom: viewport.zoom,
      }),
      DEBOUNCE_VIEWPORT_MS);
    dispatch({
      type: 'UPDATE_SURFACE',
      surfaceId,
      changes: {
        viewport_x: viewport.panX,
        viewport_y: viewport.panY,
        viewport_zoom: viewport.zoom,
      },
    });
  }, [debounced, dispatch]);

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
        applyStoredViewport(surfaces[0].id);
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
  }, [dispatch, loadSurfaceElements, track, applyStoredViewport]);

  const selectSurface = useCallback(async (surfaceId: string) => {
    if (surfaceId === stateRef.current.activeSurfaceId) return;
    dispatch({ type: 'SET_ACTIVE_SURFACE', surfaceId });
    applyStoredViewport(surfaceId);
    // Ångra-stacken pekar på element som inte längre syns.
    clearHistory();
    await loadSurfaceElements(surfaceId);
  }, [dispatch, loadSurfaceElements, clearHistory, applyStoredViewport]);

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

  // ── Biblioteket ──

  const loadLibrary = useCallback(async () => {
    const elements = await track('hämta biblioteket', () => workspaceService.listElements());
    if (elements) dispatch({ type: 'SET_LIBRARY', elements });
  }, [dispatch, track]);

  /**
   * Placerar ett element som redan finns i biblioteket på den aktiva ytan.
   * Ligger det redan på en annan yta blir det en spegling — samma element,
   * ny placering — vilket är hela poängen med att elementet och placeringen
   * är skilda saker.
   */
  const placeFromLibrary = useCallback(async (
    elementId: string,
    canvasX: number,
    canvasY: number,
  ) => {
    const surfaceId = stateRef.current.activeSurfaceId;
    if (!surfaceId) {
      showNotice('Skapa en yta först.', 'warning');
      return;
    }

    const element =
      stateRef.current.library.find((e) => e.id === elementId) ??
      stateRef.current.elements[elementId];
    if (!element) return;

    const size = SIZE_BY_TYPE[element.type] ?? { w: DEFAULT_ELEMENT_WIDTH, h: DEFAULT_ELEMENT_HEIGHT };
    const placement = await track('placera elementet', () =>
      workspaceService.placeElement(surfaceId, {
        element_id: elementId,
        position_x: snapToGrid(canvasX - size.w / 2, GRID_SIZE),
        position_y: snapToGrid(canvasY - size.h / 2, GRID_SIZE),
        width: size.w,
        height: size.h,
        is_locked: false,
      }),
    );
    if (!placement) return;

    dispatch({ type: 'ADD_PLACEMENT', placement });
    dispatch({ type: 'SET_ELEMENT', element: placement.element ?? element });
    dispatch({ type: 'SELECT_ELEMENT', elementId });
    void loadLibrary();

    pushUndo({
      label: 'placeringen',
      undo: async () => {
        dispatch({ type: 'REMOVE_PLACEMENT', placementId: placement.id });
        await track('ta bort placeringen', () =>
          workspaceService.deletePlacement(placement.id),
        );
        void loadLibrary();
      },
    });
  }, [dispatch, track, pushUndo, showNotice, loadLibrary]);

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
    void loadLibrary();
    pushUndo({
      label: 'det nya elementet',
      undo: async () => {
        dispatch({ type: 'REMOVE_ELEMENT', elementId: element.id });
        await track('ta bort elementet', () => workspaceService.deleteElement(element.id));
        void loadLibrary();
      },
    });
  }, [dispatch, track, pushUndo, showNotice, loadLibrary]);

  /**
   * Lägger en hel sats hämtade element på den aktiva ytan.
   *
   * Allt går i ett anrop till bulk-place och registreras som ett enda
   * ångrasteg. En sprängning på fjorton delar hade annars blivit 28 rundturer
   * och ätit en fjärdedel av historiken.
   *
   * Satsen centreras i vyn efter den yta den faktiskt fyller, eftersom de olika
   * hämtningarna har olika nollpunkt.
   */
  const placeBatch = useCallback(async (
    items: {
      type: ElementType;
      title: string;
      content: unknown;
      size: { width: number; height: number };
      offset: { x: number; y: number };
    }[],
    labels: { track: string; undo: string; done: (count: number) => string },
    viewport: ViewportState,
    containerWidth: number,
    containerHeight: number,
  ) => {
    const surfaceId = stateRef.current.activeSurfaceId;
    if (!surfaceId) {
      showNotice('Skapa en yta först.', 'warning');
      return null;
    }

    const view = screenToCanvas(
      containerWidth / 2,
      containerHeight / 2,
      viewport.panX,
      viewport.panY,
      viewport.zoom,
    );
    const bounds = batchBounds(items);
    const originX = view.x - bounds.x - bounds.width / 2;
    const originY = view.y - bounds.y - bounds.height / 2;

    const placements = await track(labels.track, () =>
      workspaceService.bulkPlace(surfaceId, items.map((item) => ({
        type: item.type,
        title: item.title,
        content: item.content,
        position_x: snapToGrid(originX + item.offset.x, GRID_SIZE),
        position_y: snapToGrid(originY + item.offset.y, GRID_SIZE),
        width: item.size.width,
        height: item.size.height,
      }))),
    );
    if (!placements) return null;

    dispatch({ type: 'SET_ELEMENTS', elements: placements.map((p) => p.element) });
    dispatch({ type: 'ADD_PLACEMENTS', placements });
    void loadLibrary();
    showNotice(labels.done(placements.length), 'success');

    pushUndo({
      label: labels.undo,
      undo: async () => {
        const elementIds = placements.map((p) => p.element_id);
        elementIds.forEach((elementId) => dispatch({ type: 'REMOVE_ELEMENT', elementId }));
        // Raderingen är mjuk och sker en per element — det finns ingen
        // bulkradering. allSettled i stället för all: ett element som inte går
        // bort ska inte hindra de övriga, och det dyker i så fall upp igen vid
        // nästa omladdning.
        await track('ta bort dem', () =>
          Promise.allSettled(elementIds.map((id) => workspaceService.deleteElement(id))),
        );
        void loadLibrary();
      },
    });

    return placements;
  }, [dispatch, track, pushUndo, showNotice, loadLibrary]);

  /**
   * Bryter ut ett hjuls arbetsområden som enskilda kort på den aktiva ytan.
   *
   * Delarna är sticklingar, inte pekare: de tar med sig allt de behöver för att
   * rita sig själva. Hjulets ringtilldelning är global — ett nytt block någon
   * annanstans ändrar höjden på alla band — så en levande koppling hade flyttat
   * och skalat om delar mitt i ett arrangemang användaren byggt runt dem.
   */
  const importWheel = useCallback(async (
    wheelId: string,
    mode: WheelPartMode,
    viewport: ViewportState,
    containerWidth: number,
    containerHeight: number,
  ) => {
    const wheel = await track('hämta hjulet', () => themeWheelService.getWheel(wheelId));
    if (!wheel) return;

    const drafts = buildWheelParts(wheel, mode);
    if (drafts.length === 0) {
      showNotice(`${wheel.name} har inga arbetsområden att bryta ut.`, 'warning');
      return;
    }
    if (drafts.length > MAX_EXPLODE_PARTS) {
      showNotice(
        `${wheel.name} har ${drafts.length} arbetsområden — högst ${MAX_EXPLODE_PARTS} kan brytas ut på en gång.`,
        'warning',
      );
      return;
    }

    await placeBatch(
      drafts.map((draft) => ({
        type: 'wheel_part' as ElementType,
        title: draft.content.title,
        content: draft.content,
        size: draft.size,
        offset: draft.offset,
      })),
      {
        track: mode === 'unroll' ? 'rulla ut hjulet' : 'spränga hjulet',
        undo: mode === 'unroll' ? `utrullningen av ${wheel.name}` : `sprängningen av ${wheel.name}`,
        done: (count) => `${count} ${count === 1 ? 'del' : 'delar'} ur ${wheel.name} ligger på ytan.`,
      },
      viewport,
      containerWidth,
      containerHeight,
    );
  }, [track, showNotice, placeBatch]);

  /**
   * Hämtar in valda dagar ur ett schema som skrivskyddade kort.
   *
   * Dagen är enheten — en hel vecka är fem kort bredvid varandra, vilket är vad
   * som gör att man kan dra ut onsdagen och skriva bredvid den.
   *
   * Kopian är fryst, och det löser id-problemet i stället för att kringgå det:
   * ett arkiv är strängen `archive_name` på raderna i planner_activity, så en
   * levande referens hade dött tyst vid ett namnbyte. Här är namnet en etikett.
   */
  const importScheduleDays = useCallback(async (
    activities: PlannerActivity[],
    days: string[],
    source: { archiveName: string | null; label: string },
    viewport: ViewportState,
    containerWidth: number,
    containerHeight: number,
  ) => {
    const drafts = buildScheduleDays(activities, days, {
      archiveName: source.archiveName,
      sourceLabel: source.label,
    });
    if (drafts.length === 0) return;

    await placeBatch(
      drafts.map((draft) => ({
        type: 'schedule_day' as ElementType,
        title: `${draft.content.day} · ${source.label}`,
        content: draft.content,
        size: draft.size,
        offset: draft.offset,
      })),
      {
        track: 'hämta in schemadagarna',
        undo: `hämtningen ur ${source.label}`,
        done: (count) => `${count} ${count === 1 ? 'dag' : 'dagar'} ur ${source.label} ligger på ytan.`,
      },
      viewport,
      containerWidth,
      containerHeight,
    );
  }, [placeBatch]);

  /**
   * Rätar ut en utbruten del, eller böjer tillbaka den.
   *
   * Kortet måste måttsättas om samtidigt. En krökt tårtbits rätblock har inget
   * med en rak stapels proportioner att göra, så utan det hade uträtningen
   * lämnat en stapel utsträckt över en yta gjord för en båge. Innehåll och
   * geometri ändras därför tillsammans och ångras tillsammans.
   */
  const toggleStraight = useCallback(async (elementId: string, placementId: string) => {
    const element = stateRef.current.elements[elementId];
    const placement = stateRef.current.placements.find((p) => p.id === placementId);
    if (!element || element.type !== 'wheel_part' || !placement) return;

    const before = element.content as WheelPartContent;
    if (!before) return;
    const after: WheelPartContent = { ...before, straight: !before.straight };

    // Måttet som ångras är det kortet faktiskt hade, inte det naturliga —
    // användaren kan ha dragit i det efteråt.
    const beforeSize = { width: placement.width, height: placement.height };

    const apply = async (
      content: WheelPartContent,
      size: { width: number; height: number },
      label: string,
    ) => {
      dispatch({ type: 'SET_ELEMENT', element: { ...element, content } });
      dispatch({ type: 'UPDATE_PLACEMENT', placementId, changes: size });
      await track(label, async () => {
        await workspaceService.updateElement(elementId, { content });
        await workspaceService.updatePlacement(placementId, size);
      });
    };

    await apply(
      after,
      naturalPartSize(after),
      after.straight ? 'räta ut delen' : 'böja tillbaka delen',
    );

    pushUndo({
      label: after.straight ? 'uträtningen' : 'tillbakaböjningen',
      undo: () => apply(before, beforeSize, 'ångra'),
    });
  }, [dispatch, track, pushUndo]);

  /**
   * Visar eller döljer timlinjalen på ett schemadagskort.
   *
   * Bredden följer med, annars kläms lektionerna ihop när linjalen tänds på ett
   * kort som inte hade plats för den.
   */
  const toggleDayRuler = useCallback(async (elementId: string, placementId: string) => {
    const element = stateRef.current.elements[elementId];
    const placement = stateRef.current.placements.find((p) => p.id === placementId);
    if (!element || element.type !== 'schedule_day' || !placement) return;

    const before = element.content as ScheduleDayContent;
    if (!before) return;
    const after: ScheduleDayContent = { ...before, showRuler: !before.showRuler };
    const beforeSize = { width: placement.width, height: placement.height };
    const afterSize = {
      width: Math.max(placement.width + (after.showRuler ? DAY_RULER_WIDTH : -DAY_RULER_WIDTH), 80),
      height: placement.height,
    };

    const apply = async (
      content: ScheduleDayContent,
      size: { width: number; height: number },
      label: string,
    ) => {
      dispatch({ type: 'SET_ELEMENT', element: { ...element, content } });
      dispatch({ type: 'UPDATE_PLACEMENT', placementId, changes: size });
      await track(label, async () => {
        await workspaceService.updateElement(elementId, { content });
        await workspaceService.updatePlacement(placementId, size);
      });
    };

    await apply(after, afterSize, after.showRuler ? 'visa linjalen' : 'dölja linjalen');
    pushUndo({
      label: after.showRuler ? 'den visade linjalen' : 'den dolda linjalen',
      undo: () => apply(before, beforeSize, 'ångra'),
    });
  }, [dispatch, track, pushUndo]);

  /**
   * Skriver om innehållet i ett eller flera element från deras källa.
   *
   * Innehållet byts, geometrin är din: position, storlek och z-index rörs inte,
   * och arrangemangsfälten (krökt/rakt, timlinjal, tidsfönster) har redan
   * bevarats av sammanslagningen. En uppdatering ska aldrig flytta något du
   * placerat — det var hela skälet att välja stickling framför levande.
   */
  const refreshFromSource = useCallback(async (
    items: { elementId: string; content: unknown }[],
    sourceLabel: string,
  ) => {
    const before = items
      .map(({ elementId }) => stateRef.current.elements[elementId])
      .filter((element): element is NonNullable<typeof element> => Boolean(element))
      .map((element) => ({ element, content: element.content }));
    if (before.length === 0) return;

    const write = async (
      next: { elementId: string; content: unknown }[],
      label: string,
    ) => {
      next.forEach(({ elementId, content }) => {
        const element = stateRef.current.elements[elementId];
        if (element) dispatch({ type: 'SET_ELEMENT', element: { ...element, content } });
      });
      await track(label, () =>
        Promise.all(next.map(({ elementId, content }) =>
          workspaceService.updateElement(elementId, { content }))),
      );
    };

    await write(items, 'uppdatera från källan');
    showNotice(
      items.length === 1
        ? `Uppdaterad från ${sourceLabel}.`
        : `${items.length} kort uppdaterade från ${sourceLabel}.`,
      'success',
    );

    pushUndo({
      label: items.length === 1 ? 'uppdateringen' : `uppdateringen av ${items.length} kort`,
      undo: () => write(
        before.map(({ element, content }) => ({ elementId: element.id, content })),
        'återställa innehållet',
      ),
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

  /**
   * Lyfter ett element överst. Backend har alltid tagit emot z_index på
   * placeringen — klienten skickade det bara aldrig, så staplingsordningen
   * satt fast i den ordning elementen råkade skapas.
   */
  const bringToFront = useCallback((placementId: string) => {
    const placements = stateRef.current.placements;
    const target = placements.find((p) => p.id === placementId);
    if (!target) return;

    const top = Math.max(...placements.map((p) => p.z_index), 0);
    if (target.z_index === top && placements.length > 1) return;

    const previous = target.z_index;
    const next = top + 1;
    dispatch({ type: 'UPDATE_PLACEMENT', placementId, changes: { z_index: next } });
    debounced(`z-${placementId}`, 'ändra staplingsordningen', () =>
      workspaceService.updatePlacement(placementId, { z_index: next }),
      DEBOUNCE_POSITION_MS);

    pushUndo({
      label: 'staplingsordningen',
      undo: () => {
        dispatch({ type: 'UPDATE_PLACEMENT', placementId, changes: { z_index: previous } });
        debounced(`z-${placementId}`, 'ändra staplingsordningen', () =>
          workspaceService.updatePlacement(placementId, { z_index: previous }),
          DEBOUNCE_POSITION_MS);
      },
    });
  }, [dispatch, debounced, pushUndo]);

  /**
   * Ramar in allt som ligger på ytan. Utan den här går ett element som hamnat
   * långt ut inte att hitta tillbaka till — det finns ingen kant att stöta i.
   */
  const zoomToContent = useCallback((containerWidth: number, containerHeight: number) => {
    const onCanvas = stateRef.current.placements.filter((p) => p.is_on_canvas);
    if (onCanvas.length === 0) {
      dispatch({ type: 'SET_VIEWPORT', viewport: { panX: 0, panY: 0, zoom: DEFAULT_ZOOM } });
      showNotice('Ytan är tom.', 'warning');
      return;
    }

    const minX = Math.min(...onCanvas.map((p) => p.position_x));
    const minY = Math.min(...onCanvas.map((p) => p.position_y));
    const maxX = Math.max(...onCanvas.map((p) => p.position_x + p.width));
    const maxY = Math.max(...onCanvas.map((p) => p.position_y + p.height));

    const pad = FIT_PADDING_PX * 2;
    const zoom = clamp(
      Math.min(
        (containerWidth - pad) / Math.max(maxX - minX, 1),
        (containerHeight - pad) / Math.max(maxY - minY, 1),
      ),
      MIN_ZOOM,
      MAX_ZOOM,
    );

    const viewport = {
      zoom,
      panX: (containerWidth - (maxX - minX) * zoom) / 2 - minX * zoom,
      panY: (containerHeight - (maxY - minY) * zoom) / 2 - minY * zoom,
    };
    dispatch({ type: 'SET_VIEWPORT', viewport });
    saveViewport(viewport);
  }, [dispatch, showNotice, saveViewport]);

  /** Centrerar vyn på ett element, t.ex. efter en sökträff. */
  const centerOnElement = useCallback((
    elementId: string,
    containerWidth: number,
    containerHeight: number,
  ) => {
    const placement = stateRef.current.placements.find(
      (p) => p.element_id === elementId && p.is_on_canvas,
    );
    if (!placement) return;

    const zoom = stateRef.current.viewport.zoom;
    const viewport = {
      zoom,
      panX: containerWidth / 2 - (placement.position_x + placement.width / 2) * zoom,
      panY: containerHeight / 2 - (placement.position_y + placement.height / 2) * zoom,
    };
    dispatch({ type: 'SET_VIEWPORT', viewport });
    saveViewport(viewport);
  }, [dispatch, saveViewport]);

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
      void loadLibrary();
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
  }, [dispatch, track, pushUndo, loadSurfaceElements, loadLibrary, showNotice, dismissNotice]);

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

    void loadLibrary();

    const target = stateRef.current.surfaces.find((s) => s.id === targetSurfaceId);
    showNotice(
      `${mode === 'mirror' ? 'Speglat' : 'Kopierat'} till "${target?.name ?? 'ytan'}".`,
      'success',
    );
  }, [dispatch, track, showNotice, loadLibrary]);

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
    showNotice,
    dismissNotice,
    saveStatus,
    canUndo,
    handleUndo,
    loadSurfaces,
    loadSurfaceElements,
    loadLibrary,
    placeFromLibrary,
    saveViewport,
    zoomToContent,
    centerOnElement,
    bringToFront,
    selectSurface,
    createSurface,
    renameSurface,
    archiveSurface,
    unarchiveSurface,
    deleteSurface,
    createAndPlaceElement,
    importWheel,
    importScheduleDays,
    toggleStraight,
    toggleDayRuler,
    refreshFromSource,
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

/** Måttet en del vill ha i sitt nuvarande läge. */
function naturalPartSize(content: WheelPartContent): { width: number; height: number } {
  return content.straight ? straightSize(content) : partCardSize(partViewBox(content).box);
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
    case 'wheel_ref':
      // Utan id visar kortet en väljare med användarens hjul.
      return { wheelId: null };
    default:
      return null;
  }
}

export type { SurfaceElement };
