import { RestrictionRule, ScheduledEntry, TeacherAvailability } from '@/types/schedule';
import { findAvailabilityWarning, findRestrictionConflict } from '@/utils/scheduleRules';

/** Fälten som går att ändra i flera poster på en gång. */
export type BulkEditField = 'title' | 'teacher' | 'room';

/**
 * Det som ska skrivas. Ett fält som saknas lämnas orört i varje post; en tom
 * sträng betyder "töm fältet". Skillnaden är hela poängen: ett tomt salfält
 * betyder att salsreglerna tar över, så "rör inte" och "töm" får aldrig kunna
 * förväxlas. Titeln går inte att tömma — en tom titel ignoreras.
 */
export type BulkEditPatch = Partial<Record<BulkEditField, string>>;

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
      /** Posten som stoppade ändringen, så som den hade sett ut efteråt. */
      entry: ScheduledEntry;
      message: string;
    };

/**
 * Det värde som alla posterna delar, eller null när de skiljer sig åt. Ett
 * saknat fält räknas som tomt, så att en post utan sal och en med tom sal
 * räknas som lika.
 */
export const sharedFieldValue = (
  entries: ScheduledEntry[],
  field: BulkEditField
): string | null => {
  if (entries.length === 0) return null;
  const first = entries[0][field] ?? '';
  return entries.every(entry => (entry[field] ?? '') === first) ? first : null;
};

/** Plockar bort det som inte ska skrivas: blanktecken runt värdena och en tom titel. */
export const normalizeBulkPatch = (patch: BulkEditPatch): BulkEditPatch => {
  const normalized: BulkEditPatch = {};
  (Object.keys(patch) as BulkEditField[]).forEach(field => {
    const value = patch[field];
    if (value === undefined) return;
    const trimmed = value.trim();
    if (field === 'title' && !trimmed) return;
    normalized[field] = trimmed;
  });
  return normalized;
};

/**
 * Skriver samma värden i flera poster och prövar resultatet mot reglerna.
 *
 * Varje ändrad post prövas mot schemat som det ser ut *efter* ändringen, inte
 * före — annars kunde två poster som båda byter titel krocka med varandra utan
 * att någon av dem upptäckte det. Bara det som faktiskt ändras prövas:
 * ämnesreglerna läser titlar, så en post prövas mot dem bara om titeln byts,
 * och tillgängligheten bara om läraren byts. En krock som redan fanns i
 * schemat ska inte kunna stoppa ett salsbyte.
 *
 * Bryter en enda post mot en ämnesregel ändras ingenting alls.
 */
export const applyBulkEdit = (
  schedule: ScheduledEntry[],
  instanceIds: Iterable<string>,
  rawPatch: BulkEditPatch,
  context: BulkEditContext
): BulkEditResult => {
  const patch = normalizeBulkPatch(rawPatch);
  const fields = Object.keys(patch) as BulkEditField[];
  const targets = new Set(instanceIds);

  const changed: { entry: ScheduledEntry; titleChanged: boolean; teacherChanged: boolean }[] = [];

  const next = schedule.map(entry => {
    if (!targets.has(entry.instanceId)) return entry;

    const differs = fields.filter(field => (entry[field] ?? '') !== patch[field]);
    if (differs.length === 0) return entry;

    const updated: ScheduledEntry = { ...entry };
    differs.forEach(field => { updated[field] = patch[field] as string; });

    changed.push({
      entry: updated,
      titleChanged: differs.includes('title'),
      teacherChanged: differs.includes('teacher')
    });
    return updated;
  });

  if (changed.length === 0) {
    return { ok: true, schedule, changedCount: 0, warnings: [] };
  }

  for (const { entry, titleChanged } of changed) {
    if (!titleChanged) continue;
    const conflict = findRestrictionConflict(entry, next, context.restrictions);
    if (conflict) {
      return { ok: false, entry, message: conflict };
    }
  }

  const warnings = changed.reduce<BulkEditWarning[]>((collected, { entry, teacherChanged }) => {
    if (!teacherChanged) return collected;
    const message = findAvailabilityWarning(entry, context.availability, context.allTeachers);
    if (message) collected.push({ entry, message });
    return collected;
  }, []);

  return { ok: true, schedule: next, changedCount: changed.length, warnings };
};
