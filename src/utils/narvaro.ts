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
  /** Klassen (arket) personen kommer från, när flera ark visas tillsammans. */
  klass?: string;
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
/** Passets nyckel (`sessionKey`) till klassens eget namn på just det passet. */
export type PassNames = Record<string, Record<string, string>>;

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

export function defaultDay(table: Pick<AttendanceTable, 'days'>, now: Date): string {
  const today = weekdayName(now);
  return table.days.includes(today) ? today : table.days[0];
}

/**
 * Nyckeln som anteckningar sparas under: datum, dag och kolumn. Passets namn
 * ingår inte, eftersom samma pass kan heta lite olika i olika klassers ark
 * (9.45-11.30 och 9.45-11.45).
 */
export function sessionKey(table: AttendanceTable, day: string, pass: PassChoice, now: Date): string {
  const col = table.cols.find(c => c.id === pass);
  const which = pass === 'day' ? 'dag' : col?.letter || pass;
  return `${isoDate(dateForDay(day, now))}|${day}|${which}`;
}

/** Äldre nycklar slutade med passets namn (`…|G|Studieverkstad`). */
export const normalizeSessionKey = (key: string) => key.split('|').slice(0, 3).join('|');

/**
 * Grupper hör till passet och till vilka klasser som visas tillsammans, så
 * att grupperna för Rosa + Grund inte skrivs över när bara Rosa visas.
 */
export const groupsKey = (sessKey: string, classes: readonly string[]) =>
  `${sessKey}#${[...classes].sort().join('+')}`;

export const isGroupsKey = (key: string) => key.includes('#');

/* ---------- klasser ---------- */

export const MAX_CLASS_NAME_LENGTH = 30;

