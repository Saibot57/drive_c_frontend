/**
 * Export av noteringarna i Närvarorutor som text: ett stycke per pass och
 * klass, med datum, schemats titel och schemats anteckning, så att texten går
 * att lägga i ett dokument och härleda till rätt pass.
 * Se docs/plans/narvaro-export.md.
 *
 * Texten innehåller elevnamn i klartext. Den byggs i webbläsaren och skickas
 * ingenstans härifrån.
 */

import type { ScheduledEntry } from '@/types/schedule';
import {
  AttendanceTable,
  NotesStore,
  PassChoice,
  PassNames,
  SessionNotes,
  Stamp,
  combineSheets,
  noteEntries,
  passNameFor,
  sessionLabel,
  sessionText,
} from '@/utils/narvaro';
import { Sheets, isWeekKey, latestSheets, weekMonday, weekOfSession } from '@/utils/narvaroDocs';
import { entriesForChoice, entriesForClasses, isMine, scheduleLineParts, sortForDisplay } from '@/utils/narvaroSchedule';

/** Namn i ett pass som inte finns i något av veckans ark. */
export const UNKNOWN_CLASS = '\u0000okänd';

export type ExportInput = {
  /** Veckorna som ska med (`w2026-47`), i valfri ordning. */
  weeks: readonly string[];
  /** Klasserna som ska med. `''` är arket utan klass. */
  classes: readonly string[];
  tables: Record<string, Sheets>;
  notes: NotesStore;
  passNames: PassNames;
  stamps: readonly Stamp[];
  /** Veckans schemapass. Saknas veckan, eller är den `null`, skrivs inga schemarader. */
  schedules: Record<string, ScheduledEntry[] | null | undefined>;
  myName: string;
  resolveRoom?: (title: string, room?: string) => string;
  /** Dagen exporten görs, för raden överst. */
  today: Date;
};

const classLabel = (klass: string) => (klass === UNKNOWN_CLASS ? 'Okänd klass' : klass || 'Utan klass');

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const weekNumber = (weekKey: string) => weekKey.slice(-2).replace(/^0/, '');

/** "Vecka 47 · 16/11–22/11 2026". */
export function weekTitle(weekKey: string): string {
  const monday = weekMonday(weekKey);
  if (!monday) return `Vecka ${weekNumber(weekKey)}`;
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const dm = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  return `Vecka ${weekNumber(weekKey)} · ${dm(monday)}–${dm(sunday)} ${sunday.getFullYear()}`;
}

/** Veckans pass med noteringar, i tidsordning: datum, sedan arkets kolumnordning. */
function sessionsOfWeek(weekKey: string, notes: NotesStore, table: AttendanceTable): { key: string; day: string; pass: PassChoice | null }[] {
  const order = (pass: PassChoice | null) => {
    if (pass === 'day') return -1;
    const col = table.cols.find(c => c.id === pass);
    return col ? col.index : Number.MAX_SAFE_INTEGER;
  };
  return Object.keys(notes)
    .filter(k => weekOfSession(k) === weekKey && noteEntries(notes[k]).length > 0)
    .map(key => {
      const [, day = '', which = ''] = key.split('|');
      const col = table.cols.find(c => c.day === day && (c.letter === which || c.id === which));
      const pass: PassChoice | null = which === 'dag' ? 'day' : col?.id ?? null;
      return { key, day, pass };
    })
    .sort((a, b) => a.key.slice(0, 10).localeCompare(b.key.slice(0, 10)) || order(a.pass) - order(b.pass) || a.key.localeCompare(b.key));
}

/** Passets noteringar delade per klass. Namn utanför arken hamnar under `UNKNOWN_CLASS`. */
function byClass(sess: SessionNotes, sheets: Sheets, combined: AttendanceTable): Map<string, SessionNotes> {
  const classOf = new Map<string, string>();
  // Arkets egna namn först, så att namnet som `combineSheets` skriver vinner.
  Object.entries(sheets).forEach(([klass, t]) => t.people.forEach(p => { if (!classOf.has(p.name)) classOf.set(p.name, klass); }));
  combined.people.forEach(p => classOf.set(p.name, p.klass ?? ''));
  const out = new Map<string, SessionNotes>();
  noteEntries(sess).forEach(([name, note]) => {
    const klass = classOf.get(name) ?? UNKNOWN_CLASS;
    const part = out.get(klass) ?? { label: '', people: {}, added: [] };
    part.people[name] = note;
    out.set(klass, part);
  });
  return out;
}

