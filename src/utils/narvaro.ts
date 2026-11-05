/**
 * Närvarorutor: läser närvaroarket som klistrats in från Google Kalkylark och
 * håller logiken för anteckningar och gruppindelning. Allt här är rent, så att
 * det går att testa. Sidan finns i `components/narvaro/`.
 *
 * Arket har namnen i kolumn A, veckodagarna i en rad med sammanslagna celler,
 * passen i raden under och en kryssruta per deltagare och pass. En rad med
 * bara ett namn och inga andra värden är en rubrik för skolan (till exempel
 * TORA VEGA eller ÖSTRA GREVIE), och deltagarna under den hör dit.
 */

import { PLANNER_DAYS } from '@/config/plannerConstants';

export type AttendanceColumn = {
  /** Kolumnens index i arket (A = 0). */
  index: number;
  id: string;
  /** Kolumnbokstaven, eller tom om arket är bredare än A–Z. */
  letter: string;
  day: string;
  pass: string;
  /** Passets start och slut i minuter efter midnatt, om passnamnet har en tid. */
  time: [number, number] | null;
};

export type AttendancePerson = {
  name: string;
  /** Skolans rubrik ovanför personen, eller tom. */
  group: string;
  /** Ett värde per kolumn: kryssad, okryssad eller ingen kryssruta. */
  marks: (boolean | null)[];
};

export type AttendanceTable = {
  people: AttendancePerson[];
  cols: AttendanceColumn[];
  groups: string[];
  days: string[];
};

export type StampColor = 'green' | 'yellow' | 'blue' | 'pink' | 'lilac' | 'grey';
export const STAMP_COLORS: readonly StampColor[] = ['green', 'yellow', 'blue', 'pink', 'lilac', 'grey'];

export type Stamp = { id: string; label: string; color: StampColor; custom?: boolean };

export const DEFAULT_STAMPS: readonly Stamp[] = [
  { id: 'aktiv', label: 'Aktiv', color: 'green' },
  { id: 'star', label: 'Utmärkte sig', color: 'yellow' },
  { id: 'tyst', label: 'Tyst idag', color: 'blue' },
  { id: 'stod', label: 'Behöver stöd', color: 'pink' },
];
/** Egna stämplar får de här färgerna i tur och ordning. */
export const CUSTOM_STAMP_COLORS: readonly StampColor[] = ['lilac', 'grey'];

export type PersonNote = { tags: string[]; note: string };
export type SessionNotes = { label: string; people: Record<string, PersonNote>; added: string[] };
export type NotesStore = Record<string, SessionNotes>;
export type GroupsStore = Record<string, { groups: string[][] }>;

/** `'day'` betyder hela dagen, annars en kolumns id. */
export type PassChoice = 'day' | string;

/** Så många pass sparas grupper och anteckningar för innan de äldsta rensas. */
export const MAX_STORED_GROUP_SESSIONS = 40;

const TRUE_RE = /^(true|sant|x|1|✓|✔|☑|ja)$/i;
const BOOL_RE = /^(true|false|sant|falskt|x|1|0|✓|✔|☑|☐|ja|nej)$/i;
const DAY_NAMES = PLANNER_DAYS.map(d => d.toLowerCase());
const WEEKDAYS_SUNDAY_FIRST = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/* ---------- inläsning ---------- */

/**
 * Tabbseparerad text som Google Kalkylark lägger i urklippet. En cell med
 * radbrytning eller citattecken står inom citattecken, med "" för ett ".
 */
export function gridFromText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === '\t') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

/**
 * HTML-tabellen i urklippet. Kryssrutor står som `data-sheets-value` med typ 4
 * (sant/falskt). Sammanslagna celler fylls ut: `colspan` åt höger, och
 * `rowspan` håller platsen i raderna nedanför så att kolumnerna inte förskjuts.
 */
