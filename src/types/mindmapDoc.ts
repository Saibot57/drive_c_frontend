import type { MindmapColor, MindmapContent } from '@/types/mindmap';

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

export interface MindmapDoc extends MindmapContent {
  /** Länkar på tvären, utanför trädet. */
  crossLinks?: MindmapCrossLink[];
  /** Saknas betyder `off`: kartor från före nyanserna beter sig som förut. */
  shading?: MindmapShading;
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
