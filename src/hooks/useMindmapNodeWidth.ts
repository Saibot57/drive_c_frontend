'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LaidOutNode } from '@/utils/mindmap/mindmapLayout';
import { draggedTextWidth } from '@/utils/mindmapNodeWidth';

/** Bredden som visas medan handtaget dras. Dokumentet ändras först vid släppet. */
export interface MindmapResize {
  id: string;
  width: number;
}

export interface UseMindmapNodeWidthOptions {
  /** Kartans zoom just nu: skärmens pixlar delas med den. */
  zoom: () => number;
  /** Släppet: bredden sparas, som ett steg i ångra-historiken. */
  onCommit: (id: string, width: number) => void;
}

/**
 * Handtaget på den markerade nodens kant. Under dragningen ritar kartan
 * noden med `resize.width`; vid släppet kommer ett enda `onCommit`, så att
 * Ctrl+Z ångrar hela dragningen. Esc avbryter, liksom ett avbrutet drag.
 */
export function useMindmapNodeWidth({ zoom, onCommit }: UseMindmapNodeWidthOptions) {
  const [resize, setResize] = useState<MindmapResize | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const latest = useRef({ zoom, onCommit });
  latest.current = { zoom, onCommit };

  useEffect(() => () => cleanup.current?.(), []);

  const begin = useCallback((e: React.PointerEvent<HTMLElement>, node: LaidOutNode) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    cleanup.current?.();
    const startX = e.clientX;
    const start = node.labelWidth;
    let current: number | null = null;

    const stop = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      window.removeEventListener('keydown', handleKey, true);
      cleanup.current = null;
      setResize(null);
    };
    const handleMove = (ev: PointerEvent) => {
      current = draggedTextWidth(start, ev.clientX - startX, latest.current.zoom(), node.isRoot ? null : node.side);
      setResize({ id: node.id, width: current });
    };
    const handleUp = (ev: PointerEvent) => {
      const width = current;
      stop();
      if (ev.type === 'pointercancel' || width === null || width === start) return;
      latest.current.onCommit(node.id, width);
    };
    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      ev.stopPropagation();
      stop();
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    window.addEventListener('keydown', handleKey, true);
    cleanup.current = stop;
  }, []);

  return { resize, begin };
}
