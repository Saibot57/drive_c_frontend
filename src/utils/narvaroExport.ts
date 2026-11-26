/**
 * Export av noteringarna i Närvarorutor: som text och HTML (ett stycke per
 * pass och klass, med datum, schemats titel och schemats anteckning) och som
 * rader för ett kalkylark (en rad per elev och pass).
 * Se docs/plans/narvaro-export.md och docs/plans/narvaro-excel.md.
 *
 * Exporten innehåller elevnamn i klartext. Den byggs i webbläsaren och
 * skickas ingenstans härifrån.
 */

import type { ScheduledEntry } from '@/types/schedule';
import type { XlsxCell } from '@/utils/xlsx';
import { timeToMinutes } from '@/utils/scheduleTime';
import {
  AttendancePerson,
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
  chunkHeading,
  sessionRows,
} from '@/utils/narvaro';
import { Sheets, isWeekKey, latestSheets, weekMonday, weekOfSession } from '@/utils/narvaroDocs';
import { ScheduleLineParts, entriesForChoice, entriesForClasses, isMine, scheduleLineParts, sortForDisplay } from '@/utils/narvaroSchedule';

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

type Unit = { classes: string[]; groups: string[][] | null; names?: string[] };

/**
 * Styckena för ett pass. Klasser som delats in i grupper tillsammans blir ett
 * stycke, så att grupperna hålls hela; övriga klasser får var sitt. Finns
 * flera indelningar väljs den som täcker flest av klasserna, sedan nästa
 * bland de klasser som är kvar.
 */
function unitsFor(key: string, classes: string[], groups: GroupsStore): Unit[] {
  const sets = Object.keys(groups)
    .filter(k => k.startsWith(`${key}#`) && groups[k]?.groups?.some(g => g.length > 0))
    .map(k => ({ classes: k.slice(key.length + 1).split('+'), groups: groups[k].groups, names: groups[k].names }));
  let left = [...classes];
  const units: Unit[] = [];
  for (;;) {
    const best = sets
      .map(s => ({ ...s, hit: s.classes.filter(c => left.includes(c)) }))
      .filter(s => s.hit.length > 0)
      .sort((a, b) => b.hit.length - a.hit.length || a.classes.length - b.classes.length)[0];
    if (!best) break;
    units.push({ classes: best.hit, groups: best.groups, names: best.names });
    left = left.filter(c => !best.hit.includes(c));
  }
  left.forEach(c => units.push({ classes: [c], groups: null }));
  // I klassernas ordning, efter styckets första klass.
  return units.sort((a, b) => classes.indexOf(a.classes[0]) - classes.indexOf(b.classes[0]));
}

/** Schemapassen för passet och klasserna: det egna passet om det finns, annars alla. */
function chosenEntries(
  table: AttendanceTable,
  day: string,
  pass: PassChoice,
  classes: string[],
  classNames: string[],
  weekEntries: ScheduledEntry[],
  myName: string,
): ScheduledEntry[] {
  const forClass = entriesForClasses(entriesForChoice(table, day, pass, weekEntries), classNames, classes);
  const mine = forClass.filter(e => isMine(e, myName));
  return sortForDisplay(mine.length ? mine : forClass, myName);
}

/** Schemaraderna i texten: titel, lärare och sal, och innehållet på en egen rad. */
const scheduleLines = (parts: ScheduleLineParts[]): string[] => parts.flatMap(p => {
  const lines = [`Schema: ${[p.title, p.teachers.join(', '), p.room].filter(Boolean).join(' · ')}`];
  if (p.notes) lines.push(`Innehåll: ${p.notes}`);
  return lines;
});

type ChosenPass = { parts: ScheduleLineParts; span: [number, number] | null };

const entrySpan = (e: ScheduledEntry): [number, number] | null => {
  const span: [number, number] = [timeToMinutes(e.startTime), timeToMinutes(e.endTime)];
  return Number.isFinite(span[0]) && Number.isFinite(span[1]) ? span : null;
};

