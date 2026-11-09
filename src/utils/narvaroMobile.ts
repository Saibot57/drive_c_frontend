import { groupView, setPersonNote, type SessionNotes, type Stamp } from '@/utils/narvaro';

/**
 * Logik för mobilläget i Närvarorutor: när läget gäller, vilken stämpel som
 * är aktiv, hur rutorna delas upp och sorteras, och ångra för stämplar.
 */

/** Användarens val på enheten. `auto` följer skärmens bredd. */
export type MobilePref = 'auto' | 'on' | 'off';

export const sanitizeMobilePref = (raw: unknown): MobilePref =>
  raw === 'on' || raw === 'off' ? raw : 'auto';

/** Ett eget val går före skärmens bredd. */
export const isMobileMode = (pref: MobilePref, smallScreen: boolean) =>
  pref === 'auto' ? smallScreen : pref === 'on';

export const sanitizeStampId = (raw: unknown): string => (typeof raw === 'string' ? raw.slice(0, 64) : '');

/** Den senast använda stämpeln om den finns kvar, annars den första. */
export function pickActiveStamp(stamps: readonly Stamp[], savedId: string): string | null {
  if (stamps.some(s => s.id === savedId)) return savedId;
  return stamps[0]?.id ?? null;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/** Sorterar på förnamn och sedan på hela namnet. */
export function byFirstName(names: readonly string[]): string[] {
  return [...names].sort((a, b) =>
    firstName(a).localeCompare(firstName(b), 'sv') || a.localeCompare(b, 'sv'));
}

export type MobileView = 'class' | 'groups';
export type MobileSection = { title: string | null; names: string[] };

/**
 * Rutorna i sektioner. Klassvyn är en sektion. Gruppvyn följer passets
 * sparade grupper, och närvarande utan grupp (även de som lämnats utanför)
 * hamnar sist under "Utan grupp". Tomma grupper hoppas över.
 */
export function mobileSections(
  view: MobileView,
  present: readonly string[],
  stored: string[][] | undefined,
): MobileSection[] {
  if (view === 'class' || !stored) return [{ title: null, names: byFirstName(present) }];
  const { groups, pool } = groupView(stored, present);
  const sections: MobileSection[] = groups
    .map((names, i) => ({ title: `Grupp ${i + 1}`, names: byFirstName(names) }))
    .filter(s => s.names.length > 0);
  if (pool.length) sections.push({ title: 'Utan grupp', names: byFirstName(pool) });
  return sections;
}

/** Sätter (`on`) eller tar bort stämpeln, utan att växla. */
export function setStamp(sess: SessionNotes, name: string, stampId: string, on: boolean): SessionNotes {
  const cur = sess.people[name] ?? { tags: [], note: '' };
  if (cur.tags.includes(stampId) === on) return sess;
  const tags = on ? [...cur.tags, stampId] : cur.tags.filter(t => t !== stampId);
  return setPersonNote(sess, name, { ...cur, tags });
}

/** Ett tryck i mobilläget: passet, personen, stämpeln och om den sattes. */
export type UndoEntry = { key: string; name: string; stampId: string; on: boolean };

export const MAX_UNDO = 10;

/** Lägger till ett steg. Steg från andra pass tas bort, och högst `max` sparas. */
export function pushUndo(stack: readonly UndoEntry[], entry: UndoEntry, max = MAX_UNDO): UndoEntry[] {
  return [...stack.filter(e => e.key === entry.key), entry].slice(-max);
}

/** Det som ångrar steget: stämpeln sätts tillbaka som den var. */
export const undoSession = (sess: SessionNotes, entry: UndoEntry) =>
  setStamp(sess, entry.name, entry.stampId, !entry.on);
