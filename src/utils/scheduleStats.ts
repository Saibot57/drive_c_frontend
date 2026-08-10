import { ScheduledEntry } from '@/types/schedule';
import { timeToMinutes } from '@/utils/scheduleTime';

export type TimeInterval = { start: number; end: number };

/**
 * Summerar hur många minuter en samling intervall täcker totalt.
 * Överlappande (eller angränsande) intervall räknas bara en gång, så
 * två parallella lektioner 08:00–09:00 ger 60 minuter, inte 120.
 */
export const mergeIntervalMinutes = (intervals: TimeInterval[]): number => {
  if (intervals.length === 0) return 0;

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let total = 0;
  let currentStart = sorted[0].start;
  let currentEnd = sorted[0].end;

  sorted.slice(1).forEach(interval => {
    if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
    } else {
      total += currentEnd - currentStart;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
  });

  return total + (currentEnd - currentStart);
};

/**
 * Lärarfältet är fritext och kan innehålla flera lärare separerade med komma
 * ("Anna, Björn").
 */
export const splitTeacherNames = (value: unknown): string[] => {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);
};

/** Namnet i lärarfältet som betyder "varje lärare". Skiftlägesokänsligt. */
export const ALL_TEACHERS_TOKEN = 'alla';

const normalizeTeacherName = (value: string) => value.trim().toLocaleLowerCase('sv');

/** Sant när fältet räknar upp "alla", ensamt eller bland andra namn. */
export const isAllTeachersField = (value: unknown): boolean => (
  splitTeacherNames(value).some(name => normalizeTeacherName(name) === ALL_TEACHERS_TOKEN)
);

/**
 * Varje lärare som finns: de som står i debug-menyns lista plus de som
 * förekommer i något lärarfält i schemat. Mängden är vad "alla" expanderar
 * till, så ordet självt räknas inte som en lärare. Samma namn med olika
 * versaler slås ihop, och första stavningen vi såg blir etiketten.
 */
export const collectTeacherNames = (
  entries: ScheduledEntry[],
  listed: string[] = []
): string[] => {
  const seen = new Map<string, string>();

  const add = (name: string) => {
    const key = normalizeTeacherName(name);
    if (!key || key === ALL_TEACHERS_TOKEN) return;
    if (!seen.has(key)) seen.set(key, name.trim());
  };

  listed.forEach(add);
  entries.forEach(entry => splitTeacherNames(entry.teacher).forEach(add));

  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'sv'));
};

type Grouped = {
  /** Första stavningen vi såg – används som etikett i listan. */
  label: string;
  intervalsByDay: Record<string, TimeInterval[]>;
};

/**
 * Grupperar poster per nyckel (t.ex. ämne eller lärare) och räknar ut hur
 * många minuter varje nyckel täcker. Överlapp inom samma nyckel och dag
 * räknas en gång; olika dagar summeras.
 *
 * `keysOf` får returnera flera nycklar per post – en lektion med två lärare
 * ger båda lärarna full tid. `normalizeKey` avgör vilka nycklar som slås
 * ihop till samma rad.
 */
const totalMinutesByKey = (
  entries: ScheduledEntry[],
  keysOf: (entry: ScheduledEntry) => string[],
  normalizeKey: (key: string) => string = key => key
): [string, number][] => {
  const groups = new Map<string, Grouped>();

  entries.forEach(entry => {
    const interval = {
      start: timeToMinutes(entry.startTime),
      end: timeToMinutes(entry.endTime),
    };

    keysOf(entry).forEach(key => {
      const normalized = normalizeKey(key);
      let group = groups.get(normalized);
      if (!group) {
        group = { label: key, intervalsByDay: {} };
        groups.set(normalized, group);
      }
      if (!group.intervalsByDay[entry.day]) {
        group.intervalsByDay[entry.day] = [];
      }
      group.intervalsByDay[entry.day].push(interval);
    });
  });

  return Array.from(groups.values())
    .map(group => {
      const minutes = Object.values(group.intervalsByDay)
        .reduce((sum, intervals) => sum + mergeIntervalMinutes(intervals), 0);
      return [group.label, minutes] as [string, number];
    })
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'));
};

/**
 * Skriver minuter som "17 tim, 15 min". Delar som är noll utelämnas, så jämna
 * timmar blir "18 tim" och en kort stund blir "45 min".
 */
export const formatMinutes = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const remaining = total % 60;

  if (hours === 0) return `${remaining} min`;
  if (remaining === 0) return `${hours} tim`;
  return `${hours} tim, ${remaining} min`;
};

/** Timmar per ämnestitel, med parallella lektioner räknade en gång. */
export const totalMinutesByTitle = (entries: ScheduledEntry[]): [string, number][] =>
  totalMinutesByKey(entries, entry => (entry.title ? [entry.title] : []));

/**
 * Timmar per lärare, med parallella lektioner räknade en gång. Poster utan
 * lärare hoppas över, och samma namn med olika versaler slås ihop.
 */
export const totalMinutesByTeacher = (entries: ScheduledEntry[]): [string, number][] =>
  totalMinutesByKey(
    entries,
    entry => splitTeacherNames(entry.teacher),
    key => key.toLocaleLowerCase('sv')
  );
