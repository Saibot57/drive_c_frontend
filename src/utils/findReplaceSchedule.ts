import { ScheduledEntry } from '@/types/schedule';

export type FindReplaceField =
  | 'room'
  | 'teacher'
  | 'title'
  | 'category'
  | 'notes'
  | 'all';

export interface FindReplaceOptions {
  wholeWord?: boolean;
  caseSensitive?: boolean;
}

const SEARCHABLE_FIELDS: Exclude<FindReplaceField, 'all'>[] = [
  'room',
  'teacher',
  'title',
  'category',
  'notes',
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildRegex = (find: string, opts: FindReplaceOptions): RegExp | null => {
  if (!find) return null;
  const escaped = escapeRegex(find);
  const pattern = opts.wholeWord ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])` : escaped;
  const flags = `g${opts.caseSensitive ? '' : 'i'}u`;
  try {
    return new RegExp(pattern, flags);
  } catch {
    // Fallback for environments without Unicode property escapes
    const fallback = opts.wholeWord ? `\\b${escaped}\\b` : escaped;
    return new RegExp(fallback, `g${opts.caseSensitive ? '' : 'i'}`);
  }
};

const getFieldValue = (entry: ScheduledEntry, field: Exclude<FindReplaceField, 'all'>): string => {
  const value = entry[field];
  return typeof value === 'string' ? value : '';
};

const fieldsToScan = (field: FindReplaceField): Exclude<FindReplaceField, 'all'>[] =>
  field === 'all' ? SEARCHABLE_FIELDS : [field];

/**
 * Returns instanceIds of entries that contain at least one match in the given field.
 */
export const findMatchingEntryIds = (
  entries: ScheduledEntry[],
  field: FindReplaceField,
  find: string,
  opts: FindReplaceOptions = {}
): Set<string> => {
  const regex = buildRegex(find, opts);
  const matched = new Set<string>();
  if (!regex) return matched;

  const scan = fieldsToScan(field);
  for (const entry of entries) {
    for (const f of scan) {
      regex.lastIndex = 0;
      if (regex.test(getFieldValue(entry, f))) {
        matched.add(entry.instanceId);
        break;
      }
    }
  }
  return matched;
};

/**
 * Counts total matches (substring occurrences) across selected fields.
 */
export const countMatches = (
  entries: ScheduledEntry[],
  field: FindReplaceField,
  find: string,
  opts: FindReplaceOptions = {}
): number => {
  const regex = buildRegex(find, opts);
  if (!regex) return 0;

  const scan = fieldsToScan(field);
  let total = 0;
  for (const entry of entries) {
    for (const f of scan) {
      const value = getFieldValue(entry, f);
      if (!value) continue;
      const matches = value.match(regex);
      if (matches) total += matches.length;
    }
  }
  return total;
};

export interface ReplaceResult {
  entries: ScheduledEntry[];
  replacedOccurrences: number;
  affectedEntryCount: number;
}

/**
 * Pure replace over entries. Does not mutate input.
 */
export const replaceInSchedule = (
  entries: ScheduledEntry[],
  field: FindReplaceField,
  find: string,
  replace: string,
  opts: FindReplaceOptions = {}
): ReplaceResult => {
  const regex = buildRegex(find, opts);
  if (!regex) {
    return { entries, replacedOccurrences: 0, affectedEntryCount: 0 };
  }

  const scan = fieldsToScan(field);
  let replacedOccurrences = 0;
  let affectedEntryCount = 0;

  const nextEntries = entries.map(entry => {
    let next = entry;
    let entryTouched = false;

    for (const f of scan) {
      const current = getFieldValue(entry, f);
      if (!current) continue;
      const matches = current.match(regex);
      if (!matches) continue;
      const updated = current.replace(regex, replace);
      if (updated !== current) {
        if (!entryTouched) {
          next = { ...entry };
          entryTouched = true;
        }
        (next as unknown as Record<string, unknown>)[f] = updated;
        replacedOccurrences += matches.length;
      }
    }

    if (entryTouched) affectedEntryCount += 1;
    return next;
  });

  return {
    entries: nextEntries,
    replacedOccurrences,
    affectedEntryCount,
  };
};
