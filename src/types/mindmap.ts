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
 * Linjernas form på Mindmap-sidan (docs/plans/mindmap-placering.md). Bara
 * sidan ritar efter den; kortet ritar alltid kurvan.
 */
export type MindmapEdgeShape = 'curve' | 'straight' | 'elbow';

/** En sida av en nod, där en linje kan fästa. */
export type MindmapAnchor = 'top' | 'right' | 'bottom' | 'left';

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
  /**
   * Egen färg, `#rrggbb` med gemener. Vinner över `color`. Bara sidan ritar
   * den; kortet visar den inte (docs/plans/mindmap-farger.md).
   */
  customColor?: string;
  /**
   * "Ingen färg" under en färgad gren: noden och grenen under den ärver
   * inte någon nyans. Bara sidan läser den.
   */
  colorNone?: true;
  /**
   * Linjen från föräldern hit: egen form och egna fästen, som vinner över
   * kartans val. Bara sidan ritar efter den; kortet ritar alltid kurvan
   * (docs/plans/mindmap-placering.md, del C).
   */
  edge?: MindmapEdgeStyle;
  /**
   * Riktningen för barn som noden får härefter, i grader: 0 är höger och 90
   * nedåt. Flyttar inga barn som redan finns. Bara sidan läser den
   * (docs/plans/mindmap-arrangera.md, del B).
   */
  childDir?: { angle: number };
  /**
   * Var noden står i förhållande till sin förälder, satt när den skapades:
   * i en solfjäder åt en vinkel, eller i en kolumn på en sida. Saknas står
   * noden där den delade layouten sätter den. Bara sidan läser den.
   */
  dir?: MindmapDir;
}

/**
 * Se `dir` på noden. `angle` är nodens egen vinkel från föräldern; `base`
 * är riktningen den skapades åt, som syskonen i samma solfjäder delar, och
 * `gap` luften mellan föräldern och noden i px (saknas: layoutens).
 */
export type MindmapDir = { angle: number; base?: number; gap?: number } | { side: MindmapSide };

/** En linjes egna val. Ett fält som saknas följer kartan. */
export interface MindmapEdgeStyle {
  shape?: MindmapEdgeShape;
  /** Var linjen lämnar föräldern. */
  from?: MindmapAnchor;
  /** Var linjen går in i noden. */
  to?: MindmapAnchor;
  /**
   * Brytpunkter som linjen går igenom, i px vid zoom 1, räknade från
   * förälderns mitt. De följer med när föräldern flyttas (del D).
   */
  points?: { x: number; y: number }[];
}

/** Högst så många brytpunkter på en linje. */
export const MINDMAP_MAX_EDGE_POINTS = 20;

export const MINDMAP_EDGE_SHAPE_VALUES: readonly MindmapEdgeShape[] = ['curve', 'straight', 'elbow'];
export const MINDMAP_ANCHORS: readonly MindmapAnchor[] = ['top', 'right', 'bottom', 'left'];

export interface MindmapContent {
  root: MindmapNode;
  layout?: MindmapLayout;
}
