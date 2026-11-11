'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  applyWheel,
  centerOn,
  clampView,
  DEFAULT_VIEW,
  fitToBounds,
  MINDMAP_VIEW_KEY,
  nextZoomStep,
  panBy,
  rememberView,
  revealRect,
  sameView,
  sanitizeMindmapViews,
  zoomTo,
  type MindmapRect,
  type MindmapSize,
  type MindmapView,
  type StoredMindmapViews,
} from '@/utils/mindmapViewport';

/*
 * Vyn på Mindmap-sidan: zoom och panorering. Räknandet ligger i
 * utils/mindmapViewport.ts; här finns läget och det som rör webbläsaren.
 *
 * Vyn är inte React-state i kartan. Lagrets `transform` sätts direkt på
 * elementet, och det som visar vyn (zoomnivån, minikartan) prenumererar
 * själva. En karta på 300 noder ritas alltså inte om när man panorerar.
 *
 * Vyn per karta sparas i localStorage (`mindmap.view.v1`), inte i backend.
 */

const SAVE_DELAY_MS = 400;
/** Så länge har lagret en mjuk övergång efter ett hopp (centrera, passa in, följa markeringen). */
const SMOOTH_MS = 220;

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const readViews = (): StoredMindmapViews => {
  try {
    const raw = window.localStorage.getItem(MINDMAP_VIEW_KEY);
    return raw === null ? {} : sanitizeMindmapViews(JSON.parse(raw));
  } catch {
    return {};
  }
};

const writeViews = (views: StoredMindmapViews) => {
  try {
    window.localStorage.setItem(MINDMAP_VIEW_KEY, JSON.stringify(views));
  } catch {
    /* lagringen kan vara blockerad eller full */
  }
};

export interface MindmapViewportContext {
  size: MindmapSize;
  bounds: MindmapRect;
}

export interface MindmapViewport {
  /** Ytan som kartan syns i. Sätts på elementet med `ref`. */
  viewportRef: React.RefObject<HTMLDivElement>;
  /** Lagret som flyttas och skalas. */
  layerRef: React.RefObject<HTMLDivElement>;
  getView: () => MindmapView;
  getSize: () => MindmapSize;
  getBounds: () => MindmapRect;
  subscribe: (listener: () => void) => () => void;
  /** Byter vy. `smooth` ger en kort övergång; hjul och drag ska inte ha den. */
  change: (update: (view: MindmapView, ctx: MindmapViewportContext) => MindmapView, smooth?: boolean) => void;
  /** Passar in hela kartan (Ctrl+0). */
  fit: () => void;
  /** Lägger en rektangel i kartans koordinater i ytans mitt (Ctrl+.). */
  center: (rect: MindmapRect) => void;
  /** Flyttar vyn så lite som möjligt för att rektangeln ska synas. */
  reveal: (rect: MindmapRect) => void;
  /** Ett steg in (1) eller ut (-1) kring ytans mitt; `0` går till 100 %. */
  zoomStep: (direction: 1 | -1 | 0) => void;
}

interface Options {
  /** Kartans id. Varje karta har sin egen vy. */
  mapId: string;
  /** Kartans utbredning, med rotnodens mitt i origo. */
  bounds: MindmapRect;
  /** Falskt tills texten är mätt; den första vyn räknas på rätt mått. */
  ready: boolean;
}

