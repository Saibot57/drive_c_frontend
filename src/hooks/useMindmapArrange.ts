'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import type { EdgePoint } from '@/utils/mindmapEdges';
import { arrange, type MindmapArrangePattern } from '@/utils/mindmapArrange';
import { rectBetween, type SelectionRect } from '@/utils/mindmapSelection';

/*
 * Arrangera de markerade (docs/plans/mindmap-arrangera.md, del D). Pekaren
 * över ett mönster i menyn visar resultatet (`preview`), och ett klick
 * sparar det som ett ångra-steg. "Inom ett område" stänger menyn och låter
 * en dra upp området på kartan; förhandsvisningen följer draget, och Esc
 * avbryter.
 */

interface Options {
  mapId: string;
  docRef: React.MutableRefObject<MindmapDoc>;
  commit: (next: MindmapDoc) => void;
  /** Kartan som den står, utan förhandsvisningen: mönstren räknas på den. */
  layout: MindmapLayoutResult;
  /** De markerade noderna, eller `null` om inga flera är markerade. */
  ids: () => string[] | null;
  /**
   * Pekarens punkt räknad från rotens automatiska mitt. Den ändras inte när
   * förhandsvisningen gör kartan större, som layoutens koordinater gör.
   */
  toWorld: (clientX: number, clientY: number) => EdgePoint;
  /** Rotens automatiska mitt i `layout`. */
  origin: EdgePoint;
  focusMap: () => void;
}

export function useMindmapArrange({ mapId, docRef, commit, layout, ids, toWorld, origin, focusMap }: Options) {
  const [preview, setPreview] = useState<MindmapDoc | null>(null);
  const [area, setArea] = useState<SelectionRect | null>(null);
  const [picking, setPicking] = useState(false);
  const layoutRef = useRef({ layout, origin });
  layoutRef.current = { layout, origin };
  const stopRef = useRef<(() => void) | null>(null);

  const result = useCallback((pattern: MindmapArrangePattern, rect: SelectionRect | null = null): MindmapDoc | null => {
    const marked = ids();
    if (!marked) return null;
    const { layout: laid, origin: o } = layoutRef.current;
    const inLayout = rect ? { ...rect, x: rect.x + o.x, y: rect.y + o.y } : null;
    const next = arrange(docRef.current, marked, pattern, laid, inLayout);
    return next === docRef.current ? null : next;
  }, [docRef, ids]);

  /** Pekaren över ett mönster i menyn; `null` när den lämnar menyn. */
  const hover = useCallback((pattern: MindmapArrangePattern | null) => {
    setPreview(pattern && pattern !== 'area' ? result(pattern) : null);
  }, [result]);

  const stop = useCallback(() => {
    stopRef.current?.();
  }, []);

  useEffect(() => {
    stop();
    setPreview(null);
  }, [mapId, stop]);
  useEffect(() => stop, [stop]);

  /** Området för "Inom ett område": nästa drag på kartan. */
  const pickArea = useCallback(() => {
    stopRef.current?.();
    let start: EdgePoint | null = null;
    let rect: SelectionRect | null = null;
    const swallow = (ev: Event) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    const handleDown = (ev: PointerEvent) => {
      if (ev.button === 1) return;
      swallow(ev);
      if (ev.button !== 0) return end(false);
      start = toWorld(ev.clientX, ev.clientY);
    };
    const handleMove = (ev: PointerEvent) => {
      if (!start) return;
      swallow(ev);
      rect = rectBetween(start, toWorld(ev.clientX, ev.clientY));
      setArea(rect);
      setPreview(result('area', rect));
    };
    const handleUp = (ev: PointerEvent) => {
      if (!start) return;
      swallow(ev);
      window.addEventListener('click', swallow, { capture: true, once: true });
      end(!!rect && rect.width > 4 && rect.height > 4);
    };
    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      swallow(ev);
      end(false);
    };
    const end = (save: boolean) => {
      const next = save && rect ? result('area', rect) : null;
      stopRef.current?.();
      if (next) commit(next);
      focusMap();
    };
    window.addEventListener('pointerdown', handleDown, true);
    window.addEventListener('pointermove', handleMove, true);
    window.addEventListener('pointerup', handleUp, true);
    window.addEventListener('contextmenu', swallow, true);
    window.addEventListener('keydown', handleKey, true);
    stopRef.current = () => {
      window.removeEventListener('pointerdown', handleDown, true);
      window.removeEventListener('pointermove', handleMove, true);
      window.removeEventListener('pointerup', handleUp, true);
      window.removeEventListener('contextmenu', swallow, true);
      window.removeEventListener('keydown', handleKey, true);
      stopRef.current = null;
      setPicking(false);
      setArea(null);
      setPreview(null);
    };
    setPicking(true);
  }, [commit, focusMap, result, toWorld]);

  /** Ett klick på ett mönster. */
  const choose = useCallback((pattern: MindmapArrangePattern) => {
    if (pattern === 'area') {
      setPreview(null);
      pickArea();
      return;
    }
    const next = result(pattern);
    setPreview(null);
    if (next) commit(next);
    focusMap();
  }, [commit, focusMap, pickArea, result]);

  /** `area` är räknat från rotens automatiska mitt, som `toWorld`. */
  return { preview, area, picking, hover, choose, cancel: stop };
}
