/**
 * Mindmapens innehåll, som det sparas i elementets `content`.
 *
 * Allt utöver `id`, `label` och `children` är valfritt och tillkom senare.
 * Gamla kartor saknar fälten och läses som om de stod på sitt förval; se
 * `sanitizeMindmap` i `utils/mindmapTree.ts`.
 */

/** Nodfärger. Namnen pekar på temats markeringsfärger, `--ui-mark-*`. */
export type MindmapColor = 'green' | 'yellow' | 'blue' | 'pink' | 'lilac' | 'grey';

export const MINDMAP_COLORS: MindmapColor[] = ['green', 'yellow', 'blue', 'pink', 'lilac', 'grey'];

export const MINDMAP_COLOR_LABELS: Record<MindmapColor, string> = {
  green: 'Grön',
  yellow: 'Gul',
  blue: 'Blå',
  pink: 'Rosa',
  lilac: 'Lila',
  grey: 'Grå',
};

/** Vilken sida om roten en gren ligger på. Gäller bara rotens barn. */
export type MindmapSide = 'left' | 'right';

/** `right`: alla grenar åt höger. `both`: grenarna fördelas på båda sidor. */
export type MindmapLayout = 'right' | 'both';

export interface MindmapNode {
  id: string;
  label: string;
  children: MindmapNode[];
  /** Barnen göms. Bara en vy; exporten som text tar med dem ändå. */
  collapsed?: boolean;
  color?: MindmapColor;
  /** Bara på rotens barn, och bara i layouten `both`. */
  side?: MindmapSide;
}

export interface MindmapContent {
  root: MindmapNode;
  layout?: MindmapLayout;
}
