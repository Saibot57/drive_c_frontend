/**
 * Veckokartan i Närvarorutor: en ruta per kolumn i arket och veckodag, med
 * schemats namn på passet när veckan har ett schema. Allt här är rent.
 * Se docs/plans/narvaro-veckokarta.md, avsnitt 3 och 8.
 */

import type { ScheduledEntry } from '@/types/schedule';
import {
  NotesStore,
  PassChoice,
  combineSheets,
  dateForDay,
  dayColumns,
  noteEntries,
  roster,
  selectionForDay,
  sessionKey,
} from '@/utils/narvaro';
import { Sheets, isWeekKey, weekMonday, weekOfSession } from '@/utils/narvaroDocs';
import {
  entriesForClasses,
  entriesForColumn,
  entriesForDay,
  isMine,
  sessionClasses,
  sortForDisplay,
} from '@/utils/narvaroSchedule';
import { splitTeacherNames } from '@/utils/scheduleStats';
import { minutesToTime } from '@/utils/scheduleTime';

export type WeekMapCell = {
  /** Kolumnens id, eller `'day'` för en ruta som slagits ihop över dagen. */
  pass: PassChoice;
  /** Kolumnerna rutan står för. Valet på sidan kan vara vilken som helst av dem. */
  columns: string[];
  /** "D", eller "K–N" för en ihopslagen ruta. */
  letters: string;
  /** "12:30", eller "08:30–15:30" för en ihopslagen ruta. */
  time: string;
  title: string;
  teachers: string[];
  /** Antal fler schemapass som hör till kolumnen. */
  more: number;
  mine: boolean;
  present: number;
  /** Ingen är markerad i arket och ingen är tillagd för hand. */
  empty: boolean;
  hasNotes: boolean;
};

export type WeekMapDay = { day: string; date: Date; isToday: boolean; cells: WeekMapCell[] };

export type WeekMapInput = {
  /** Veckans ark per klass, det senaste fram till veckan (`latestSheets`). */
  sheets: Sheets;
  /** Alla klasser som visas, i ordning (`''` för ett ark utan klass). */
  allClasses: string[];
  /** Det sparade klassvalet. Dagens urval räknas med `selectionForDay`. */
  chosen: string[];
  /** Klassernas namn, för att känna igen dem i schemats titlar. */
  classNames: string[];
  /** Veckans schemapass, eller null när veckan saknar schema. */
  weekEntries: ScheduledEntry[] | null;
  myName: string;
  notes: NotesStore;
  weekKey: string;
  now: Date;
};

const sameDate = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const sheetTime = (time: [number, number] | null) => (time ? minutesToTime(time[0]) : '');

/** Har passet noteringar från någon av klasserna? Okända namn räknas också. */
function notesFor(notes: NotesStore, key: string, sheets: Sheets, classes: string[]): boolean {
  const sess = notes[key];
  if (!sess || !noteEntries(sess).length) return false;
  const from = sessionClasses(sess, sheets);
  return !from.length || from.some(k => classes.includes(k));
}

