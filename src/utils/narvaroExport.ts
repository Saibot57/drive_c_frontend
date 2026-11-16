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
  GroupsStore,
  NotesStore,
  PassChoice,
  PassNames,
  PersonNote,
  SessionNotes,
  Stamp,
  combineSheets,
  noteEntries,
  passNameFor,
  sessionLabel,
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
  /** Passens sparade grupper. Finns de skrivs noteringarna grupp för grupp. */
  groups: GroupsStore;
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

type Noted = [string, PersonNote][];

/** Passets noteringar delade per klass. Namn utanför arken hamnar under `UNKNOWN_CLASS`. */
function byClass(sess: SessionNotes, sheets: Sheets, combined: AttendanceTable): Map<string, Noted> {
  const classOf = new Map<string, string>();
  // Arkets egna namn först, så att namnet som `combineSheets` skriver vinner.
  Object.entries(sheets).forEach(([klass, t]) => t.people.forEach(p => { if (!classOf.has(p.name)) classOf.set(p.name, klass); }));
  combined.people.forEach(p => classOf.set(p.name, p.klass ?? ''));
  const out = new Map<string, Noted>();
  noteEntries(sess).forEach(entry => {
    const klass = classOf.get(entry[0]) ?? UNKNOWN_CLASS;
    out.set(klass, [...(out.get(klass) ?? []), entry]);
  });
  return out;
}

type Unit = { classes: string[]; groups: string[][] | null };

/**
 * Styckena för ett pass. Klasser som delats in i grupper tillsammans blir ett
 * stycke, så att grupperna hålls hela; övriga klasser får var sitt. Finns
 * flera indelningar väljs den som täcker flest av klasserna, sedan nästa
 * bland de klasser som är kvar.
 */
function unitsFor(key: string, classes: string[], groups: GroupsStore): Unit[] {
  const sets = Object.keys(groups)
    .filter(k => k.startsWith(`${key}#`) && groups[k]?.groups?.some(g => g.length > 0))
    .map(k => ({ classes: k.slice(key.length + 1).split('+'), groups: groups[k].groups }));
  let left = [...classes];
  const units: Unit[] = [];
  for (;;) {
    const best = sets
      .map(s => ({ ...s, hit: s.classes.filter(c => left.includes(c)) }))
      .filter(s => s.hit.length > 0)
      .sort((a, b) => b.hit.length - a.hit.length || a.classes.length - b.classes.length)[0];
    if (!best) break;
    units.push({ classes: best.hit, groups: best.groups });
    left = left.filter(c => !best.hit.includes(c));
  }
  left.forEach(c => units.push({ classes: [c], groups: null }));
  // I klassernas ordning, efter styckets första klass.
  return units.sort((a, b) => classes.indexOf(a.classes[0]) - classes.indexOf(b.classes[0]));
}

/**
 * Noteringarna som rader, alla i en lista. Med grupper: grupp för grupp med
 * en tom rad mellan och utan rubrik, och de som inte är med i någon grupp sist.
 */
function noteLines(noted: Noted, groups: string[][] | null, stamps: readonly Stamp[]): string[] {
  const line = ([name, n]: Noted[number]) => {
    const labels = n.tags.map(id => stamps.find(s => s.id === id)?.label).filter(Boolean).join(', ');
    return `  ${name}: ${[labels, n.note].filter(Boolean).join('. ')}`;
  };
  if (!groups) return noted.map(line);
  const byName = new Map(noted);
  const used = new Set<string>();
  const chunks = groups.map(g => g.filter(name => byName.has(name) && !used.has(name) && !!used.add(name)));
  chunks.push(noted.map(([name]) => name).filter(name => !used.has(name)));
  return chunks
    .filter(c => c.length > 0)
    .flatMap((c, i) => [...(i ? [''] : []), ...c.map(name => line([name, byName.get(name)!]))]);
}

/** Schemaraderna för passet och klasserna: det egna passet om det finns, annars alla. */
function scheduleLines(
  table: AttendanceTable,
  day: string,
  pass: PassChoice,
  classes: string[],
  classNames: string[],
  weekEntries: ScheduledEntry[],
  myName: string,
  resolveRoom: ExportInput['resolveRoom'],
): string[] {
  const forClass = entriesForClasses(entriesForChoice(table, day, pass, weekEntries), classNames, classes);
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
    const present = allClasses.filter(k => parts.has(k) && wanted.has(k));
    const units = unitsFor(key, present, input.groups);
    // Namn utan ark följer med när något alls exporteras; annars försvinner de tyst.
    if (parts.has(UNKNOWN_CLASS)) units.push({ classes: [UNKNOWN_CLASS], groups: null });
    units.forEach(unit => {
      const known = !unit.classes.includes(UNKNOWN_CLASS);
      const name = known ? passNameFor(input.passNames, key, unit.classes) : '';
      // Ett pass vars kolumn inte finns i veckans ark behåller rubriken det sparades med.
      const heading = pass ? sessionLabel(combined, day, pass, monday, name) : sess.label || key;
      const lines = [`${heading} · ${unit.classes.map(classLabel).join(', ')}`];
      if (pass && weekEntries && known) {
        lines.push(...scheduleLines(combined, day, pass, unit.classes, classNames, weekEntries, input.myName, input.resolveRoom));
      }
      const noted = unit.classes.flatMap(k => parts.get(k) ?? []);
      lines.push('', ...noteLines(noted, unit.groups, input.stamps));
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