export function useMindmapViewport({ mapId, bounds, ready }: Options): MindmapViewport {
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  const viewRef = useRef<MindmapView>(DEFAULT_VIEW);
  const sizeRef = useRef<MindmapSize>({ width: 0, height: 0 });
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const listeners = useRef(new Set<() => void>());
  const smoothTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Kartan vars vy är inläst, och om den ändrats sedan dess. */
  const initedFor = useRef<string | null>(null);
  const dirty = useRef(false);
  const mapIdRef = useRef(mapId);
  mapIdRef.current = mapId;

  const paint = useCallback((smooth: boolean) => {
    const layer = layerRef.current;
    if (layer) {
      if (smoothTimer.current) clearTimeout(smoothTimer.current);
      smoothTimer.current = null;
      if (smooth) {
        layer.dataset.smooth = 'true';
        smoothTimer.current = setTimeout(() => {
          delete layer.dataset.smooth;
          smoothTimer.current = null;
        }, SMOOTH_MS);
      } else {
        delete layer.dataset.smooth;
      }
      const { x, y, zoom } = viewRef.current;
      // Hela pixlar: annars blir texten suddig vid 100 %.
      layer.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) scale(${zoom})`;
    }
    listeners.current.forEach((listener) => listener());
  }, []);

  const flushSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const id = initedFor.current;
    if (!id || !dirty.current) return;
    dirty.current = false;
    // Läses om först: en annan flik kan ha sparat en annan kartas vy.
    writeViews(rememberView(readViews(), id, viewRef.current, Date.now()));
  }, []);

  const set = useCallback((next: MindmapView, smooth: boolean, remember: boolean) => {
    const clamped = clampView(next, boundsRef.current, sizeRef.current);
    if (sameView(clamped, viewRef.current)) return;
    viewRef.current = clamped;
    paint(smooth);
    if (!remember) return;
    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, SAVE_DELAY_MS);
  }, [flushSave, paint]);

  const change = useCallback<MindmapViewport['change']>((update, smooth = false) => {
    if (initedFor.current === null) return;
    set(update(viewRef.current, { size: sizeRef.current, bounds: boundsRef.current }), smooth, true);
  }, [set]);

  /** Läser in kartans sparade vy, eller passar in kartan första gången. */
  const init = useCallback(() => {
    const el = viewportRef.current;
    const id = mapIdRef.current;
    if (!el || initedFor.current === id) return;
    // Den förra kartans vy sparas under sitt id innan den nya tar över.
    flushSave();
    initedFor.current = null;
    const size = { width: el.clientWidth, height: el.clientHeight };
    if (size.width <= 0 || size.height <= 0) return;
    sizeRef.current = size;
    const stored = readViews()[id];
    const start: MindmapView = stored
      ? { x: stored.x, y: stored.y, zoom: stored.zoom }
      : fitToBounds(DEFAULT_VIEW, boundsRef.current, size);
    viewRef.current = clampView(start, boundsRef.current, size);
    initedFor.current = id;
    dirty.current = false;
    paint(false);
  }, [flushSave, paint]);

  // En annan karta: den förras vy sparas, den nyas läses in.
  useIsomorphicLayoutEffect(() => {
    if (ready) init();
  }, [mapId, ready, init]);
  useEffect(() => flushSave, [flushSave]);

  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const handleWheel = (e: WheelEvent) => {
      // Utan preventDefault zoomar Ctrl+hjul hela sidan och hjulet rullar den.
      e.preventDefault();
      const box = el.getBoundingClientRect();
      const point = { x: e.clientX - box.left, y: e.clientY - box.top };
      change((view, ctx) => applyWheel(view, e, point, ctx.size));
    };
    // Ytan rullar inte, men ett fält som får fokus kan ändå flytta innehållet.
    const handleScroll = () => {
      if (el.scrollLeft !== 0) el.scrollLeft = 0;
      if (el.scrollTop !== 0) el.scrollTop = 0;
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('scroll', handleScroll);

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      const size = { width: el.clientWidth, height: el.clientHeight };
      if (initedFor.current === null) {
        if (readyRef.current) init();
        return;
      }
      if (size.width === sizeRef.current.width && size.height === sizeRef.current.height) return;
      // Ytans mitt ska visa samma ställe som förut, t.ex. när listan fälls ihop.
      const moved = panBy(
        viewRef.current,
        (size.width - sizeRef.current.width) / 2,
        (size.height - sizeRef.current.height) / 2,
      );
      sizeRef.current = size;
      viewRef.current = clampView(moved, boundsRef.current, size);
      dirty.current = true;
      paint(false);
    });
    observer?.observe(el);

    window.addEventListener('pagehide', flushSave);
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('scroll', handleScroll);
      observer?.disconnect();
      window.removeEventListener('pagehide', flushSave);
    };
  }, [change, flushSave, init, paint]);

  useEffect(() => () => {
    if (smoothTimer.current) clearTimeout(smoothTimer.current);
  }, []);

  return useMemo<MindmapViewport>(() => ({
    viewportRef,
    layerRef,
    getView: () => viewRef.current,
    getSize: () => sizeRef.current,
    getBounds: () => boundsRef.current,
    subscribe: (listener) => {
      listeners.current.add(listener);
      return () => {
        listeners.current.delete(listener);
      };
    },
    change,
    fit: () => change((view, ctx) => fitToBounds(view, ctx.bounds, ctx.size), true),
    center: (rect) => change((view, ctx) => centerOn(view, rect, ctx.size), true),
    reveal: (rect) => change((view, ctx) => revealRect(view, rect, ctx.size), true),
    zoomStep: (direction) => change((view, ctx) => zoomTo(
      view,
      { x: ctx.size.width / 2, y: ctx.size.height / 2 },
      direction === 0 ? 1 : nextZoomStep(view.zoom, direction),
    ), true),
  }), [change]);
}

/** Zoomnivån, för det som visar den. Ritar bara om när zoomen ändras. */
export function useMindmapZoom(viewport: MindmapViewport): number {
  return useSyncExternalStore(
    viewport.subscribe,
    () => viewport.getView().zoom,
    () => DEFAULT_VIEW.zoom,
  );
}
