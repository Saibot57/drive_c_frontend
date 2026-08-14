/**
 * Datumlagret för månadskalendern.
 *
 * Två regler som all kod här följer, och som testerna vaktar:
 *
 * 1. Dagnyckeln byggs ur lokala komponenter, aldrig ur `toISOString()`. En
 *    lokal midnatt i Stockholm är föregående dygn i UTC under sommartid, så
 *    `toISOString().split('T')[0]` ger fel kalenderdag. Den buggen finns live i
 *    `calendarService.ts` och är anledningen till att den här filen existerar.
 *
 * 2. `isoWeekYear` från `dateSv.ts` anropas alltid med *strängen*, aldrig med
 *    ett `Date`-objekt. Den läser med `getUTC*`, så ett lokalt Date-objekt för
 *    en måndag pekar på söndagen före i UTC — och varje rad i månadsvyn börjar
 *    på en måndag. Med Date-objekt hade alltså samtliga veckonummer blivit ett
 *    för lågt.
 */
import { SV_FROM_ISO, isoWeekYear } from '@/utils/dateSv';

/** Lokalt kalenderdatum som `YYYY-MM-DD`. Kanonisk nyckel mot API och cache. */
export type DateKey = string;

export interface DayCell {
  /** Lokal midnatt för dagen. */
  date: Date;
  key: DateKey;
  /** 1–31, för visningen i cellens hörn. */
  dayOfMonth: number;
  /** ISO-veckonummer. Samma för alla sju celler i en rad. */
  isoWeek: number;
  /** Falskt för grannmånadernas dagar, som visas nedtonade. */
  inMonth: boolean;
}

export const SV_MONTHS = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
] as const;

/** Kolumnrubriker, måndag först. */
export const SV_WEEKDAYS_SHORT = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'] as const;

/** Alltid sex rader. Ger stabil höjd och kontinuerliga veckor. */
export const WEEKS_IN_MATRIX = 6;
export const DAYS_IN_MATRIX = WEEKS_IN_MATRIX * 7;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Lokal `YYYY-MM-DD`. Använd denna överallt där en dag ska bli en nyckel.
 */
export function toLocalDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Nyckel till lokal midnatt. `new Date('2026-08-14')` hade tolkats som UTC och
 * gett fel dag i Sverige; treargumentsformen är alltid lokal.
 */
export function fromLocalDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // Fångar 2026-02-30, som annars glider över till 2 mars.
  return (
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
  );
}

/** ISO-veckodag, 1 = måndag ... 7 = söndag. Lokal, till skillnad från `dateSv.isoWeekday`. */
export function localIsoWeekday(date: Date): number {
  const day = date.getDay(); // 0 = söndag
  return day === 0 ? 7 : day;
}

/** ISO-veckonummer för en dagnyckel. */
export function getIsoWeek(key: DateKey): number {
  return isoWeekYear(key).week;
}

export function getIsoWeekYear(key: DateKey): { week: number; year: number } {
  return isoWeekYear(key);
}

/** Antal dagar mellan två nycklar, i hela dygn. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Månadsmatrisen: alltid 42 celler från måndagen i den vecka månaden börjar.
 *
 * `month` är 0-indexerad, som i `Date`.
 */
export function getMonthMatrix(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  // Backa till veckans måndag. För en måndag blir det noll steg.
  const start = addDays(first, -(localIsoWeekday(first) - 1));

  const cells: DayCell[] = [];
  for (let i = 0; i < DAYS_IN_MATRIX; i++) {
    const date = addDays(start, i);
    const key = toLocalDateKey(date);
    cells.push({
      date,
      key,
      dayOfMonth: date.getDate(),
      isoWeek: getIsoWeek(key),
      inMonth: date.getMonth() === month && date.getFullYear() === year,
    });
  }
  return cells;
}

/** Matrisen radvis, för veckonummerkolumnen. */
export function getMatrixRows(cells: DayCell[]): DayCell[][] {
  const rows: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

/** Första och sista nyckeln i matrisen — intervallet som ska hämtas. */
export function getMatrixRange(cells: DayCell[]): { start: DateKey; end: DateKey } {
  return { start: cells[0].key, end: cells[cells.length - 1].key };
}

/** Månad + år för toolbaren, versaliserat som rubrik: "Augusti 2026". */
export function formatMonthTitle(year: number, month: number): string {
  const name = SV_MONTHS[month];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

/** Fullständigt datum för sidebaren: "Fredag 14 augusti 2026". */
export function formatSwedishDate(key: DateKey): string {
  const date = fromLocalDateKey(key);
  const weekday = SV_FROM_ISO[localIsoWeekday(date)];
  return `${weekday} ${date.getDate()} ${SV_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Kort form för aria-etiketter och tooltips: "14 augusti 2026". */
export function formatSwedishDateShort(key: DateKey): string {
  const date = fromLocalDateKey(key);
  return `${date.getDate()} ${SV_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Föregående/nästa månad, med årsskifte hanterat. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** Dagens nyckel. Tar en klocka så att tester slipper vara tidsberoende. */
export function todayKey(now: Date = new Date()): DateKey {
  return toLocalDateKey(now);
}