/** Veckans dagar med en ruta per kolumn i arket, för de valda klasserna. */
export function weekMapDays(input: WeekMapInput): WeekMapDay[] {
  const { sheets, allClasses, chosen, classNames, weekEntries, myName, notes, weekKey, now } = input;
  const monday = weekMonday(weekKey) ?? now;
  const days = combineSheets(sheets, allClasses).days;
  return days.map(day => {
    const selected = selectionForDay(sheets, allClasses, chosen, day);
    const table = combineSheets(sheets, selected);
    const dayCols = dayColumns(table, day);
    const dayEntries = (weekEntries ?? []).filter(e => e.day === day);
    const wholeDay = new Set(entriesForDay(dayCols, dayEntries).map(e => e.instanceId));
    const date = dateForDay(day, monday);

    const present = (pass: PassChoice, key: string) =>
      roster(table, { klass: 'all', day, pass, added: notes[key]?.added ?? [] }).present.length;

    // En rad per kolumn, och vilket heldagspass den ensam visar (för ihopslagningen).
    const rows = dayCols.map(col => {
      const shown = sortForDisplay(
        entriesForClasses(entriesForColumn(col, dayCols, dayEntries), classNames, selected),
        myName,
      );
      const first = shown[0];
      const key = sessionKey(table, day, col.id, monday);
      const count = present(col.id, key);
      const cell: WeekMapCell = {
        pass: col.id,
        columns: [col.id],
        letters: col.letter || String(col.index + 1),
        time: first ? first.startTime : sheetTime(col.time),
        title: first ? first.title.trim() : col.pass,
        teachers: first ? splitTeacherNames(first.teacher) : [],
        more: Math.max(0, shown.length - 1),
        mine: !!first && isMine(first, myName),
        present: count,
        empty: count === 0,
        hasNotes: notesFor(notes, key, sheets, selected),
      };
      const fullDay = shown.length === 1 && wholeDay.has(first.instanceId) ? first : null;
      return { cell, fullDay };
    });

    // Kolumner i följd vars enda pass är samma heldagspass blir en ruta, som väljer hela dagen.
    const cells: WeekMapCell[] = [];
    for (let i = 0; i < rows.length; i++) {
      const start = rows[i];
      let j = i;
      while (start.fullDay && j + 1 < rows.length && rows[j + 1].fullDay?.instanceId === start.fullDay.instanceId) j++;
      if (j === i || !start.fullDay) {
        cells.push(start.cell);
        continue;
      }
      const group = rows.slice(i, j + 1).map(r => r.cell);
      const key = sessionKey(table, day, 'day', monday);
      const count = present('day', key);
      cells.push({
        ...start.cell,
        pass: 'day',
        columns: group.map(c => c.pass),
        letters: `${group[0].letters}–${group[group.length - 1].letters}`,
        time: `${start.fullDay.startTime}–${start.fullDay.endTime}`,
        present: count,
        empty: count === 0,
        hasNotes: notesFor(notes, key, sheets, selected) || group.some(c => c.hasNotes),
      });
      i = j;
    }
    return { day, date, isToday: sameDate(date, now), cells };
  });
}

/** Är rutan den som är vald på sidan? En ihopslagen ruta gäller alla sina kolumner. */
export const isCellSelected = (cell: WeekMapCell, pass: PassChoice) =>
  cell.pass === pass || cell.columns.includes(pass);

/**
 * Passet före eller efter det valda, i kartans ordning genom veckan. Hela
 * dagen hoppas över: från den går ett steg framåt till dagens första ruta
 * och bakåt till föregående dags sista. Null vid veckans början eller slut.
 */
export function adjacentPass(days: WeekMapDay[], day: string, pass: PassChoice, step: -1 | 1): { day: string; pass: PassChoice } | null {
  const flat = days.flatMap(d => d.cells.map(cell => ({ day: d.day, cell })));
  let at = flat.findIndex(x => x.day === day && isCellSelected(x.cell, pass));
  if (at < 0) {
    if (pass !== 'day') return null;
    const first = flat.findIndex(x => x.day === day);
    if (first < 0) return null;
    // Hela dagen ligger före dagens första ruta.
    at = step === 1 ? first - 1 : first;
  }
  const next = flat[at + step];
  return next ? { day: next.day, pass: next.cell.pass } : null;
}

export type MapWeek = { week: string; hasNotes: boolean };

/**
 * Veckorna i kartans veckorad: de som har ett ark eller noteringar, och den
 * här veckan. Äldst först.
 */
export function mapWeeks(tables: Record<string, Sheets>, notes: NotesStore, currentWeek: string): MapWeek[] {
  const withNotes = new Set(
    Object.keys(notes)
      .filter(k => noteEntries(notes[k]).length > 0)
      .map(weekOfSession)
      .filter((w): w is string => !!w),
  );
  const weeks = new Set([
    ...Object.keys(tables).filter(w => Object.keys(tables[w] ?? {}).length > 0),
    ...Array.from(withNotes),
    currentWeek,
  ]);
  return Array.from(weeks)
    .filter(isWeekKey)
    .sort()
    .map(week => ({ week, hasNotes: withNotes.has(week) }));
}

export type WeekMapMode = 'week' | 'day';

/** Kartans läge per enhet: hela veckan eller bara den valda dagen. */
export const sanitizeWeekMapMode = (raw: unknown): WeekMapMode => (raw === 'day' ? 'day' : 'week');
