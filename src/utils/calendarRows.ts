/**
 * Kalenderns textrader.
 *
 * Bandantalet är också antalet rader i en dagcell: varje rad är ett band, och
 * texten skalas så att en rad text fyller en rad i cellen. Därför får ingen dag
 * ha fler rader än det valda antalet, och antalet får inte sänkas under vad
 * någon dag redan använder.
 */
import { MAX_BANDS, MIN_BANDS } from '@/config/monthCalendarConstants';

/**
 * Rader som texten använder: radbrytningar räknas, tomma rader i slutet gör
 * det inte. Måste stämma med `count_text_rows` i backendens
 * `models/month_calendar_models.py`, som avgör om ett lägre antal godtas.
 */
export function countTextRows(text: string): number {
  const trimmed = text.replace(/\s+$/, '');
  return trimmed ? trimmed.split('\n').length : 0;
}

/**
 * Får en ändring av snabbtexten göras med `rows` rader? Här räknas alla rader,
 * även tomma i slutet — annars kunde Enter lägga markören på en rad som inte
 * syns. En text som redan har fler rader (från före spärren) får redigeras så
 * länge den inte växer.
 */
export function fitsRows(previous: string, next: string, rows: number): boolean {
  const lines = (s: string) => s.split('\n').length;
  return lines(next) <= Math.max(rows, lines(previous));
}

/** Lägsta valbara antal givet den dag som har flest rader. */
export function minRowsFor(usedRows: number): number {
  return Math.min(MAX_BANDS, Math.max(MIN_BANDS, usedRows));
}
