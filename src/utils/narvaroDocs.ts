/**
 * Närvarorutornas data delad i dokument för servern: ett per ISO-vecka med
 * veckans tabeller (en per klass), anteckningar och grupper, och ett med
 * stämplarna. Varje
 * dokument krypteras för sig (se narvaroCrypto) och sparas med egen version.
 *
 * Veckor vars måndag är mer än ett läsår (365 dagar) gammal gallras: de
 * skickas inte, och servern tar bort dem.
 */

import {
  AttendanceTable,
  DEFAULT_STAMPS,
  GroupsStore,
  NotesStore,
  PassNames,
  Stamp,
  sanitizeGroups,
  sanitizeNotes,
  sanitizePassNames,
  sanitizeStamps,
  cleanClassName,
  renamePassNamesClass,
  sanitizeTable,
} from '@/utils/narvaro';

export const KEYINFO_KEY = 'keyinfo';
export const SETTINGS_KEY = 'settings';
export const RETENTION_DAYS = 365;

/** Klassens namn till dess tabell. `''` är en tabell som ännu inte fått någon klass. */
export type Sheets = Record<string, AttendanceTable>;

/** Allt sidan visar. Tabellerna ligger per vecka och klass. */
export type NarvaroData = {
  tables: Record<string, Sheets>;
  notes: NotesStore;
  groups: GroupsStore;
  /** Passens egna namn, per pass och klass. */
  passNames: PassNames;
  stamps: Stamp[];
};

export type WeekDoc = { sheets: Sheets; notes: NotesStore; groups: GroupsStore; passNames: PassNames };
export type SettingsDoc = { stamps: Stamp[] };

export const emptyData = (): NarvaroData => ({ tables: {}, notes: {}, groups: {}, passNames: {}, stamps: [...DEFAULT_STAMPS] });

const WEEK_KEY = /^w(\d{4})-(\d{2})$/;

/** `w2026-45` för datumets ISO-vecka. Året är ISO-veckans år, inte datumets. */
export function isoWeekKey(date: Date): string {
  const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7);
  return `w${year}-${String(week).padStart(2, '0')}`;
}

export const isWeekKey = (key: string) => WEEK_KEY.test(key);

/** Måndagen i veckan, lokal midnatt. */
export function weekMonday(key: string): Date | null {
  const m = key.match(WEEK_KEY);
  if (!m) return null;
  const year = Number(m[1]);
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(year, 0, 4 - ((jan4.getDay() || 7) - 1) + (Number(m[2]) - 1) * 7);
  return monday;
}

/** Är veckans måndag mer än ett läsår gammal? Samma gräns som servern. */
export function isExpiredWeek(key: string, now: Date): boolean {
  const monday = weekMonday(key);
  if (!monday) return false;
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - RETENTION_DAYS);
  return monday < cutoff;
}

/** Veckan för ett pass. Passens nycklar börjar med datumet (se `sessionKey`). */
export function weekOfSession(sessionKey: string): string | null {
  const m = sessionKey.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? isoWeekKey(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}

/** Pass grupperade per ISO-vecka. `week` är `null` för en nyckel utan datum. */
export type WeekGroup = { week: string | null; keys: string[] };

/**
 * Delar passen i en grupp per ISO-vecka, senaste veckan först. Ordningen
 * inom en vecka behålls. Nycklar utan datum hamnar sist.
 */
export function groupByWeek(keys: readonly string[]): WeekGroup[] {
  const byWeek = new Map<string | null, string[]>();
  keys.forEach(k => {
    const w = weekOfSession(k);
    const list = byWeek.get(w);
    if (list) list.push(k);
    else byWeek.set(w, [k]);
  });
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b.localeCompare(a)))
    .map(([week, ks]) => ({ week, keys: ks }));
}

/**
 * Rubriken för en vecka, t.ex. `v. 46`. Hör veckan till ett annat ISO-år än
 * `currentWeek` står året med: `v. 53 · 2026`.
 */
export function weekHeading(week: string | null, currentWeek: string): string {
  const m = week?.match(WEEK_KEY);
  if (!m) return 'Utan datum';
  const label = `v. ${Number(m[2])}`;
  return currentWeek.slice(1, 5) === m[1] ? label : `${label} · ${m[1]}`;
}

export type SheetRef = { week: string; table: AttendanceTable };

/**
 * Varje klass senaste tabell till och med veckan. En klass vars ark inte
 * klistrats in den här veckan visas med förra veckans.
 */
export function latestSheets(tables: Record<string, Sheets>, weekKey: string): Record<string, SheetRef> {
  const out: Record<string, SheetRef> = {};
  Object.keys(tables).filter(k => k <= weekKey).sort().forEach(week => {
    Object.entries(tables[week]).forEach(([klass, table]) => { out[klass] = { week, table }; });
  });
  return out;
}

/** Varje klass senaste tabell över alla veckor, för att känna igen ett ark. */
export function knownClasses(tables: Record<string, Sheets>): Sheets {
  const out: Sheets = {};
  Object.keys(tables).sort().forEach(week => Object.assign(out, tables[week]));
  return out;
}

export function setSheet(data: NarvaroData, week: string, klass: string, table: AttendanceTable): NarvaroData {
  return { ...data, tables: { ...data.tables, [week]: { ...data.tables[week], [klass]: table } } };
}

export function removeSheet(data: NarvaroData, week: string, klass: string): NarvaroData {
  const sheets = { ...data.tables[week] };
  delete sheets[klass];
  const tables = { ...data.tables, [week]: sheets };
  if (!Object.keys(sheets).length) delete tables[week];
  return { ...data, tables };
}