export function gridFromHtml(html: string): string[][] | null {
  if (typeof DOMParser === 'undefined') return null;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return null;
    const grid: (string | undefined)[][] = [];
    table.querySelectorAll('tr').forEach((tr, ri) => {
      const row = (grid[ri] = grid[ri] ?? []);
      let c = 0;
      tr.querySelectorAll('td,th').forEach(td => {
        while (row[c] !== undefined) c++;
        let value = (td.textContent ?? '').trim();
        const raw = td.getAttribute('data-sheets-value');
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            if (parsed['1'] === 4) {
              const v = parsed['4'];
              value = v === true || v === 1 || v === '1' || v === 'TRUE' ? 'TRUE' : 'FALSE';
            }
          } catch { /* ett trasigt attribut får cellens text gälla */ }
        }
        const colspan = parseInt(td.getAttribute('colspan') ?? '1', 10) || 1;
        const rowspan = parseInt(td.getAttribute('rowspan') ?? '1', 10) || 1;
        for (let k = 0; k < colspan; k++) {
          row[c + k] = k === 0 ? value : '';
          for (let r = 1; r < rowspan; r++) (grid[ri + r] = grid[ri + r] ?? [])[c + k] = '';
        }
        c += colspan;
      });
    });
    return grid.map(r => Array.from(r, v => v ?? ''));
  } catch {
    return null;
  }
}

/** "8.30-9.45" eller "8:30–9:45" som minuter. */
export function passTime(pass: string): [number, number] | null {
  const m = pass.match(/(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})/);
  return m ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] : null;
}

/** Läser arkets celler. Ger null om inga kryssrutor hittas. */
export function parseAttendance(grid: string[][] | null): AttendanceTable | null {
  if (!grid) return null;
  const rows = grid.map(r => r.map(c => (c ?? '').trim())).filter(r => r.some(Boolean));
  if (!rows.length) return null;
  const width = Math.max(...rows.map(r => r.length));
  const dayRow = rows.findIndex(r => r.slice(1).some(c => DAY_NAMES.includes(c.toLowerCase())));

  const people: AttendancePerson[] = [];
  let group = '';
  let firstPerson = -1;
  rows.forEach((r, i) => {
    if (i === dayRow) return;
    const name = r[0] ?? '';
    const rest = r.slice(1);
    if (name && rest.some(c => BOOL_RE.test(c))) {
      if (firstPerson < 0) firstPerson = i;
      const marks: (boolean | null)[] = [];
      for (let c = 0; c < width; c++) {
        const v = r[c] ?? '';
        marks.push(c === 0 || !BOOL_RE.test(v) ? null : TRUE_RE.test(v));
      }
      people.push({ name, group, marks });
    } else if (name && !rest.some(Boolean)) {
      group = name;
    }
  });
  if (!people.length) return null;

  // Passraden är den sista rubrikraden (utan kryssrutor) före första deltagaren.
  let passRow = -1;
  for (let i = 0; i < firstPerson; i++) {
    if (i !== dayRow && rows[i].slice(1).some(Boolean) && !rows[i].slice(1).some(c => BOOL_RE.test(c))) passRow = i;
  }

  const cols: AttendanceColumn[] = [];
  let day = '';
  for (let c = 1; c < width; c++) {
    if (dayRow >= 0 && rows[dayRow][c]) day = capitalize(rows[dayRow][c]);
    if (!people.some(p => p.marks[c] !== null)) continue;
    const letter = width <= 26 ? String.fromCharCode(65 + c) : '';
    const pass = passRow >= 0 ? rows[passRow][c] ?? '' : '';
    // Har arket en passrad hör en kolumn utan passnamn inte till tabellen,
    // till exempel lösa kryssrutor till höger om den.
    if (passRow >= 0 && !pass) continue;
    cols.push({
      index: c,
      id: `c${c}`,
      letter,
      day: day || 'Alla pass',
      pass: pass || `Kolumn ${letter || c + 1}`,
      time: passTime(pass),
    });
  }
  if (!cols.length) return null;
  return {
    people,
    cols,
    groups: Array.from(new Set(people.map(p => p.group).filter(Boolean))),
    days: Array.from(new Set(cols.map(c => c.day))),
  };
}

