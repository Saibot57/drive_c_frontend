/**
 * Närvarorutornas data delad i dokument för servern: ett per ISO-vecka med
 * veckans tabell, anteckningar och grupper, och ett med stämplarna. Varje
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
  Stamp,
  sanitizeGroups,
  sanitizeNotes,
  sanitizeStamps,
  sanitizeTable,
} from '@/utils/narvaro';

export const KEYINFO_KEY = 'keyinfo';
export const SETTINGS_KEY = 'settings';
export const RETENTION_DAYS = 365;

/** Allt sidan visar. Tabellerna ligger per vecka, under veckans nyckel. */
export type NarvaroData = {
  tables: Record<string, AttendanceTable>;
  notes: NotesStore;
  groups: GroupsStore;
  stamps: Stamp[];
};

export type WeekDoc = { table: AttendanceTable | null; notes: NotesStore; groups: GroupsStore };
export type SettingsDoc = { stamps: Stamp[] };

export const emptyData = (): NarvaroData => ({ tables: {}, notes: {}, groups: {}, stamps: [...DEFAULT_STAMPS] });

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

/** Veckans tabell, annars den senaste från en tidigare vecka. */
export function tableFor(
  tables: Record<string, AttendanceTable>,
  weekKey: string,
): { key: string; table: AttendanceTable } | null {
  const key = Object.keys(tables).filter(k => k <= weekKey).sort().pop();
  return key ? { key, table: tables[key] } : null;
}

const emptyWeek = (): WeekDoc => ({ table: null, notes: {}, groups: {} });

/** Delar datan i veckodokument. Gallrade veckor och pass utan datum tas inte med. */
export function splitWeeks(data: NarvaroData, now: Date): Record<string, WeekDoc> {
  const weeks: Record<string, WeekDoc> = {};
  const week = (key: string | null) => {
    if (!key || isExpiredWeek(key, now)) return null;
    return (weeks[key] = weeks[key] ?? emptyWeek());
  };
  Object.entries(data.tables).forEach(([k, t]) => { const w = week(k); if (w) w.table = t; });
  Object.entries(data.notes).forEach(([k, s]) => { const w = week(weekOfSession(k)); if (w) w.notes[k] = s; });
  Object.entries(data.groups).forEach(([k, g]) => { const w = week(weekOfSession(k)); if (w) w.groups[k] = g; });
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

export function sanitizeWeekDoc(raw: unknown): WeekDoc {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return { table: sanitizeTable(r.table), notes: sanitizeNotes(r.notes), groups: sanitizeGroups(r.groups) };
}

export function sanitizeSettingsDoc(raw: unknown): SettingsDoc {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return { stamps: sanitizeStamps(r.stamps) };
}

/** Slår ihop veckodokumenten till det sidan visar. */
export function mergeWeeks(weeks: Record<string, WeekDoc>, stamps: Stamp[], now: Date): NarvaroData {
  const data: NarvaroData = { tables: {}, notes: {}, groups: {}, stamps };
  Object.entries(weeks).forEach(([key, w]) => {
    if (isExpiredWeek(key, now)) return;
    if (w.table) data.tables[key] = w.table;
    Object.assign(data.notes, w.notes);
    Object.assign(data.groups, w.groups);
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
 * veckan, eftersom det var den sidan visade den för. Det som redan finns på
 * servern vinner: ett pass, en grupp eller en stämpel som finns där ändras inte.
 */
export function mergeLegacy(server: NarvaroData, legacy: LegacyData, now: Date): NarvaroData {
  const current = isoWeekKey(now);
  const ids = new Set(server.stamps.map(s => s.id));
  return {
    tables: legacy.table && !server.tables[current] ? { ...server.tables, [current]: legacy.table } : server.tables,
    notes: { ...legacy.notes, ...server.notes },
    groups: { ...legacy.groups, ...server.groups },
    stamps: [...server.stamps, ...(legacy.stamps ?? []).filter(s => !ids.has(s.id))],
  };
}
