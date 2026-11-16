/**
 * Närvarorutor och schemat: vilka schemapass en närvarokolumn motsvarar.
 * Kopplingen räknas fram varje gång och sparas aldrig. Passen paras ihop på
 * veckodag och överlappande tid, eftersom arkets tider inte alltid är
 * schemats (8.30-9.45 mot 08:30–10:00). Se docs/plans/narvaro-schemakoppling.md.
 *
 * Allt här är rent. Inget om elever går härifrån till schemat.
 */

import type { PlannerArchiveSummary, ScheduledEntry } from '@/types/schedule';
import {
  AttendanceColumn,
  AttendanceTable,
  NotesStore,
  PassChoice,
  SessionNotes,
  classesOnDay,
  combineSheets,
  dayColumns,
  defaultPass,
  noteEntries,
  sessionKey,
  weekdayName,
} from '@/utils/narvaro';
import { Sheets, isWeekKey, isoWeekKey, latestSheets, weekMonday } from '@/utils/narvaroDocs';
import { compareLaneEntries } from '@/utils/scheduleLayout';
import { isAllTeachersField, splitTeacherNames } from '@/utils/scheduleStats';
import { timeToMinutes } from '@/utils/scheduleTime';
import { suggestArchiveForWeek } from '@/utils/termPlanner';

type Span = [number, number];

const lower = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv');
const words = (s: string) => s.toLocaleLowerCase('sv').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

const entrySpan = (entry: ScheduledEntry): Span | null => {
  const start = timeToMinutes(entry.startTime);
  const end = timeToMinutes(entry.endTime);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? [start, end] : null;
};

const overlap = (a: Span, b: Span) => Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));

/** Passen som täcker minst halva spannet. Halva spannets längd, inte passets. */
const coveringHalf = (span: Span, entries: ScheduledEntry[]) => {
  const length = span[1] - span[0];
  if (length <= 0) return [];
  return entries
    .filter(e => {
      const s = entrySpan(e);
      return !!s && overlap(span, s) * 2 >= length;
    })
    .sort(compareLaneEntries);
};

/* ---------- schemat för en vecka ---------- */

/** Veckoschemat för en närvarovecka (`w2026-47`), eller null. */
export function archiveForWeek(weekKey: string, archives: PlannerArchiveSummary[]): string | null {
  if (!isWeekKey(weekKey)) return null;
  return suggestArchiveForWeek(Number(weekKey.slice(-2)), archives)?.archiveId ?? null;
}

/* ---------- passen för en kolumn ---------- */

/**
 * Kolumnens tid. En kolumn utan tid får tiden från schemapasset med samma
 * namn: dagens n:te kolumn med namnet får den n:te starttiden bland passen
 * med namnet.
 */
export function columnSpan(col: AttendanceColumn, dayCols: AttendanceColumn[], dayEntries: ScheduledEntry[]): Span | null {
  if (col.time) return col.time;
  const name = lower(col.pass);
  const n = dayCols.filter(c => !c.time && lower(c.pass) === name).findIndex(c => c.id === col.id);
  if (n < 0) return null;
  const hits = dayEntries
    .filter(e => e.day === col.day && lower(e.title) === name)
    .map(entrySpan)
    .filter((s): s is Span => !!s);
  const starts = Array.from(new Set(hits.map(s => s[0]))).sort((a, b) => a - b);
  const start = starts[n];
  if (start === undefined) return null;
  return [start, Math.max(...hits.filter(s => s[0] === start).map(s => s[1]))];
}

/** Schemapassen som hör till kolumnen, i schemats ordning. */
export function entriesForColumn(col: AttendanceColumn, dayCols: AttendanceColumn[], dayEntries: ScheduledEntry[]): ScheduledEntry[] {
  const span = columnSpan(col, dayCols, dayEntries);
  return span ? coveringHalf(span, dayEntries.filter(e => e.day === col.day)) : [];
}

