/**
 * Fontroller → jsPDF-fonter.
 *
 * Enda filen som vet vilka typsnitt som faktiskt används. Scenbyggaren och
 * layoutlagret känner bara `FontRole`, så ett byte till inbäddad Red Hat Text
 * rör den här filen och `jspdfMeasurer.ts`, ingenting annat.
 *
 * v1 använder jsPDF:s inbyggda standardfonter. De kostar noll byte, noll
 * nätverksanrop och har korrekta metrics i Node — vilket är det som gör hela
 * mät- och klämkedjan testbar. WinAnsiEncoding täcker `å ä ö`, tankstreck och
 * ellips, verifierat mot den installerade versionen.
 *
 * Två avvikelser mot skärmen, båda medvetna:
 *
 * - `font-semibold` (600) på lärarnamnen finns inte laddad i appen heller —
 *   `RootLayoutBase` hämtar 400/500/700 och webbläsaren syntetiserar 600. Här
 *   mappas den till 700, så namnen blir aningen fetare i filen.
 * - `font-mono` laddar ingen font alls i projektet, så skärmen visar systemets
 *   mono och pariteten är redan odefinierad. Courier är genuint monospace
 *   (600/1000 em), vilket radar upp tidsetiketterna i alla kort.
 */

import { FontRole } from './scene';

export type JsPdfFont = { name: string; style: string };

export const FONTS: Record<FontRole, JsPdfFont> = {
  title: { name: 'helvetica', style: 'bold' },
  meta: { name: 'helvetica', style: 'bold' },
  body: { name: 'helvetica', style: 'normal' },
  mono: { name: 'courier', style: 'bold' },
};

/**
 * Baslinjens avstånd från radens överkant, som andel av fontstorleken.
 * Ascender ur fonternas egna metrics: Helvetica 718/1000, Courier 629/1000.
 */
export const ASCENT_RATIO: Record<FontRole, number> = {
  title: 0.718,
  meta: 0.718,
  body: 0.718,
  mono: 0.629,
};
