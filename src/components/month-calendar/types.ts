import type { HighlightColor } from '@/services/monthCalendarService';

/**
 * Highlighter-verktygets läge.
 *
 * `off` gör bandlagret genomsläppligt för klick — i normalläge finns banden
 * inte för musen. `paint` målar med `activeColor`, `erase` tar bort.
 */
export type HighlighterMode = 'off' | 'paint' | 'erase';

export interface HighlighterState {
  mode: HighlighterMode;
  activeColor: HighlightColor;
}
