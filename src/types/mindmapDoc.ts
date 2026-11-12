import {
  MINDMAP_EDGE_SHAPE_VALUES,
  type MindmapAnchor,
  type MindmapColor,
  type MindmapContent,
  type MindmapEdgeShape,
} from '@/types/mindmap';

/**
 * Mindmap-sidans dokument och lista (`/api/mindmap`). Trädet är det delade
 * `MindmapContent`; sidan lägger till tvärlänkar utanför trädet.
 * Nyckelstilen i API:t är camelCase, som Arbetslag och Närvaro.
 */

export interface MindmapCrossLink {
  id: string;
  /** Nod-id. */
  from: string;
  /** Nod-id. */
  to: string;
  label?: string;
  /** Förval `to`. */
  arrow?: 'none' | 'to' | 'both';
  /** En av nodfärgerna, t.ex. grön för stöd och rosa för invändning. */
  color?: MindmapColor;
  /** Del C i docs/plans/mindmap-placering.md. Saknas: den böjda kurvan. */
  shape?: MindmapEdgeShape;
  /** Var länken fäster vid `from`. Saknas: där linjen mot den andra noden lämnar rutan. */
  fromAnchor?: MindmapAnchor;
  /** Var länken fäster vid `to`. */
  toAnchor?: MindmapAnchor;
}

export const MAX_CROSS_LINK_LABEL_LENGTH = 80;

/** Det som sparas i backendens `doc`. */
/**
 * Nyanser nedåt i en färgad gren (docs/plans/mindmap-farger.md). `short`:
 * två nyanser och sedan bara kant, `medium` och `soft`: tre, `off`: inget
 * arv, bara noder med sparad färg är färgade.
 */
export type MindmapShading = 'off' | 'short' | 'medium' | 'soft';

export const MINDMAP_SHADINGS: MindmapShading[] = ['off', 'short', 'medium', 'soft'];

/**
 * Grenarnas linjer i en karta (docs/plans/mindmap-placering.md). `side`:
 * linjen går efter grensidan, som före planen. `nearest`: från de sidor av
 * noderna som vetter mot varandra.
 */
export type MindmapLineAnchor = 'side' | 'nearest';

export const MINDMAP_EDGE_SHAPES: MindmapEdgeShape[] = [...MINDMAP_EDGE_SHAPE_VALUES];
export const MINDMAP_LINE_ANCHORS: MindmapLineAnchor[] = ['side', 'nearest'];

export interface MindmapLines {
  /** Saknas: `curve`. */
  shape?: MindmapEdgeShape;
  /** Saknas: `side`, så att kartor från före planen ritas som förut. */
  anchor?: MindmapLineAnchor;
}

export interface MindmapDoc extends MindmapContent {
  /** Länkar på tvären, utanför trädet. */
  crossLinks?: MindmapCrossLink[];
  /** Saknas betyder `off`: kartor från före nyanserna beter sig som förut. */
  shading?: MindmapShading;
  /** Grenarnas linjer. Saknas: kurvor efter grensidan, som förut. */
  lines?: MindmapLines;
  /** Rutnät att snäppa noderna till (del B). Saknas: av. */
  grid?: boolean;
}

export interface MindmapSummary {
  id: string;
  name: string;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MindmapMap extends MindmapSummary {
  doc: MindmapDoc;
}

export const MAX_MINDMAP_NAME_LENGTH = 150;
export const MAX_MINDMAPS = 100;
