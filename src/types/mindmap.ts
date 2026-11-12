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

/**
 * Var en bild hämtas. Samma form som bildproxyn (`/api/workspace/image-proxy`)
 * tar emot, så att en uppladdning till Drive senare bara blir ett `fileId`.
 */
export type MindmapImageSource =
  | { kind: 'url'; url: string }
  | { kind: 'gdrive'; fileId: string };

/** Fast lista. Mindmap-sidan ritar dem; workspace-kortet visar dem inte. */
export type MindmapIcon = 'star' | 'flag' | 'check' | 'question' | 'warning' | 'idea' | 'clock' | 'pin';

export const MINDMAP_ICONS: MindmapIcon[] = ['star', 'flag', 'check', 'question', 'warning', 'idea', 'clock', 'pin'];

/** Längre än så klipps en anteckning vid inläsning. */
export const MINDMAP_NOTE_MAX_LENGTH = 20_000;

export interface MindmapNode {
  id: string;
  label: string;
  children: MindmapNode[];
  /** Barnen göms. Bara en vy; exporten som text tar med dem ändå. */
  collapsed?: boolean;
  color?: MindmapColor;
  /** Bara på rotens barn, och bara i layouten `both`. */
  side?: MindmapSide;
  /*
   * Fälten nedan tillkom för Mindmap-sidan (docs/plans/mindmap-sida.md).
   * Workspace-kortet bevarar dem när ett kort sparas om, men visar dem inte.
   */
  /** Längre text bakom noden. */
  note?: string;
  /** http(s)-URL. */
  link?: string;
  /**
   * Bild under etiketten. `width` i px vid zoom 1; saknas betyder sidans förval.
   * `aspect` är höjd/bredd, mätt när bilden lagts in, så att layouten vet
   * höjden innan bilden laddats och exporten får samma mått som skärmen.
   */
  image?: { source: MindmapImageSource; width?: number; aspect?: number };
  icon?: MindmapIcon;
  /** Manuell förskjutning från den automatiska platsen, i px vid zoom 1. */
  offset?: { dx: number; dy: number };
  /**
   * Textens bredd i px vid zoom 1: där etiketten bryts, och nodens bredd
   * också när texten är kortare. Saknas betyder sidans standardbredd
   * (docs/plans/mindmap-radbrytning.md, del B).
   */
  textWidth?: number;
}

export interface MindmapContent {
  root: MindmapNode;
  layout?: MindmapLayout;
}