/** Ett stycke i exporten: ett pass för en klass, eller för klasser som delats in i grupper tillsammans. */
type Block = {
  heading: string;
  /** Schemats rader och raden om ett äldre ark. */
  meta: string[];
  /** En lista per grupp, eller en enda. */
  chunks: SessionRow[][];
  /** Gruppernas namn, när passet har några (`chunkHeading`). */
  groupNames?: string[];
  // Det som kalkylarket behöver utöver texten.
  weekKey: string;
  /** Passets datum ur nyckeln, `ÅÅÅÅ-MM-DD`. */
  date: string;
  day: string;
  /** Arkets passtext, "Hela dagen", eller den sparade rubriken när kolumnen inte finns i arket. */
  passText: string;
  /** Arkets tid för kolumnen i minuter. Schemapassets tid går före i kalkylarket. */
  span: [number, number] | null;
  /**
   * De valda schemapassen per klass i stycket. Ett stycke med flera klasser
   * (grupper över klasserna) har ett pass per klass; varje rad i kalkylarket
   * får sin egen klass pass.
   */
  scheduleByClass: Map<string, ChosenPass[]>;
  key: string;
  /** Styckets personer ur arken, efter namnet som de står i passet. */
  people: Map<string, AttendancePerson>;
  /** Kryssade i arket för passet, och de som lagts till för hand. */
  marked: Set<string>;
  added: Set<string>;
  /** Klassens senaste ark, när det är en äldre veckas. */
  olderSheet: Map<string, string>;
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
      const chosen = pass && weekEntries && known
        ? chosenEntries(combined, day, pass, unit.classes, classNames, weekEntries, input.myName)
        : [];
      const meta = scheduleLines(chosen.map(e => scheduleLineParts(e, input.resolveRoom)));
      const scheduleByClass = new Map(unit.classes.map(k => [
        k,
        pass && weekEntries && known
          ? chosenEntries(combined, day, pass, [k], classNames, weekEntries, input.myName)
            .map(e => ({ parts: scheduleLineParts(e, input.resolveRoom), span: entrySpan(e) }))
          : [],
      ]));
      // Kryssen kommer ur klassens senaste ark. Är det en äldre veckas ska det synas.
      const olderSheet = new Map(unit.classes
        .map(k => [k, latest[k]?.week] as const)
        .filter((x): x is readonly [string, string] => !!x[1] && x[1] !== weekKey));
      const older = Array.from(new Set(olderSheet.values())).sort();
      if (pass && older.length) meta.push(`Närvaro enligt arket från v. ${older.map(weekNumber).join(', ')}`);
      const part: SessionNotes = { label: '', people: Object.fromEntries(unit.classes.flatMap(k => parts.get(k) ?? [])), added: sess.added };
      const people = { ...combined, people: combined.people.filter(p => unit.classes.includes(p.klass ?? '')) };
      const present = pass && known ? roster(people, { klass: 'all', day, pass, added: sess.added }).present.map(p => p.name) : [];
      const marked = pass && known ? roster(people, { klass: 'all', day, pass, added: [] }).present.map(p => p.name) : [];
      const col = pass && pass !== 'day' ? combined.cols.find(c => c.id === pass) : undefined;
      blocks.push({
        heading: `${heading} · ${unit.classes.map(classLabel).join(', ')}`,
        meta,
        chunks: sessionRows(part, present, unit.groups, input.stamps, unit.names),
        groupNames: unit.names,
        weekKey,
        date: key.slice(0, 10),
        day,
        passText: pass === 'day' ? 'Hela dagen' : col?.pass ?? (sess.label || ''),
        span: col?.time ?? null,
        scheduleByClass,
        key,
        people: new Map(people.people.map(p => [p.name, p])),
        marked: new Set(marked),
        added: new Set(sess.added),
        olderSheet,
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
    ...b.chunks.flatMap((c, i) => {
      const heading = chunkHeading(c, b.groupNames);
      return [...(i ? [''] : []), ...(heading ? [`  ${heading}:`] : []), ...c.map(r => `  ${rowText(r)}`)];
    }),
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
    ...b.chunks.map(c => {
      const heading = chunkHeading(c, b.groupNames);
      return `<p>${heading ? `<i>${esc(heading)}</i><br>` : ''}${c.map(row).join('<br>')}</p>`;
    }),
  ].join('');
  return [
    `<p><b>${esc(doc.title)}</b>${doc.head.map(l => `<br>${esc(l)}`).join('')}</p>`,
    ...doc.weeks.map(w => `<h1>${esc(w.title)}</h1>${w.blocks.map(block).join('')}`),
  ].join('');
}

/* ---------- kalkylarket ---------- */

/** Klassen i en schematitel: ordet efter "Tema" ("Tema Rosa" → Rosa). Andra titlar har ingen klass. */
export function titleClass(title: string): string {
  const words = title.trim().split(/\s+/);
  return words.length > 1 && words[0].toLocaleLowerCase('sv') === 'tema' ? words[1] : '';
}

/** Titeln utan klassen: "Tema Rosa" → Tema. */
const titleWithoutClass = (title: string) => {
  const words = title.trim().split(/\s+/).filter(Boolean);
  return titleClass(title) ? [words[0], ...words.slice(2)].join(' ') : words.join(' ');
};

/**
 * Ämnet för ett schemapass: texten före kolonet i innehållet ("Historia:
 * Historiebruk" → Historia). Kolonet räknas bara när det följs av blanksteg
 * eller slutet, och texten före är 1–30 tecken, så att en länk inte ger ämnet
 * "https". Annars titeln utan klassen.
 */
export function subjectOf(title: string, notes: string): string {
  const m = /^([^\n:]{1,30}):(\s|$)/.exec(notes.trim());
  const before = m?.[1].trim();
  return before || titleWithoutClass(title);
}

/**
 * Namnet utan klassen som `combineSheets` lägger till när två elever i olika
 * klasser heter likadant; klassen står i en egen kolumn. Ett löpnummer
 * ("Ali Hassan (Rosa 2)") får stå kvar, så att två med samma namn i samma
 * klass går att skilja åt.
 */
function plainName(name: string, person: AttendancePerson | undefined): string {
  if (!person) return name;
  const suffix = ` (${person.klass || 'utan klass'})`;
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

const joinUnique = (values: string[], sep: string) => Array.from(new Set(values.filter(Boolean))).join(sep);

export const EXPORT_COLUMNS = [
  'Vecka', 'Datum', 'Dag', 'Start', 'Slut', 'Pass i arket', 'Klass', 'Ämne', 'Schemapass', 'Lärare', 'Sal',
  'Innehåll', 'Passnamn', 'Elev', 'Skola', 'Närvarande', 'Grupp', 'Gruppnamn', 'Arkets vecka',
] as const;

export type ExportRows = { columns: string[]; rows: XlsxCell[][]; widths: (number | undefined)[] };

/**
 * Exporten som rader för ett kalkylark: en rad per elev och pass, för samma
 * pass och elever som texten. Stämplarna får en kolumn var (1 där stämpeln
 * finns), och noteringen står sist.
 */
export function exportRows(input: ExportInput): ExportRows {
  const stamps = [...input.stamps];
  const columns = [...EXPORT_COLUMNS, ...stamps.map(s => s.label), 'Notering'];
  const widths: (number | undefined)[] = columns.map(c => (c === 'Notering' ? 60 : c === 'Innehåll' ? 40 : undefined));
  const rows: XlsxCell[][] = [];
  const weeks = Array.from(new Set(input.weeks)).filter(isWeekKey).sort();
  weeks.forEach(week => weekBlocks(week, input).forEach(b => {
    b.chunks.flat().forEach(r => {
      const person = b.people.get(r.name);
      const klass = person ? person.klass ?? '' : UNKNOWN_CLASS;
      const chosen = b.scheduleByClass.get(klass) ?? [];
      const parts = chosen.map(x => x.parts);
      const span = chosen.find(x => x.span)?.span ?? b.span;
      const older = person ? b.olderSheet.get(klass) : undefined;
      const presence = b.marked.has(r.name) ? 'Kryssad' : b.added.has(r.name) ? 'Tillagd' : '';
      rows.push([
        Number(weekNumber(b.weekKey)),
        { date: b.date },
        b.day,
        span ? { time: span[0] } : null,
        span ? { time: span[1] } : null,
        b.passText,
        classLabel(klass),
        joinUnique(parts.map(p => subjectOf(p.title, p.notes)), ' / '),
        joinUnique(parts.map(p => p.title), ' / '),
        joinUnique(parts.flatMap(p => p.teachers), ', '),
        joinUnique(parts.map(p => p.room), ' / '),
        joinUnique(parts.map(p => p.notes), ' / '),
        person ? passNameFor(input.passNames, b.key, [klass]) : '',
        plainName(r.name, person),
        person?.group ?? '',
        presence,
        r.group,
        r.groupName ?? '',
        older ? Number(weekNumber(older)) : null,
        ...stamps.map(s => (r.tags.includes(s.id) ? 1 : null)),
        r.note.trim(),
      ]);
    });
  }));
  return { columns, rows, widths };
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

/** "noteringar-v47.txt" eller "noteringar-v45-v47.xlsx". */
export function exportFileName(weeks: readonly string[], extension: 'txt' | 'xlsx' = 'txt'): string {
  const sorted = Array.from(new Set(weeks)).filter(isWeekKey).sort();
  if (!sorted.length) return `noteringar.${extension}`;
  const first = `v${weekNumber(sorted[0])}`;
  const last = `v${weekNumber(sorted[sorted.length - 1])}`;
  return `noteringar-${first === last ? first : `${first}-${last}`}.${extension}`;
}
