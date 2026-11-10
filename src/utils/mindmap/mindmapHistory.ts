import type { MindmapContent } from '@/types/mindmap';

/*
 * Mindmapens egen ångra-historik. Workspace lägger medvetet inte
 * innehållsändringar i sin ångra-stack (se updateElementContent), men i en
 * mindmap är det mesta strukturändringar som webbläsarens fältångring inte
 * når: en borttagen gren, en flyttad nod. Historiken lever bara så länge
 * kortet är monterat.
 */

export interface MindmapSnapshot {
  content: MindmapContent;
  selectedId: string;
}

export interface MindmapHistory {
  past: MindmapSnapshot[];
  future: MindmapSnapshot[];
  /**
   * Nyckeln för den senaste posten. En ändring med samma nyckel slås ihop med
   * den, så att ett ord som skrivs i en nod blir ett steg och inte ett per
   * bokstav.
   */
  lastKey: string | null;
}

export const MAX_MINDMAP_HISTORY = 100;

export const emptyHistory = (): MindmapHistory => ({ past: [], future: [], lastKey: null });

/** Sparar läget före en ändring. `key` slår ihop ändringar i följd, `null` gör det aldrig. */
export function recordChange(
  history: MindmapHistory,
  before: MindmapSnapshot,
  key: string | null,
): MindmapHistory {
  if (key !== null && key === history.lastKey) return { ...history, future: [] };
  return {
    past: [...history.past, before].slice(-MAX_MINDMAP_HISTORY),
    future: [],
    lastKey: key,
  };
}

/** Nästa ändring får en egen post, även om nyckeln är densamma. */
export function breakCoalescing(history: MindmapHistory): MindmapHistory {
  return history.lastKey === null ? history : { ...history, lastKey: null };
}

export function undo(
  history: MindmapHistory,
  current: MindmapSnapshot,
): { history: MindmapHistory; snapshot: MindmapSnapshot } | null {
  const snapshot = history.past[history.past.length - 1];
  if (!snapshot) return null;
  return {
    snapshot,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, current],
      lastKey: null,
    },
  };
}

export function redo(
  history: MindmapHistory,
  current: MindmapSnapshot,
): { history: MindmapHistory; snapshot: MindmapSnapshot } | null {
  const snapshot = history.future[history.future.length - 1];
  if (!snapshot) return null;
  return {
    snapshot,
    history: {
      past: [...history.past, current].slice(-MAX_MINDMAP_HISTORY),
      future: history.future.slice(0, -1),
      lastKey: null,
    },
  };
}
