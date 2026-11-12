'use client';

import { useCallback, useRef, useState } from 'react';
import type { EdgePoint } from '@/utils/mindmapEdges';

/*
 * Att dra en brytpunkt på en linje eller en tvärlänk
 * (docs/plans/mindmap-placering.md, del D). Medan punkten dras ritas linjen
 * genom `preview`; dokumentet ändras först vid släppet, som ett ångra-steg.
 * Punkterna här är i layoutens koordinater; anroparen räknar om dem till
 * det som sparas.
 */

export interface WaypointPreview {
  /** Vad punkterna hör till: `edge:<nod-id>` eller `link:<länk-id>`. */
  key: string;
  points: EdgePoint[];
}

interface Options {
  toLayoutPoint: (clientX: number, clientY: number) => EdgePoint;
  /** Rutnätet, om det är på. `free` är sant med Ctrl eller Cmd. */
  snap: (point: EdgePoint, free: boolean) => EdgePoint;
  focusMap: () => void;
}

export function useMindmapWaypoints({ toLayoutPoint, snap, focusMap }: Options) {
  const [preview, setPreview] = useState<WaypointPreview | null>(null);
  const latest = useRef({ toLayoutPoint, snap, focusMap });
  latest.current = { toLayoutPoint, snap, focusMap };

  const begin = useCallback((
    e: React.PointerEvent,
    key: string,
    points: EdgePoint[],
    index: number,
    onCommit: (points: EdgePoint[]) => void,
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const pointerId = e.pointerId;
    let moved: EdgePoint[] | null = null;

    const handleMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const { toLayoutPoint: toPoint, snap: snapTo } = latest.current;
      const at = snapTo(toPoint(ev.clientX, ev.clientY), ev.ctrlKey || ev.metaKey);
      moved = points.map((p, i) => (i === index ? at : p));
      setPreview({ key, points: moved });
    };
    const handleUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      setPreview(null);
      if (ev.type !== 'pointercancel' && moved) onCommit(moved);
      latest.current.focusMap();
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, []);

  return { preview, begin };
}