/** Urklippets HTML först, eftersom den har sammanslagningarna. Sedan texten. */
export function parsePasted(text: string, html: string): AttendanceTable | null {
  return (html ? parseAttendance(gridFromHtml(html)) : null) ?? parseAttendance(gridFromText(text));
}

/** De första raderna av det som klistrades in, för att kunna se vad som gick fel. */
export function pastePreview(text: string, html: string, maxRows = 8): string {
  const grid = (html ? gridFromHtml(html) : null) ?? gridFromText(text);
  const raw = grid.slice(0, maxRows).map(r => r.join(' | ')).join('\n');
  return raw.trim() ? `${html ? '[html]' : '[text]'}\n${raw}` : '';
}

/* ---------- datum och urval ---------- */

export const weekdayName = (date: Date) => capitalize(WEEKDAYS_SUNDAY_FIRST[date.getDay()]);

export function isoWeek(date: Date): number {
  const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - jan1.getTime()) / 864e5 + 1) / 7);
}

/** Datumet för veckodagen i samma vecka som `now`. */
export function dateForDay(day: string, now: Date): Date {
  const idx = WEEKDAYS_SUNDAY_FIRST.indexOf(day.toLowerCase());
  const d = new Date(now);
  if (idx < 0) return d;
  d.setDate(now.getDate() + ((idx || 7) - (now.getDay() || 7)));
  return d;
}

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const dayColumns = (table: AttendanceTable, day: string) => table.cols.filter(c => c.day === day);

/**
 * Passet som pågår (från tio minuter före start), annars dagens sista pass
 * där någon är kryssad, annars hela dagen.
 */
export function defaultPass(table: AttendanceTable, day: string, now: Date): PassChoice {
  const cols = dayColumns(table, day);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (day === weekdayName(now)) {
    const running = cols.find(c => c.time && minutes >= c.time[0] - 10 && minutes <= c.time[1]);
    if (running) return running.id;
  }
  for (let i = cols.length - 1; i >= 0; i--) {
    if (table.people.some(p => p.marks[cols[i].index] === true)) return cols[i].id;
  }
  return 'day';
}

export function defaultDay(table: AttendanceTable, now: Date): string {
  const today = weekdayName(now);
  return table.days.includes(today) ? today : table.days[0];
}

/** Nyckeln som anteckningar och grupper sparas under: datum, dag och pass. */
export function sessionKey(table: AttendanceTable, day: string, pass: PassChoice, now: Date): string {
  const col = table.cols.find(c => c.id === pass);
  const which = pass === 'day' ? 'dag' : col?.letter || pass;
  return `${isoDate(dateForDay(day, now))}|${day}|${which}|${col?.pass ?? ''}`;
}

export function sessionLabel(table: AttendanceTable, day: string, pass: PassChoice, now: Date): string {
  const d = dateForDay(day, now);
  const col = table.cols.find(c => c.id === pass);
  return `${day} ${d.getDate()}/${d.getMonth() + 1} · ${pass === 'day' || !col ? 'hela dagen' : col.pass}`;
}

export type Roster = { present: AttendancePerson[]; absent: AttendancePerson[] };

/** Kryssade i passet (eller något pass under dagen), plus de som lagts till för hand. */
export function roster(
  table: AttendanceTable,
  sel: { klass: string; day: string; pass: PassChoice; added: readonly string[] },
): Roster {
  const cols = dayColumns(table, sel.day).filter(c => sel.pass === 'day' || c.id === sel.pass);
  const added = new Set(sel.added);
  const present: AttendancePerson[] = [];
  const absent: AttendancePerson[] = [];
  table.people
    .filter(p => sel.klass === 'all' || p.group === sel.klass)
    .forEach(p => (cols.some(c => p.marks[c.index] === true) || added.has(p.name) ? present : absent).push(p));
  return { present, absent };
}