/** Pass som täcker minst halva dagen: från första till sista kolumnen med tid. */
export function entriesForDay(dayCols: AttendanceColumn[], dayEntries: ScheduledEntry[]): ScheduledEntry[] {
  const timed = dayCols.filter(c => c.time);
  if (!timed.length) return [];
  const span: Span = [Math.min(...timed.map(c => c.time![0])), Math.max(...timed.map(c => c.time![1]))];
  const day = timed[0].day;
  return coveringHalf(span, dayEntries.filter(e => e.day === day));
}

/** Schemapassen för det valda passet på sidan (en kolumn eller hela dagen). */
export function entriesForChoice(table: AttendanceTable, day: string, pass: PassChoice, weekEntries: ScheduledEntry[]): ScheduledEntry[] {
  const dayCols = dayColumns(table, day);
  const dayEntries = weekEntries.filter(e => e.day === day);
  if (pass === 'day') return entriesForDay(dayCols, dayEntries);
  const col = dayCols.find(c => c.id === pass);
  return col ? entriesForColumn(col, dayCols, dayEntries) : [];
}

/* ---------- klass och ägare ---------- */

/** Klasserna vars namn står som ett helt ord (eller hela ord i följd) i titeln. */
export function entryClasses(title: string, classNames: string[]): string[] {
  const titleWords = words(title);
  return classNames.filter(klass => {
    const k = words(klass);
    if (!k.length) return false;
    for (let i = 0; i + k.length <= titleWords.length; i++) {
      if (k.every((w, j) => titleWords[i + j] === w)) return true;
    }
    return false;
  });
}

/**
 * Är passen uppdelade på klass? Bara när varje pass namnger en klass, så att
 * "Engelska Grund" bredvid "Engelska 1" inte tas för klassen Grunds pass.
 */
export function isClassDivided(entries: ScheduledEntry[], classNames: string[]): boolean {
  return entries.length > 0 && entries.every(e => entryClasses(e.title, classNames).length > 0);
}

/** De valda klassernas pass när passen är uppdelade på klass, annars alla. */
export function entriesForClasses(entries: ScheduledEntry[], classNames: string[], selected: string[]): ScheduledEntry[] {
  if (!isClassDivided(entries, classNames)) return entries;
  return entries.filter(e => entryClasses(e.title, classNames).some(k => selected.includes(k)));
}

const namedIn = (entry: ScheduledEntry, name: string) =>
  splitTeacherNames(entry.teacher).some(n => n.toLocaleLowerCase('sv') === name);

/** Står användaren i lärarfältet, eller står det "Alla"? Ett tomt namn är aldrig någons. */
export function isMine(entry: ScheduledEntry, myName: string): boolean {
  const name = myName.trim().toLocaleLowerCase('sv');
  if (!name) return false;
  return namedIn(entry, name) || isAllTeachersField(entry.teacher);
}

/** Egna pass först, sedan i schemats ordning. */
export function sortForDisplay(entries: ScheduledEntry[], myName: string): ScheduledEntry[] {
  return [...entries].sort((a, b) => Number(isMine(b, myName)) - Number(isMine(a, myName)) || compareLaneEntries(a, b));
}

/* ---------- från pass till kolumn ---------- */

export type ScheduleTarget = { day: string; pass: PassChoice; classes: string[] };

/**
 * Kolumnen på sidan som ett schemapass motsvarar, för klick i veckovyn.
 * `sheets` är veckans ark per klass och `classNames` alla klasser.
 * Null när passet inte motsvarar någon kolumn (Lunch, Paus, APT).
 */