/** Klassens namn som det sparas: utan tecknen som skiljer nycklarna åt. */
export const cleanClassName = (name: string) =>
  name.replace(/[+#|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CLASS_NAME_LENGTH);

/**
 * Arken för de valda klasserna som en tabell. Passen paras ihop efter
 * kolumn, eftersom arken har samma uppställning; namnet tas från det första
 * arket. Heter två elever i veckans ark exakt likadant får båda klassen efter
 * namnet, så att deras noteringar hålls isär.
 */
export function combineSheets(sheets: Record<string, AttendanceTable>, classes: readonly string[]): AttendanceTable {
  const chosen = classes.filter(c => sheets[c]);
  const counts = new Map<string, number>();
  Object.values(sheets).forEach(t => t.people.forEach(p => counts.set(p.name, (counts.get(p.name) ?? 0) + 1)));
  const people = chosen.flatMap(klass => sheets[klass].people.map(p => ({
    ...p,
    klass,
    name: (counts.get(p.name) ?? 0) > 1 ? `${p.name} (${klass || 'utan klass'})` : p.name,
  })));
  const byIndex = new Map<number, AttendanceColumn>();
  chosen.forEach(klass => sheets[klass].cols.forEach(c => { if (!byIndex.has(c.index)) byIndex.set(c.index, c); }));
  const cols = Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
  return {
    people,
    cols,
    groups: Array.from(new Set(people.map(p => p.group).filter(Boolean))),
    days: Array.from(new Set(cols.map(c => c.day))),
  };
}

/** Klasserna (i given ordning) vars ark har minst ett pass den dagen. */
export function classesOnDay(sheets: Record<string, AttendanceTable>, classes: readonly string[], day: string): string[] {
  return classes.filter(c => sheets[c]?.cols.some(col => col.day === day));
}

/**
 * De klasser som visas en viss dag. En vald klass utan pass den dagen faller
 * bort för dagen men ligger kvar i det sparade valet. Finns ingen av de valda
 * den dagen visas den första klass som har dagen. Har ingen klass dagen
 * gäller valet som det är.
 */
export function selectionForDay(
  sheets: Record<string, AttendanceTable>,
  classes: readonly string[],
  chosen: readonly string[],
  day: string,
): string[] {
  const onDay = classesOnDay(sheets, classes, day);
  const picked = classes.filter(c => chosen.includes(c));
  if (!onDay.length) return picked.length ? picked : classes.slice(0, 1);
  const here = onDay.filter(c => chosen.includes(c));
  return here.length ? here : onDay.slice(0, 1);
}

/**
 * Växlar en klass i dagens urval. Valda klasser som inte har dagen behålls i
 * det sparade valet, så att de kommer tillbaka på sina dagar. `null` när
 * dagens urval skulle bli tomt.
 */
export function toggleClassOnDay(
  shown: readonly string[],
  chosen: readonly string[],
  onDay: readonly string[],
  klass: string,
): string[] | null {
  const next = shown.includes(klass) ? shown.filter(c => c !== klass) : [...shown, klass];
  if (!next.length) return null;
  const elsewhere = onDay.length ? chosen.filter(c => !onDay.includes(c) && !next.includes(c)) : [];
  return [...next, ...elsewhere];
}

export type ClassSuggestion = { klass: string; matched: number; total: number };

/** Den klass vars senaste ark har flest av namnen, om någon har något. */
export function suggestClass(table: AttendanceTable, known: Record<string, AttendanceTable>): ClassSuggestion | null {
  const names = new Set(table.people.map(p => p.name));
  let best: ClassSuggestion | null = null;
  Object.entries(known).forEach(([klass, t]) => {
    if (!klass) return;
    const matched = t.people.filter(p => names.has(p.name)).length;
    if (matched > 0 && (!best || matched > best.matched)) best = { klass, matched, total: names.size };
  });
  return best;
}

/** Säkert nog för att spara direkt: minst fyra av fem namn känns igen. */
export const isConfident = (s: ClassSuggestion | null) => !!s && s.matched / s.total >= 0.8;

/** Rubriken för passet, med passets eget namn före tiden: "Måndag 3/11 · Svenska · 8.30-9.45". */
export function sessionLabel(table: AttendanceTable, day: string, pass: PassChoice, now: Date, name = ''): string {
  const d = dateForDay(day, now);
  const col = table.cols.find(c => c.id === pass);
  const time = pass === 'day' || !col ? 'hela dagen' : col.pass;
  return [`${day} ${d.getDate()}/${d.getMonth() + 1}`, name, time].filter(Boolean).join(' · ');
}

/* ---------- passens namn ---------- */

export const MAX_PASS_NAME_LENGTH = 40;

export const cleanPassName = (name: string) =>
  name.replace(/\s+/g, ' ').trim().slice(0, MAX_PASS_NAME_LENGTH).trim();

/** Ger varje klass samma namn på passet. Ett tomt namn tar bort det. */
export function setPassName(store: PassNames, key: string, classes: readonly string[], name: string): PassNames {
  const clean = cleanPassName(name);
  const names = { ...store[key] };
  classes.forEach(k => {
    if (clean) names[k] = clean;
    else delete names[k];
  });
  const next = { ...store };
  if (Object.keys(names).length) next[key] = names;
  else delete next[key];
  return next;
}

/** De visade klassernas olika namn på passet, i klassernas ordning: "Svenska / Matte". */
export function passNameFor(store: PassNames, key: string, classes: readonly string[]): string {
  const names = store[key] ?? {};
  return Array.from(new Set(classes.map(k => names[k]).filter(Boolean))).join(' / ');
}

/**
 * Byter passets namn. Har passet anteckningar får de den nya rubriken, så att
 * Tidigare pass visar namnet som gäller nu.
 */
export function namePass(
  notes: NotesStore,
  passNames: PassNames,
  sel: { key: string; classes: readonly string[]; name: string; labelFor: (name: string) => string },
): { notes: NotesStore; passNames: PassNames } {
  const nextNames = setPassName(passNames, sel.key, sel.classes, sel.name);
  const sess = notes[sel.key];
  if (!sess) return { notes, passNames: nextNames };
  const label = sel.labelFor(passNameFor(nextNames, sel.key, sel.classes));
  return { notes: { ...notes, [sel.key]: { ...sess, label } }, passNames: nextNames };
}

/**
 * Byter namnet i en sparad rubrik ("Måndag 3/11 · Svenska · 8.30-9.45"),
 * för ett tidigare pass vars tabell inte längre visas. Datumet står först
 * och tiden sist; det som står mellan är det gamla namnet.
 */
export function relabelSession(label: string, name: string): string {
  const parts = label.split(' · ');
  if (parts.length < 2) return label;
  return [parts[0], name, parts[parts.length - 1]].filter(Boolean).join(' · ');
}

/** Flyttar klassens namn på passen till ett nytt klassnamn. */
export function renamePassNamesClass(store: PassNames, from: string, to: string): PassNames {
  if (from === to) return store;
  const out: PassNames = {};
  Object.entries(store).forEach(([key, names]) => {
    const next = { ...names };
    if (from in next) { next[to] = next[from]; delete next[from]; }
    out[key] = next;
  });
  return out;
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

/** Passets noteringar som text, grupperade per klass och skola när det finns flera. */
export function sessionText(sess: SessionNotes, table: AttendanceTable, stamps: readonly Stamp[]): string {
  const lines = [sess.label];
  const byGroup = new Map<string, [string, PersonNote][]>();
  noteEntries(sess).forEach(([name, n]) => {
    const p = table.people.find(x => x.name === name);
    const g = p ? [p.klass, p.group].filter(Boolean).join(' · ') : '';
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
export function historyKeys(notes: NotesStore, currentKey: string): string[] {
  return Object.keys(notes)
    .filter(k => k !== currentKey && noteEntries(notes[k]).length > 0)
    .sort()
    .reverse();
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

/** Förnamnet och resten: "Amira Haddad" blir ["Amira", "Haddad"]. Ett namn utan blanktecken är bara förnamn. */
export const splitName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return [first, rest.join(' ')] as const;
};

/**
 * Förnamnen för namnen, nyckel för nyckel. Delar två förnamn får de
 * efternamnets initial ("Ali H."), och räcker inte det får de också klassen
 * som `combineSheets` satt efter namnet ("Ali H. (Rosa)"). Klassen är annars
 * aldrig en del av förnamnet.
 */
export function firstNames(names: readonly string[]): Map<string, string> {
  const parts = new Map(names.map(name => {
    const m = name.match(/^(.*?)\s*(\([^()]*\))$/);
    const [first, last] = splitName(m ? m[1] : name);
    return [name, { first, initial: last ? ` ${last[0]}.` : '', klass: m ? ` ${m[2]}` : '' }] as const;
  }));
  const tally = (key: (p: { first: string; initial: string }) => string) => {
    const counts = new Map<string, number>();
    parts.forEach(p => counts.set(key(p), (counts.get(key(p)) ?? 0) + 1));
    return (p: { first: string; initial: string }) => (counts.get(key(p)) ?? 0) > 1;
  };
  const sameFirst = tally(p => p.first);
  const sameInitial = tally(p => p.first + p.initial);
  return new Map(Array.from(parts, ([name, p]) => {
    if (!sameFirst(p)) return [name, p.first];
    return [name, p.first + p.initial + (sameInitial(p) ? p.klass : '')];
  }));
}

/** Grupperna som text att kopiera, med bara förnamnen. */
export function groupsText(label: string, view: { groups: string[][]; pool: string[] }): string {
  const short = firstNames([...view.groups.flat(), ...view.pool]);
  const join = (names: string[]) => names.map(n => short.get(n) ?? n).join(', ');
  const lines = view.groups.map((g, i) => `Grupp ${i + 1}: ${join(g) || '(tom)'}`);
  if (view.pool.length) lines.push('', `Inte indelade: ${join(view.pool)}`);
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
  Object.entries(raw).forEach(([rawKey, s]) => {
    const key = normalizeSessionKey(rawKey);
    if (!isRecord(s)) return;
    const people: Record<string, PersonNote> = {};
    if (isRecord(s.people)) {
      Object.entries(s.people).forEach(([name, n]) => {
        if (isRecord(n)) people[name] = { tags: strings(n.tags), note: str(n.note) };
      });
    }
    // Två äldre nycklar kan bli samma; slå ihop dem hellre än att tappa någon.
    const prev = out[key];
    out[key] = prev
      ? { label: prev.label || str(s.label), people: { ...people, ...prev.people }, added: Array.from(new Set([...prev.added, ...strings(s.added)])) }
      : { label: str(s.label), people, added: strings(s.added) };
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

/**
 * Grupper sparade före klasserna (utan `#` i nyckeln) gick inte att knyta
 * till någon kombination av klasser och släpps.
 */
export function sanitizeGroups(raw: unknown): GroupsStore {
  if (!isRecord(raw)) return {};
  const out: GroupsStore = {};
  Object.entries(raw).forEach(([key, g]) => {
    if (isGroupsKey(key) && isRecord(g) && Array.isArray(g.groups)) out[key] = { groups: g.groups.map(strings) };
  });
  return out;
}

/** Namn som inte är text eller är tomma släpps; för långa kortas. */
export function sanitizePassNames(raw: unknown): PassNames {
  if (!isRecord(raw)) return {};
  const out: PassNames = {};
  Object.entries(raw).forEach(([rawKey, names]) => {
    if (!isRecord(names)) return;
    const clean: Record<string, string> = {};
    Object.entries(names).forEach(([klass, n]) => {
      const name = cleanPassName(str(n));
      if (name) clean[klass] = name;
    });
    if (Object.keys(clean).length) out[normalizeSessionKey(rawKey)] = clean;
  });
  return out;
}