/* ---------- anteckningar ---------- */

export const emptySession = (label: string): SessionNotes => ({ label, people: {}, added: [] });

const hasContent = (n: PersonNote) => n.tags.length > 0 || n.note.length > 0;

/** Sätter stämpeln om personen saknar den, annars tas den bort. */
export function toggleStamp(sess: SessionNotes, name: string, stampId: string): SessionNotes {
  const cur = sess.people[name] ?? { tags: [], note: '' };
  const tags = cur.tags.includes(stampId) ? cur.tags.filter(t => t !== stampId) : [...cur.tags, stampId];
  return setPersonNote(sess, name, { ...cur, tags });
}

/** En person utan stämplar och notering tas bort ur passet. */
export function setPersonNote(sess: SessionNotes, name: string, note: PersonNote): SessionNotes {
  const people = { ...sess.people };
  if (hasContent(note)) people[name] = note;
  else delete people[name];
  return { ...sess, people };
}

export function noteEntries(sess: SessionNotes): [string, PersonNote][] {
  return Object.entries(sess.people).filter(([, n]) => hasContent(n));
}

/** Passets noteringar som text, grupperade per klass när det finns flera. */
export function sessionText(sess: SessionNotes, table: AttendanceTable, stamps: readonly Stamp[]): string {
  const lines = [sess.label];
  const byGroup = new Map<string, [string, PersonNote][]>();
  noteEntries(sess).forEach(([name, n]) => {
    const g = table.people.find(p => p.name === name)?.group ?? '';
    byGroup.set(g, [...(byGroup.get(g) ?? []), [name, n]]);
  });
  const multi = byGroup.size > 1;
  byGroup.forEach((entries, g) => {
    if (multi && g) lines.push('', g);
    entries.forEach(([name, n]) => {
      const labels = n.tags.map(id => stamps.find(s => s.id === id)?.label).filter(Boolean).join(', ');
      lines.push(`${name}: ${[labels, n.note].filter(Boolean).join('. ')}`);
    });
  });
  return lines.join('\n');
}

/** Tidigare pass med noteringar, senaste först. */
export function historyKeys(notes: NotesStore, currentKey: string, max = 15): string[] {
  return Object.keys(notes)
    .filter(k => k !== currentKey && noteEntries(notes[k]).length > 0)
    .sort()
    .reverse()
    .slice(0, max);
}

/* ---------- grupper ---------- */

export type GroupBy = 'count' | 'size';

