/**
 * Textmätning och radbrytning utan DOM.
 *
 * Mätningen injiceras som gränssnitt i stället för att koden ropar på jsPDF
 * direkt. Det gör hela layoutlagret testbart mot en mätare vars siffror går
 * att räkna för hand, och det håller fontvalet i en enda fil.
 */

import { FontRole } from './scene';

export type TextMeasurer = {
  /** Bredd i px för `text` satt i `font` vid `sizePx`. */
  width(text: string, font: FontRole, sizePx: number): number;
  /**
   * Baslinjens avstånd från radens överkant, som andel av fontstorleken.
   * Enda stället där renderarna annars skulle placera texten olika.
   */
  ascentRatio(font: FontRole): number;
};

export const ELLIPSIS = '…';

/**
 * Bryter text till rader som ryms inom `maxWidthPx`.
 *
 * `.pdf-export` sätter `white-space: pre-line` och `overflow-wrap: anywhere` på
 * allt i kortet, så radbrytaren måste bevara explicita radbrytningar, kollapsa
 * löpande blanksteg och kunna bryta *inuti* ett ord som är bredare än raden.
 *
 * jsPDF:s egen `splitTextToSize` klarar inte det sista — den lämnar en överbred
 * rad — och en överbred rad går inte längre att gömma bakom `overflow: hidden`.
 */
export const wrapText = (
  text: string,
  maxWidthPx: number,
  font: FontRole,
  sizePx: number,
  measure: TextMeasurer
): string[] => {
  if (!text) return [];
  const fits = (value: string) => measure.width(value, font, sizePx) <= maxWidthPx;

  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    const collapsed = paragraph.replace(/[ \t]+/g, ' ').trim();
    if (!collapsed) {
      // En tom rad i anteckningarna är ett medvetet avstånd, inte brus.
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of collapsed.split(' ')) {
      const candidate = current ? `${current} ${word}` : word;
      if (fits(candidate)) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
        current = '';
      }

      if (fits(word)) {
        current = word;
        continue;
      }

      // Ordet ryms inte ens ensamt — bryt hårt, tecken för tecken.
      let rest = word;
      while (rest && !fits(rest)) {
        const cut = longestPrefix(rest, maxWidthPx, font, sizePx, measure);
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }

    if (current) lines.push(current);
  }

  return lines;
};

/** Längsta prefix som ryms. Minst ett tecken, annars vore loopen oändlig. */
const longestPrefix = (
  text: string,
  maxWidthPx: number,
  font: FontRole,
  sizePx: number,
  measure: TextMeasurer
): number => {
  let low = 1;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure.width(text.slice(0, mid), font, sizePx) <= maxWidthPx) low = mid;
    else high = mid - 1;
  }
  return low;
};

/**
 * Kortar av texten så att den plus "…" ryms — alltid, även om texten redan
 * skulle rymmas som den är.
 *
 * Det är skillnaden mot `truncateToWidth`, och den spelar roll: en rad som
 * klipptes bort under sig ska sluta med "…" även när raden i sig är kort.
 */
export const clipWithEllipsis = (
  text: string,
  maxWidthPx: number,
  font: FontRole,
  sizePx: number,
  measure: TextMeasurer
): string => {
  if (measure.width(ELLIPSIS, font, sizePx) > maxWidthPx) return '';
  if (measure.width(text + ELLIPSIS, font, sizePx) <= maxWidthPx) return text + ELLIPSIS;

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure.width(text.slice(0, mid) + ELLIPSIS, font, sizePx) <= maxWidthPx) low = mid;
    else high = mid - 1;
  }
  return text.slice(0, low).trimEnd() + ELLIPSIS;
};

/** Som `clipWithEllipsis`, men lämnar text som redan ryms orörd. */
export const truncateToWidth = (
  text: string,
  maxWidthPx: number,
  font: FontRole,
  sizePx: number,
  measure: TextMeasurer
): string =>
  measure.width(text, font, sizePx) <= maxWidthPx
    ? text
    : clipWithEllipsis(text, maxWidthPx, font, sizePx, measure);
