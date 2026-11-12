/**
 * Färgerna under "Fler färger" i mindmapens färgmeny
 * (docs/plans/mindmap-farger.md, del B). Tolv kulörer i två rader, en stark
 * och en ljus. De sparas som egen färg (`customColor`) och dämpas i Kronberg
 * som schemats kurser; de sex fasta färgerna (`MINDMAP_COLORS`) står kvar
 * först i menyn och följer temats tokens.
 *
 * Värdena är färger att välja bland, som `COURSE_COLOR_PALETTE`, inte
 * appens utseende.
 */
export interface MindmapPaletteColor {
  hex: string;
  label: string;
}

const NAMES = ['Röd', 'Orange', 'Bärnsten', 'Lime', 'Grön', 'Turkos', 'Cyan', 'Blå', 'Indigo', 'Lila', 'Hallon', 'Brun'];

const STRONG = ['#dc2626', '#ea580c', '#d97706', '#65a30d', '#16a34a', '#0d9488', '#0891b2', '#2563eb', '#4f46e5', '#7c3aed', '#db2777', '#92400e'];
const LIGHT = ['#fca5a5', '#fdba74', '#fcd34d', '#bef264', '#86efac', '#5eead4', '#67e8f9', '#93c5fd', '#a5b4fc', '#c4b5fd', '#f9a8d4', '#d6b89c'];

export const MINDMAP_PALETTE_ROWS: readonly (readonly MindmapPaletteColor[])[] = [
  STRONG.map((hex, i) => ({ hex, label: NAMES[i] })),
  LIGHT.map((hex, i) => ({ hex, label: `Ljus ${NAMES[i].toLowerCase()}` })),
];

export const MINDMAP_PALETTE: readonly string[] = [...STRONG, ...LIGHT];

/** Var de senast valda egna färgerna sparas, och hur många. */
export const MINDMAP_RECENT_COLORS_KEY = 'mindmap.recentColors.v1';
export const MINDMAP_RECENT_COLORS_MAX = 8;

/** Om "Fler färger" är utfälld. */
export const MINDMAP_COLOR_MENU_KEY = 'mindmap.colorMenu.v1';