export function targetForEntry(
  entry: ScheduledEntry,
  sheets: Record<string, AttendanceTable>,
  classNames: string[],
  weekEntries: ScheduledEntry[],
): ScheduleTarget | null {
  const table = combineSheets(sheets, classNames);
  const dayCols = dayColumns(table, entry.day);
  const dayEntries = weekEntries.filter(e => e.day === entry.day);
  const span = entrySpan(entry);
  if (!span) return null;
  const classesFor = (shown: ScheduledEntry[]) => (isClassDivided(shown, classNames)
    ? entryClasses(entry.title, classNames)
    : classesOnDay(sheets, classNames, entry.day));

  const hits = dayCols
    .map(col => ({ col, shown: entriesForColumn(col, dayCols, dayEntries) }))
    .filter(h => h.shown.some(e => e.instanceId === entry.instanceId));
  const wholeDay = entriesForDay(dayCols, dayEntries);
  const inDay = wholeDay.some(e => e.instanceId === entry.instanceId);
  // Ett pass som fyller flera kolumner och hela dagen (ett studiebesök) är hela dagen.
  if (hits.length === 1 || (hits.length > 1 && !inDay)) {
    const best = hits.reduce((a, b) => {
      const sa = columnSpan(a.col, dayCols, dayEntries)!;
      const sb = columnSpan(b.col, dayCols, dayEntries)!;
      return overlap(sb, span) > overlap(sa, span) ? b : a;
    });
    return { day: entry.day, pass: best.col.id, classes: classesFor(best.shown) };
  }
  if (inDay) return { day: entry.day, pass: 'day', classes: classesFor(wholeDay) };
  return null;
}

/* ---------- texten ---------- */

/** Tom, eller bara skiljetecken och blanksteg ("."). */
export function isPlaceholderNote(notes: string | undefined | null): boolean {
  return !notes || /^[\p{P}\p{S}\s]*$/u.test(notes);
}

export type ScheduleLineParts = { title: string; teachers: string[]; room: string; notes: string };

/** Delarna i raden "Enligt schemat". Salen går genom salsreglerna. */
export function scheduleLineParts(
  entry: ScheduledEntry,
  resolveRoom: (title: string, room?: string) => string = (_t, room) => room ?? '',
): ScheduleLineParts {
  return {
    title: entry.title.trim(),
    teachers: splitTeacherNames(entry.teacher),
    room: (resolveRoom(entry.title, entry.room) ?? '').trim(),
    notes: isPlaceholderNote(entry.notes) ? '' : (entry.notes ?? '').trim(),
  };
}

/* ---------- noteringar för ett pass ---------- */

/**
 * Klasserna som har noteringar i passet: de vars ark har något av namnen.
 * Namnen jämförs både som `combineSheets` skriver dem ("Namn (Oliv)" när
 * namnet finns i flera ark) och som de står i arket.
 */
export function sessionClasses(sess: SessionNotes, sheets: Record<string, AttendanceTable>): string[] {
  const names = new Set([...Object.keys(sess.people), ...sess.added]);
  if (!names.size) return [];
  return Object.keys(sheets).filter(klass => {
    const combined = combineSheets(sheets, [klass]).people;
    return combined.some(p => names.has(p.name)) || sheets[klass].people.some(p => names.has(p.name));
  });
}

/* ---------- förvald klass ---------- */

/**
 * Klasserna där användaren själv står på passet som pågår, när passen är
 * uppdelade på klass. "Alla" räknas inte. Tom lista när inget pass pågår.
 * `table` är alla klassers ark ihop.
 */
export function myClassesNow(
  table: AttendanceTable,
  weekEntries: ScheduledEntry[],
  classNames: string[],
  myName: string,
  now: Date,
): string[] {
  const name = myName.trim().toLocaleLowerCase('sv');
  if (!name) return [];
  const day = weekdayName(now);
  const pass = defaultPass(table, day, now);
  const dayCols = dayColumns(table, day);
  const col = dayCols.find(c => c.id === pass);
  const minutes = now.getHours() * 60 + now.getMinutes();
  // defaultPass faller tillbaka på dagens sista pass; här gäller bara ett som pågår.
  if (!col?.time || minutes < col.time[0] - 10 || minutes > col.time[1]) return [];
  const shown = entriesForColumn(col, dayCols, weekEntries.filter(e => e.day === day));
  if (!isClassDivided(shown, classNames)) return [];
  const mine = shown.filter(e => namedIn(e, name));
  return classNames.filter(k => mine.some(e => entryClasses(e.title, classNames).includes(k)));
}

