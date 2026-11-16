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
  roster,
  sessionChoice,
  sessionLabel,
  SessionRow,
  sessionRows,
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
    .map(key => ({ key, ...sessionChoice(table, key) }))
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

/** Ett stycke i exporten: ett pass för en klass, eller för klasser som delats in i grupper tillsammans. */
type Block = {
  heading: string;
  /** Schemats rader och raden om ett äldre ark. */
  meta: string[];
  /** En lista per grupp, eller en enda. */
  chunks: SessionRow[][];
};

function weekBlocks(weekKey: string, input: ExportInput): Block[] {
  const monday = weekMonday(weekKey);
  if (!monday) return [];
  const latest = latestSheets(input.tables, weekKey);
  const sheets: Sheets = Object.fromEntries(Object.entries(latest).map(([k, ref]) => [k, ref.table]));
  const allClasses = Object.keys(sheets).sort((a, b) => a.localeCompare(b, 'sv'));
  const classNames = allClasses.filter(Boolean);
  const combined = combineSheets(sheets, allClasses);
  const weekEntries = input.schedules[weekKey] ?? null;
  const wanted = new Set(input.classes);

  const blocks: Block[] = [];
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
      const meta: string[] = [];
      if (pass && weekEntries && known) {
        meta.push(...scheduleLines(combined, day, pass, unit.classes, classNames, weekEntries, input.myName, input.resolveRoom));
      }
      // Kryssen kommer ur klassens senaste ark. Är det en äldre veckas ska det synas.
      const older = Array.from(new Set(unit.classes.map(k => latest[k]?.week).filter((w): w is string => !!w && w !== weekKey))).sort();
      if (pass && older.length) meta.push(`Närvaro enligt arket från v. ${older.map(weekNumber).join(', ')}`);
      const part: SessionNotes = { label: '', people: Object.fromEntries(unit.classes.flatMap(k => parts.get(k) ?? [])), added: sess.added };
      const people = { ...combined, people: combined.people.filter(p => unit.classes.includes(p.klass ?? '')) };
      const present = pass && known ? roster(people, { klass: 'all', day, pass, added: sess.added }).present.map(p => p.name) : [];
      blocks.push({
        heading: `${heading} · ${unit.classes.map(classLabel).join(', ')}`,
        meta,
        chunks: sessionRows(part, present, unit.groups, input.stamps),
      });
    });
  });
  return blocks;
}

type ExportDoc = { title: string; head: string[]; weeks: { title: string; blocks: Block[] }[] };

/** Exportens innehåll, eller null när inget finns. Veckor utan noteringar för de valda klasserna hoppas över. */
function exportDoc(input: ExportInput): ExportDoc | null {
  const weeks = Array.from(new Set(input.weeks)).filter(isWeekKey).sort()
    .map(week => ({ title: weekTitle(week), blocks: weekBlocks(week, input) }))
    .filter(s => s.blocks.length > 0);
  if (!weeks.length) return null;
  const classes = [...input.classes].sort((a, b) => a.localeCompare(b, 'sv')).map(classLabel).join(', ');
  return {
    title: 'Noteringar från Närvarorutor',
    head: [classes && `Klasser: ${classes}`, `Exporterad ${isoDay(input.today)}`].filter(Boolean),
    weeks,
  };
}

const rowText = (r: SessionRow) => (r.text ? `${r.name}: ${r.text}` : r.name);

/** Hela exporten som ren text. Tom när inget finns att exportera. */
export function exportText(input: ExportInput): string {
  const doc = exportDoc(input);
  if (!doc) return '';
  const block = (b: Block) => [
    b.heading,
    ...b.meta,
    '',
    ...b.chunks.flatMap((c, i) => [...(i ? [''] : []), ...c.map(r => `  ${rowText(r)}`)]),
  ].join('\n');
  return [
    [doc.title, ...doc.head].join('\n'),
    ...doc.weeks.map(w => [`== ${w.title} ==`, ...w.blocks.map(block)].join('\n\n')),
  ].join('\n\n\n') + '\n';
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Samma export som HTML, för urklippet: Google Docs gör veckan till rubrik 1
 * och passet till rubrik 2, så att dokumentet får en disposition. Schemats
 * rader är kursiva, namnen i fetstil, och varje grupp är ett eget stycke.
 * Bara taggar som Docs behåller; inga färger eller typsnitt.
 */
export function exportHtml(input: ExportInput): string {
  const doc = exportDoc(input);
  if (!doc) return '';
  const row = (r: SessionRow) => `<b>${esc(r.name)}</b>${r.text ? `: ${esc(r.text)}` : ''}`;
  const block = (b: Block) => [
    `<h2>${esc(b.heading)}</h2>`,
    b.meta.length ? `<p><i>${b.meta.map(esc).join('<br>')}</i></p>` : '',
    ...b.chunks.map(c => `<p>${c.map(row).join('<br>')}</p>`),
  ].join('');
  return [
    `<p><b>${esc(doc.title)}</b>${doc.head.map(l => `<br>${esc(l)}`).join('')}</p>`,
    ...doc.weeks.map(w => `<h1>${esc(w.title)}</h1>${w.blocks.map(block).join('')}`),
  ].join('');
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
