import { RestrictionRule, ScheduledEntry, TeacherAvailability } from '@/types/schedule';
import { findAvailabilityWarning, findRestrictionConflict } from '@/utils/scheduleRules';
import { END_HOUR, minutesToTime, START_HOUR, timeToMinutes } from '@/utils/scheduleTime';

/** Textfälten som går att ändra i flera poster på en gång. */
export type BulkEditField = 'title' | 'teacher' | 'room' | 'notes' | 'category';

export const BULK_TEXT_FIELDS: BulkEditField[] = ['title', 'teacher', 'room', 'notes', 'category'];

/**
 * En tidsändring. `set` skriver samma klockslag i alla poster: bara start
 * flyttar posten och behåller längden, bara slut ändrar längden, båda ger
 * exakt de tiderna. `shift` flyttar varje post lika många minuter, vilket är
 * det enda som säger något för poster som ligger på olika tider.
 */
export type BulkTimeChange =
  | { kind: 'set'; start?: string; end?: string }
  | { kind: 'shift'; minutes: number };

/**
 * Det som ska skrivas. Ett fält som saknas lämnas orört i varje post; en tom
 * sträng betyder "töm fältet". Skillnaden är hela poängen: ett tomt salfält
 * betyder att salsreglerna tar över, så "rör inte" och "töm" får aldrig kunna
 * förväxlas. Titeln och färgen går inte att tömma — tomma värden ignoreras.
 */
export type BulkEditPatch = Partial<Record<BulkEditField, string>> & {
  color?: string;
  time?: BulkTimeChange;
};

export type BulkEditContext = {
  restrictions: RestrictionRule[];
  availability: TeacherAvailability;
  allTeachers: string[];
};

export type BulkEditWarning = { entry: ScheduledEntry; message: string };

export type BulkEditResult =
  | {
      ok: true;
      /** Samma referens som in när ingenting ändrades, så att ångra-historiken inte får ett tomt steg. */
      schedule: ScheduledEntry[];
      changedCount: number;
      warnings: BulkEditWarning[];
    }
  | {
      ok: false;
      /**
       * Posten som stoppade ändringen. Vid en regelkrock så som den hade sett
       * ut efteråt, vid en ogiltig tid så som den ser ut nu — den nya tiden
       * finns då i meddelandet.
       */
      entry: ScheduledEntry;
      message: string;
    };

/** Fälten som dialogen visar ett gemensamt värde för. */
export type SharedField = BulkEditField | 'color' | 'startTime' | 'endTime';

/**
 * Det värde som alla posterna delar, eller null när de skiljer sig åt. Ett
 * saknat fält räknas som tomt, så att en post utan sal och en med tom sal
 * räknas som lika.
 */
export const sharedFieldValue = (
  entries: ScheduledEntry[],
  field: SharedField
): string | null => {
  if (entries.length === 0) return null;
  const first = entries[0][field] ?? '';
  return entries.every(entry => (entry[field] ?? '') === first) ? first : null;
};

const isClock = (value: string) => /^\d{1,2}:\d{2}$/.test(value);

/**
 * Plockar bort det som inte ska skrivas: blanktecken runt värdena, en tom
 * titel eller färg och en tidsändring som inte ändrar något.
 */
export const normalizeBulkPatch = (patch: BulkEditPatch): BulkEditPatch => {
  const normalized: BulkEditPatch = {};
  BULK_TEXT_FIELDS.forEach(field => {
    const value = patch[field];
    if (value === undefined) return;
    const trimmed = value.trim();
    if (field === 'title' && !trimmed) return;
    normalized[field] = trimmed;
  });

  const color = patch.color?.trim();
  if (color) normalized.color = color;

  const time = patch.time;
  if (time?.kind === 'set') {
    const start = time.start?.trim();
    const end = time.end?.trim();
    const set: BulkTimeChange = { kind: 'set' };
    if (start && isClock(start)) set.start = start;
    if (end && isClock(end)) set.end = end;
    if (set.start || set.end) normalized.time = set;
  }
  if (time?.kind === 'shift' && Number.isFinite(time.minutes) && Math.round(time.minutes) !== 0) {
    normalized.time = { kind: 'shift', minutes: Math.round(time.minutes) };
  }

  return normalized;
};

/** Postens nya tider i minuter. Kan hamna utanför dygnet; det fångas av `timeProblem`. */
export const retimeEntry = (
  entry: Pick<ScheduledEntry, 'startTime' | 'endTime'>,
  change: BulkTimeChange
): { start: number; end: number } => {
  const start = timeToMinutes(entry.startTime);
  const end = timeToMinutes(entry.endTime);

  if (change.kind === 'shift') {
    return { start: start + change.minutes, end: end + change.minutes };
  }

  const nextStart = change.start ? timeToMinutes(change.start) : start;
  if (change.end) return { start: nextStart, end: timeToMinutes(change.end) };
  // Bara ny start: posten flyttas och behåller sin längd.
  return { start: nextStart, end: nextStart + (end - start) };
};

