'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { findNode } from '@/utils/mindmap/mindmapTree';
import type { EdgePoint } from '@/utils/mindmapEdges';
import { angleTo, resolveDirectionKey, setChildDir } from '@/utils/mindmapDirections';
import { isEditableElement } from '@/utils/dom';

/*
 * Läget där man pekar ut riktningen för nya barn (docs/plans/mindmap-arrangera.md,
 * del B). Alt+R eller knappen startar det för den markerade noden (eller
 * alla markerade); en pil från noden följer pekaren, ett klick sätter
 * riktningen och Esc eller högerklick avbryter. Med Shift (Alt+Shift+R)
 * gäller riktningen bara nästa barn: den sparas inte i kartan utan hålls
 * här tills barnet skapats, eller tills en annan nod markeras.
 *
 * Mittknappen och hjulet panorerar och zoomar som vanligt under tiden.
 */

export interface MindmapDirectionArrow {
  id: string;
  angle: number;
  /** `pick`: medan man väljer. `set`: nodens sparade riktning. `once`: bara nästa barn. */
  kind: 'pick' | 'set' | 'once';
}

interface Options {
  mapId: string;
  layout: MindmapLayoutResult;
  docRef: React.MutableRefObject<MindmapDoc>;
  commit: (next: MindmapDoc) => void;
  /** Den markerade noden, vars riktning visas och som vinkeln räknas från. */
  selectedId: string | null;
  /** Noderna som läget gäller: de markerade, annars den markerade. */
  targets: () => string[];
  toLayoutPoint: (clientX: number, clientY: number) => EdgePoint;
  focusMap: () => void;
}

export function useMindmapDirectionPick({ mapId, layout, docRef, commit, selectedId, targets, toLayoutPoint, focusMap }: Options) {
  const [pick, setPick] = useState<{ ids: string[]; once: boolean; angle: number | null } | null>(null);
  const [once, setOnce] = useState<{ parentId: string; angle: number } | null>(null);
  const onceRef = useRef(once);
  onceRef.current = once;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const stopRef = useRef<(() => void) | null>(null);

  // En annan karta, eller en annan markerad nod: engångsvalet gällde den förra.
  useEffect(() => {
    stopRef.current?.();
    setOnce(null);
  }, [mapId]);
  useEffect(() => {
    if (once && once.parentId !== selectedId) setOnce(null);
  }, [once, selectedId]);
  useEffect(() => () => stopRef.current?.(), []);

  const start = useCallback((onlyNext: boolean) => {
    stopRef.current?.();
    const ids = targets().filter((id) => layoutRef.current.byId.has(id));
    const from = ids.includes(selectedId ?? '') ? selectedId! : ids[0];
    if (!from) return;
    let angle: number | null = null;

    const center = () => {
      const box = layoutRef.current.byId.get(from);
      return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
    };
    const handleMove = (ev: PointerEvent) => {
      const c = center();
      if (!c) return;
      angle = angleTo(c, toLayoutPoint(ev.clientX, ev.clientY));
      setPick({ ids, once: onlyNext, angle });
    };
    const swallow = (ev: Event) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    const handleDown = (ev: PointerEvent) => {
      if (ev.button === 1) return;
      swallow(ev);
      if (ev.button === 0) {
        handleMove(ev);
        if (angle !== null) {
          if (onlyNext) setOnce({ parentId: from, angle });
          else {
            const chosen = angle;
            const next = ids.reduce((d, id) => setChildDir(d, id, chosen), docRef.current);
            if (next !== docRef.current) commit(next);
          }
        }
      }
      stop();
      // Klicket som följer ska inte nå kartan.
      window.addEventListener('click', swallow, { capture: true, once: true });
      focusMap();
    };
    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      swallow(ev);
      stop();
      focusMap();
    };
    const stop = () => {
      window.removeEventListener('pointermove', handleMove, true);
      window.removeEventListener('pointerdown', handleDown, true);
      window.removeEventListener('contextmenu', swallow, true);
      window.removeEventListener('keydown', handleKey, true);
      stopRef.current = null;
      setPick(null);
    };
    window.addEventListener('pointermove', handleMove, true);
    window.addEventListener('pointerdown', handleDown, true);
    window.addEventListener('contextmenu', swallow, true);
    window.addEventListener('keydown', handleKey, true);
    stopRef.current = stop;
    setPick({ ids, once: onlyNext, angle: null });
  }, [commit, docRef, focusMap, selectedId, targets, toLayoutPoint]);

  /** Tar bort riktningen för nya barn på noderna. */
  const clear = useCallback(() => {
    const next = targets().reduce((d, id) => setChildDir(d, id, null), docRef.current);
    if (next !== docRef.current) commit(next);
    setOnce(null);
    focusMap();
  }, [commit, docRef, focusMap, targets]);

  /** Engångsvalet för ett nytt barn till `parentId`, som förbrukas. */
  const takeOnce = useCallback((parentId: string): number | null => {
    const current = onceRef.current;
    if (!current || current.parentId !== parentId) return null;
    onceRef.current = null;
    setOnce(null);
    return current.angle;
  }, []);

  /** Alt+R och Alt+Shift+R i kartan, inte medan man skriver. Sant om tangenten är tagen om hand. */
  const handleKey = useCallback((e: React.KeyboardEvent, editing: boolean): boolean => {
    const key = resolveDirectionKey(e);
    if (!key || editing || isEditableElement(e.target)) return false;
    e.preventDefault();
    e.stopPropagation();
    start(key === 'once');
    return true;
  }, [start]);

  // Pilarna: medan man väljer, annars den markerade nodens riktning och engångsvalet.
  const arrows: MindmapDirectionArrow[] = [];
  if (pick) {
    if (pick.angle !== null) pick.ids.forEach((id) => arrows.push({ id, angle: pick.angle!, kind: 'pick' }));
  } else if (selectedId) {
    const childDir = findNode(docRef.current.root, selectedId)?.childDir;
    if (once?.parentId === selectedId) arrows.push({ id: selectedId, angle: once.angle, kind: 'once' });
    else if (childDir) arrows.push({ id: selectedId, angle: childDir.angle, kind: 'set' });
  }

  return { picking: pick !== null, pickingOnce: pick?.once ?? false, arrows, start, clear, takeOnce, handleKey };
}