/** Antal grupper: angivet antal, eller så många att varje grupp får cirka `n` personer. */
export function groupCount(by: GroupBy, n: number, people: number): number {
  return by === 'count' ? Math.max(1, Math.min(n, people || 1)) : Math.max(1, Math.round(people / n));
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Slumpar `names` i `count` grupper. De i `spread` delas ut först, så att de
 * hamnar jämnt fördelade över grupperna.
 */
export function randomGroups(
  names: readonly string[],
  count: number,
  spread: ReadonlySet<string> = new Set(),
  random: () => number = Math.random,
): string[][] {
  const mixed = shuffle(names, random);
  const ordered = [...mixed.filter(n => spread.has(n)), ...mixed.filter(n => !spread.has(n))];
  const groups: string[][] = Array.from({ length: Math.max(1, count) }, () => []);
  ordered.forEach((name, i) => groups[i % groups.length].push(name));
  return groups;
}

/**
 * Grupperna som de ska visas: bara de som är närvarande och inte uteslutna,
 * och alla närvarande utan grupp i `pool`.
 */
export function groupView(stored: string[][], active: readonly string[]): { groups: string[][]; pool: string[] } {
  const on = new Set(active);
  const groups = stored.map(g => g.filter(n => on.has(n)));
  const placed = new Set(groups.flat());
  return { groups, pool: active.filter(n => !placed.has(n)) };
}

/** Flyttar ett namn till gruppen `target`, eller ut ur alla grupper med `'pool'`. */
export function moveToGroup(groups: string[][], name: string, target: number | 'pool'): string[][] {
  const next = groups.map(g => g.filter(n => n !== name));
  if (target !== 'pool' && next[target]) next[target].push(name);
  return next;
}

export function groupsText(label: string, view: { groups: string[][]; pool: string[] }): string {
  const lines = view.groups.map((g, i) => `Grupp ${i + 1}: ${g.join(', ') || '(tom)'}`);
  if (view.pool.length) lines.push('', `Inte indelade: ${view.pool.join(', ')}`);
  return `${label}\n\n${lines.join('\n')}`;
}

/** Behåller de `max` senaste passen. Nycklarna börjar med datum, så de sorteras rätt. */
export function trimSessions<T>(store: Record<string, T>, max: number): Record<string, T> {
  const keys = Object.keys(store).sort();
  if (keys.length <= max) return store;
  const keep = new Set(keys.slice(keys.length - max));
  return Object.fromEntries(Object.entries(store).filter(([k]) => keep.has(k)));
}

/* ---------- lagring ---------- */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function sanitizeTable(raw: unknown): AttendanceTable | null {
  if (!isRecord(raw) || !Array.isArray(raw.people) || !Array.isArray(raw.cols)) return null;
  const people = raw.people.filter(isRecord).map(p => ({
    name: str(p.name),
    group: str(p.group),
    marks: Array.isArray(p.marks) ? p.marks.map(m => (typeof m === 'boolean' ? m : null)) : [],
  })).filter(p => p.name);
  const cols = raw.cols.filter(isRecord).flatMap(c => {
    if (typeof c.index !== 'number') return [];
    const time = Array.isArray(c.time) && c.time.length === 2 && c.time.every(t => typeof t === 'number')
      ? (c.time as [number, number]) : null;
    return [{ index: c.index, id: str(c.id) || `c${c.index}`, letter: str(c.letter), day: str(c.day), pass: str(c.pass), time }];
  });
  if (!people.length || !cols.length) return null;
  return {
    people,
    cols,
    groups: Array.from(new Set(people.map(p => p.group).filter(Boolean))),
    days: Array.from(new Set(cols.map(c => c.day))),
  };
}

export function sanitizeNotes(raw: unknown): NotesStore {
  if (!isRecord(raw)) return {};
  const out: NotesStore = {};
  Object.entries(raw).forEach(([key, s]) => {
    if (!isRecord(s)) return;
    const people: Record<string, PersonNote> = {};
    if (isRecord(s.people)) {
      Object.entries(s.people).forEach(([name, n]) => {
        if (isRecord(n)) people[name] = { tags: strings(n.tags), note: str(n.note) };
      });
    }
    out[key] = { label: str(s.label), people, added: strings(s.added) };
  });
  return out;
}

export function sanitizeStamps(raw: unknown): Stamp[] {
  if (!Array.isArray(raw)) return [...DEFAULT_STAMPS];
  const out = raw.filter(isRecord).flatMap(s => {
    const id = str(s.id);
    const label = str(s.label).trim();
    if (!id || !label) return [];
    const color = STAMP_COLORS.includes(s.color as StampColor) ? (s.color as StampColor) : 'grey';
    return [{ id, label, color, ...(s.custom === true && { custom: true }) }];
  });
  return out;
}

export function sanitizeGroups(raw: unknown): GroupsStore {
  if (!isRecord(raw)) return {};
  const out: GroupsStore = {};
  Object.entries(raw).forEach(([key, g]) => {
    if (isRecord(g) && Array.isArray(g.groups)) out[key] = { groups: g.groups.map(strings) };
  });
  return out;
}