const describeRange = (start: number, end: number) => (
  start >= 0 && end < 24 * 60 ? ` (${minutesToTime(start)}–${minutesToTime(end)})` : ''
);

/** Varför de nya tiderna inte går att rita, eller null när de går. */
const timeProblem = (start: number, end: number): string | null => {
  if (end <= start) {
    return `Sluttiden skulle hamna före starttiden${describeRange(start, end)}.`;
  }
  if (start < START_HOUR * 60 || end > END_HOUR * 60) {
    const first = minutesToTime(START_HOUR * 60);
    const last = minutesToTime(END_HOUR * 60);
    return `Posten skulle hamna utanför schemat ${first}–${last}${describeRange(start, end)}.`;
  }
  return null;
};

type ChangedEntry = {
  original: ScheduledEntry;
  entry: ScheduledEntry;
  titleChanged: boolean;
  teacherChanged: boolean;
  timeChanged: boolean;
  timeError: string | null;
};

/**
 * Skriver samma värden i flera poster och prövar resultatet mot reglerna.
 *
 * Varje ändrad post prövas mot schemat som det ser ut *efter* ändringen, inte
 * före — annars kunde två poster som båda byter titel krocka med varandra utan
 * att någon av dem upptäckte det. Bara det som faktiskt ändras prövas:
 * ämnesreglerna läser titel och tid, så en post prövas mot dem bara om någon
 * av dem ändras, och tillgängligheten bara om läraren eller tiden ändras. En
 * krock som redan fanns i schemat ska inte kunna stoppa ett salsbyte.
 *
 * Bryter en enda post mot en ämnesregel, eller hamnar den utanför schemat,
 * ändras ingenting alls.
 */
export const applyBulkEdit = (
  schedule: ScheduledEntry[],
  instanceIds: Iterable<string>,
  rawPatch: BulkEditPatch,
  context: BulkEditContext
): BulkEditResult => {
  const patch = normalizeBulkPatch(rawPatch);
  const fields = BULK_TEXT_FIELDS.filter(field => patch[field] !== undefined);
  const targets = new Set(instanceIds);

  const changed: ChangedEntry[] = [];

  const next = schedule.map(entry => {
    if (!targets.has(entry.instanceId)) return entry;

    const differs = fields.filter(field => (entry[field] ?? '') !== patch[field]);
    const colorChanged = patch.color !== undefined && entry.color !== patch.color;

    const times = patch.time ? retimeEntry(entry, patch.time) : null;
    const timeChanged = times !== null && (
      times.start !== timeToMinutes(entry.startTime) || times.end !== timeToMinutes(entry.endTime)
    );

    if (differs.length === 0 && !colorChanged && !timeChanged) return entry;

    const updated: ScheduledEntry = { ...entry };
    differs.forEach(field => { updated[field] = patch[field] as string; });
    if (colorChanged) updated.color = patch.color as string;
    let timeError: string | null = null;
    if (times && timeChanged) {
      updated.startTime = minutesToTime(times.start);
      updated.endTime = minutesToTime(times.end);
      updated.duration = times.end - times.start;
      // Platsen bland samtidiga poster gällde de gamla grannarna.
      if (updated.startTime !== entry.startTime) updated.laneOrder = undefined;
      timeError = timeProblem(times.start, times.end);
    }

    changed.push({
      original: entry,
      entry: updated,
      titleChanged: differs.includes('title'),
      teacherChanged: differs.includes('teacher'),
      timeChanged,
      timeError
    });
    return updated;
  });

  if (changed.length === 0) {
    return { ok: true, schedule, changedCount: 0, warnings: [] };
  }

  for (const { original, timeError } of changed) {
    if (timeError) return { ok: false, entry: original, message: timeError };
  }

  for (const { entry, titleChanged, timeChanged } of changed) {
    if (!titleChanged && !timeChanged) continue;
    const conflict = findRestrictionConflict(entry, next, context.restrictions);
    if (conflict) {
      return { ok: false, entry, message: conflict };
    }
  }

  const warnings = changed.reduce<BulkEditWarning[]>((collected, { entry, teacherChanged, timeChanged }) => {
    if (!teacherChanged && !timeChanged) return collected;
    const message = findAvailabilityWarning(entry, context.availability, context.allTeachers);
    if (message) collected.push({ entry, message });
    return collected;
  }, []);

  return { ok: true, schedule: next, changedCount: changed.length, warnings };
};

/** Om ändringen skulle ändra något i någon av posterna. Styr Spara-knappen. */
export const bulkPatchChangesAny = (entries: ScheduledEntry[], rawPatch: BulkEditPatch): boolean => {
  const result = applyBulkEdit(entries, entries.map(entry => entry.instanceId), rawPatch, {
    restrictions: [],
    availability: {},
    allTeachers: []
  });
  return !result.ok || result.changedCount > 0;
};