/**
 * Byter namn på en klass i alla veckor, även i passens namn. Finns målet
 * redan en vecka ersätts det.
 */
export function renameClass(data: NarvaroData, from: string, to: string): NarvaroData {
  if (from === to) return data;
  const tables: Record<string, Sheets> = {};
  Object.entries(data.tables).forEach(([week, sheets]) => {
    const next = { ...sheets };
    if (from in next) { next[to] = next[from]; delete next[from]; }
    tables[week] = next;
  });
  return { ...data, tables, passNames: renamePassNamesClass(data.passNames, from, to) };
}

const emptyWeek = (): WeekDoc => ({ sheets: {}, notes: {}, groups: {}, passNames: {} });

/** Delar datan i veckodokument. Gallrade veckor och pass utan datum tas inte med. */
export function splitWeeks(data: NarvaroData, now: Date): Record<string, WeekDoc> {
  const weeks: Record<string, WeekDoc> = {};
  const week = (key: string | null) => {
    if (!key || isExpiredWeek(key, now)) return null;
    return (weeks[key] = weeks[key] ?? emptyWeek());
  };
  Object.entries(data.tables).forEach(([k, sheets]) => {
    const w = week(k);
    if (w && Object.keys(sheets).length) w.sheets = sheets;
  });
  Object.entries(data.notes).forEach(([k, s]) => { const w = week(weekOfSession(k)); if (w) w.notes[k] = s; });
  Object.entries(data.groups).forEach(([k, g]) => { const w = week(weekOfSession(k)); if (w) w.groups[k] = g; });
  Object.entries(data.passNames).forEach(([k, n]) => { const w = week(weekOfSession(k)); if (w) w.passNames[k] = n; });
  return weeks;
}

/**
 * Dokumenten som ska finnas på servern. En vecka som funnits men nu är tom
 * (till exempel när ett pass tagits bort) sparas tom, så att det borttagna
 * inte ligger kvar.
 */
export function documentsToSave(data: NarvaroData, now: Date, knownKeys: Iterable<string>): Record<string, unknown> {
  const docs: Record<string, unknown> = { ...splitWeeks(data, now), [SETTINGS_KEY]: { stamps: data.stamps } };
  Array.from(knownKeys).forEach(k => {
    if (isWeekKey(k) && !docs[k] && !isExpiredWeek(k, now)) docs[k] = emptyWeek();
  });
  return docs;
}

/**
 * Ett veckodokument. Före klasserna hade det en enda `table`; den blir en
 * tabell utan klass, som sidan ber användaren namnge. Äldre dokument saknar
 * `passNames`.
 */
export function sanitizeWeekDoc(raw: unknown): WeekDoc {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const sheets: Sheets = {};
  if (typeof r.sheets === 'object' && r.sheets !== null && !Array.isArray(r.sheets)) {
    Object.entries(r.sheets as Record<string, unknown>).forEach(([klass, t]) => {
      const table = sanitizeTable(t);
      if (table) sheets[klass === '' ? '' : cleanClassName(klass) || ''] = table;
    });
  } else {
    const table = sanitizeTable(r.table);
    if (table) sheets[''] = table;
  }
  return { sheets, notes: sanitizeNotes(r.notes), groups: sanitizeGroups(r.groups), passNames: sanitizePassNames(r.passNames) };
}

export function sanitizeSettingsDoc(raw: unknown): SettingsDoc {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return { stamps: sanitizeStamps(r.stamps) };
}

/** Slår ihop veckodokumenten till det sidan visar. */
export function mergeWeeks(weeks: Record<string, WeekDoc>, stamps: Stamp[], now: Date): NarvaroData {
  const data: NarvaroData = { tables: {}, notes: {}, groups: {}, passNames: {}, stamps };
  Object.entries(weeks).forEach(([key, w]) => {
    if (isExpiredWeek(key, now)) return;
    if (Object.keys(w.sheets).length) data.tables[key] = w.sheets;
    Object.assign(data.notes, w.notes);
    Object.assign(data.groups, w.groups);
    Object.assign(data.passNames, w.passNames);
  });
  return data;
}

export type LegacyData = {
  table: AttendanceTable | null;
  notes: NotesStore;
  groups: GroupsStore;
  stamps: Stamp[] | null;
};

export const hasLegacyContent = (l: LegacyData) =>
  !!l.table || Object.keys(l.notes).length > 0 || Object.keys(l.groups).length > 0 || l.stamps !== null;

/**
 * För över det som tidigare bara låg i webbläsaren. Tabellen hör till den här
 * veckan, eftersom det var den sidan visade den för, och har ingen klass än.
 * Det som redan finns på servern vinner: en tabell, ett pass, en grupp eller
 * en stämpel som finns där ändras inte.
 */
export function mergeLegacy(server: NarvaroData, legacy: LegacyData, now: Date): NarvaroData {
  const current = isoWeekKey(now);
  const ids = new Set(server.stamps.map(s => s.id));
  const hasCurrent = Object.keys(server.tables[current] ?? {}).length > 0;
  return {
    tables: legacy.table && !hasCurrent
      ? { ...server.tables, [current]: { '': legacy.table } }
      : server.tables,
    notes: { ...legacy.notes, ...server.notes },
    groups: { ...legacy.groups, ...server.groups },
    passNames: server.passNames,
    stamps: [...server.stamps, ...(legacy.stamps ?? []).filter(s => !ids.has(s.id))],
  };
}
