import type { MindmapSide } from '@/types/mindmap';
import { clampTextWidth } from '@/utils/mindmap/mindmapTree';

/*
 * En nods egen textbredd på Mindmap-sidan (docs/plans/mindmap-radbrytning.md,
 * del B): handtaget på nodens kant och Ctrl+Shift+← →. Breddernas gränser
 * står i mindmapTree.ts (`MINDMAP_TEXT_WIDTH`), där tvätten läser dem.
 */

/** Ett tryck på Ctrl+Shift+← eller → ändrar bredden så här mycket. */
export const MINDMAP_WIDTH_STEP = 40;

export type MindmapWidthKey = 'narrower' | 'wider';

export interface WidthKeyInput {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** Ctrl+Shift+← smalare, Ctrl+Shift+→ bredare (Cmd på Mac). Bara på en markerad nod. */
export function resolveWidthKey(e: WidthKeyInput): MindmapWidthKey | null {
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return null;
  if (e.key === 'ArrowLeft') return 'narrower';
  if (e.key === 'ArrowRight') return 'wider';
  return null;
}

/** Bredden ett steg smalare eller bredare än den noden har nu, inom gränserna. */
export function steppedTextWidth(current: number, key: MindmapWidthKey): number {
  return clampTextWidth(current + (key === 'wider' ? MINDMAP_WIDTH_STEP : -MINDMAP_WIDTH_STEP));
}

/**
 * Bredden medan handtaget dras. `dx` är pekarens väg i skärmens pixlar.
 * Handtaget sitter på kanten bort från roten: till vänster om roten växer
 * noden åt vänster. Roten står centrerad och växer åt båda håll, så den
 * behöver dubbla vägen för att kanten ska följa pekaren.
 */
export function draggedTextWidth(start: number, dx: number, zoom: number, side: MindmapSide | null): number {
  const factor = side === 'left' ? -1 : side === null ? 2 : 1;
  return clampTextWidth(start + (factor * dx) / (zoom > 0 ? zoom : 1));
}