/* ---------- namnet i schemat ---------- */

export const MAX_SCHEDULE_NAME_LENGTH = 60;

/** Namnet i schemats lärarfält, som det sparas per enhet. */
export const sanitizeScheduleName = (raw: unknown): string =>
  typeof raw === 'string' ? raw.trim().slice(0, MAX_SCHEDULE_NAME_LENGTH).trim() : '';

/**
 * Det namn som gäller: det sparade, annars användarnamnet när det står bland
 * veckans lärarnamn (utan hänsyn till versaler), annars inget.
 */
export function effectiveScheduleName(saved: string, username: string | null | undefined, teacherNames: string[]): string {
  if (saved) return saved;
  const user = (username ?? '').trim().toLocaleLowerCase('sv');
  if (!user) return '';
  return teacherNames.find(n => n.trim().toLocaleLowerCase('sv') === user) ?? '';
}

/* ---------- veckor och noteringar per pass ---------- */

/** Veckan `delta` veckor från `weekKey`. */
export function shiftWeek(weekKey: string, delta: number): string {
  const monday = weekMonday(weekKey);
  if (!monday) return weekKey;
  return isoWeekKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + delta * 7));
}

/** Varje klass ark som det gällde veckan (det senaste fram till den). */
export function sheetsForWeek(tables: Record<string, Sheets>, weekKey: string): Sheets {
  return Object.fromEntries(Object.entries(latestSheets(tables, weekKey)).map(([k, ref]) => [k, ref.table]));
}

export type EntrySession = {
  target: ScheduleTarget;
  /** Passets nyckel (`sessionKey`) i veckan. */
  key: string;
  /** Noteringarna, när de finns och hör till passets klasser. */
  sess: SessionNotes | null;
};

/**
 * Kolumnen och noteringarna för ett schemapass i en vecka. Noteringarna
 * räknas bara när någon av klasserna med noteringar har passet, så att Olivs
 * notering inte ger Tema Rosa en prick. Null när passet saknar kolumn.
 */
export function sessionForEntry(
  entry: ScheduledEntry,
  sheets: Sheets,
  weekEntries: ScheduledEntry[],
  weekKey: string,
  notes: NotesStore,
): EntrySession | null {
  const monday = weekMonday(weekKey);
  if (!monday) return null;
  const classNames = Object.keys(sheets).filter(Boolean);
  const target = targetForEntry(entry, sheets, classNames, weekEntries);
  if (!target) return null;
  const key = sessionKey(combineSheets(sheets, Object.keys(sheets)), target.day, target.pass, monday);
  const stored = notes[key];
  const has = !!stored && noteEntries(stored).length > 0
    && sessionClasses(stored, sheets).some(k => target.classes.includes(k));
  return { target, key, sess: has ? stored : null };
}

/**
 * Schemapassen för ett sparat pass (Tidigare pass). Kolumnen fås ur nyckelns
 * tredje del (`letter`, eller `dag`), och urvalet ur klasserna med noteringar.
 */
export function entriesForSession(
  key: string,
  sess: SessionNotes,
  sheets: Sheets,
  weekEntries: ScheduledEntry[],
): ScheduledEntry[] {
  const [, day, which] = key.split('|');
  if (!day || !which) return [];
  const table = combineSheets(sheets, Object.keys(sheets));
  const pass: PassChoice | null = which === 'dag' ? 'day' : table.cols.find(c => c.day === day && c.letter === which)?.id ?? null;
  if (!pass) return [];
  const classNames = Object.keys(sheets).filter(Boolean);
  return entriesForClasses(entriesForChoice(table, day, pass, weekEntries), classNames, sessionClasses(sess, sheets));
}