/** Schemaraderna för passet och klassen: det egna passet om det finns, annars alla. */
function scheduleLines(
  table: AttendanceTable,
  day: string,
  pass: PassChoice,
  klass: string,
  classNames: string[],
  weekEntries: ScheduledEntry[],
  myName: string,
  resolveRoom: ExportInput['resolveRoom'],
): string[] {
  const forClass = entriesForClasses(entriesForChoice(table, day, pass, weekEntries), classNames, [klass]);
  const mine = forClass.filter(e => isMine(e, myName));
  return sortForDisplay(mine.length ? mine : forClass, myName).flatMap(entry => {
    const p = scheduleLineParts(entry, resolveRoom);
    const lines = [`Schema: ${[p.title, p.teachers.join(', '), p.room].filter(Boolean).join(' · ')}`];
    if (p.notes) lines.push(`Innehåll: ${p.notes}`);
    return lines;
  });
}

function weekBlocks(weekKey: string, input: ExportInput): string[] {
  const monday = weekMonday(weekKey);
  if (!monday) return [];
  const sheets: Sheets = Object.fromEntries(
    Object.entries(latestSheets(input.tables, weekKey)).map(([k, ref]) => [k, ref.table]),
  );
  const allClasses = Object.keys(sheets).sort((a, b) => a.localeCompare(b, 'sv'));
  const classNames = allClasses.filter(Boolean);
  const combined = combineSheets(sheets, allClasses);
  const weekEntries = input.schedules[weekKey] ?? null;
  const wanted = new Set(input.classes);

  const blocks: string[] = [];
  sessionsOfWeek(weekKey, input.notes, combined).forEach(({ key, day, pass }) => {
    const sess = input.notes[key];
    const parts = byClass(sess, sheets, combined);
    [...allClasses, UNKNOWN_CLASS].forEach(klass => {
      const part = parts.get(klass);
      // Namn utan ark följer med när något alls exporteras; annars försvinner de tyst.
      if (!part || (klass !== UNKNOWN_CLASS && !wanted.has(klass))) return;
      const name = klass === UNKNOWN_CLASS ? '' : passNameFor(input.passNames, key, [klass]);
      // Ett pass vars kolumn inte finns i veckans ark behåller rubriken det sparades med.
      const heading = pass ? sessionLabel(combined, day, pass, monday, name) : sess.label || key;
      const lines = [`${heading} · ${classLabel(klass)}`];
      if (pass && weekEntries && klass !== UNKNOWN_CLASS) {
        lines.push(...scheduleLines(combined, day, pass, klass, classNames, weekEntries, input.myName, input.resolveRoom));
      }
      const people = { ...combined, people: combined.people.filter(p => (p.klass ?? '') === klass) };
      const body = sessionText(part, people, input.stamps).split('\n').slice(1);
      lines.push('', ...body.map(l => (l ? `  ${l}` : l)));
      blocks.push(lines.join('\n'));
    });
  });
  return blocks;
}

/** Hela exporten. Veckor utan noteringar för de valda klasserna hoppas över. */
export function exportText(input: ExportInput): string {
  const weeks = Array.from(new Set(input.weeks)).filter(isWeekKey).sort();
  const sections = weeks
    .map(week => ({ week, blocks: weekBlocks(week, input) }))
    .filter(s => s.blocks.length > 0);
  if (!sections.length) return '';
  const classes = [...input.classes].sort((a, b) => a.localeCompare(b, 'sv')).map(classLabel).join(', ');
  const head = ['Noteringar från Närvarorutor', classes && `Klasser: ${classes}`, `Exporterad ${isoDay(input.today)}`].filter(Boolean);
  return [
    head.join('\n'),
    ...sections.map(s => [`== ${weekTitle(s.week)} ==`, ...s.blocks].join('\n\n')),
  ].join('\n\n\n') + '\n';
}

export type ExportWeek = { week: string; sessions: number };

/** Veckorna som har noteringar, senaste först, med antalet pass. */
export function exportWeeks(notes: NotesStore): ExportWeek[] {
  const count = new Map<string, number>();
  Object.keys(notes).forEach(k => {
    const w = weekOfSession(k);
    if (w && noteEntries(notes[k]).length > 0) count.set(w, (count.get(w) ?? 0) + 1);
  });
  return Array.from(count, ([week, sessions]) => ({ week, sessions })).sort((a, b) => b.week.localeCompare(a.week));
}

/** Klasserna som har ett ark någon av veckorna. `''` (utan klass) sist. */
export function exportClasses(tables: Record<string, Sheets>, weeks: readonly string[]): string[] {
  const all = new Set<string>();
  weeks.forEach(w => Object.keys(latestSheets(tables, w)).forEach(k => all.add(k)));
  return Array.from(all).sort((a, b) => Number(!a) - Number(!b) || a.localeCompare(b, 'sv'));
}

/** "noteringar-v47.txt" eller "noteringar-v45-v47.txt". */
export function exportFileName(weeks: readonly string[]): string {
  const sorted = Array.from(new Set(weeks)).filter(isWeekKey).sort();
  if (!sorted.length) return 'noteringar.txt';
  const first = `v${weekNumber(sorted[0])}`;
  const last = `v${weekNumber(sorted[sorted.length - 1])}`;
  return `noteringar-${first === last ? first : `${first}-${last}`}.txt`;
}
