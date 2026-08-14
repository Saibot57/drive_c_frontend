import type { HighlightColor } from '@/services/monthCalendarService';

/**
 * Highlighter-paletten.
 *
 * Värdena är samma pastellfamilj som Schema och Temakalender använder, men
 * kopierade hit med flit i stället för importerade från
 * `@/components/schedule/constants`. Schemats palett är kurser, den här är
 * överstrykningspennor — de ska kunna utvecklas var för sig utan att en ändring
 * i den ena tyst ändrar den andra.
 */
export const HIGHLIGHT_PALETTE: Array<{
  key: HighlightColor;
  hex: string;
  label: string;
}> = [
  { key: 'yellow', hex: '#fde68a', label: 'Gul' },
  { key: 'pink', hex: '#fecdd3', label: 'Rosa' },
  { key: 'mint', hex: '#a7f3d0', label: 'Mint' },
  { key: 'blue', hex: '#bae6fd', label: 'Blå' },
  { key: 'purple', hex: '#ddd6fe', label: 'Lila' },
];

export const HIGHLIGHT_HEX: Record<HighlightColor, string> = HIGHLIGHT_PALETTE.reduce(
  (acc, c) => ({ ...acc, [c.key]: c.hex }),
  {} as Record<HighlightColor, string>,
);

export const HIGHLIGHT_LABEL: Record<HighlightColor, string> = HIGHLIGHT_PALETTE.reduce(
  (acc, c) => ({ ...acc, [c.key]: c.label }),
  {} as Record<HighlightColor, string>,
);

/**
 * Opaciteten på ett band. Låg nog att datum och text går att läsa rakt igenom,
 * hög nog att färgen syns mot den varmvita pappersytan.
 */
export const HIGHLIGHT_ALPHA = 0.32;

/** Måste stämma med backendens MIN/MAX/DEFAULT_HIGHLIGHT_BANDS. */
export const MIN_BANDS = 4;
export const MAX_BANDS = 7;
export const DEFAULT_BANDS = 5;

/** Debounce för text. Highlights sparas direkt och går inte via den här. */
export const TEXT_AUTOSAVE_DELAY_MS = 600;

/** `#rrggbb` + alpha till en rgba-sträng. Färgen lagras alltid ogenomskinlig. */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
