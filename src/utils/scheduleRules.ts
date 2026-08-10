import {
  RestrictionRule,
  ScheduledEntry,
  TeacherAvailability,
  TeacherDayBlock
} from '@/types/schedule';
import { isAllTeachersField, splitTeacherNames } from '@/utils/scheduleStats';
import { checkOverlap, timeToMinutes } from '@/utils/scheduleTime';

/** Posten som är på väg in i schemat, oavsett om den kommer från en byggsten eller flyttas. */
export type PlacementCandidate = {
  title: string;
  teacher?: string;
  day: string;
  startTime: string;
  endTime: string;
  instanceId?: string;
};

export type PlacementVerdict = {
  /** Sätt = placeringen stoppas. Ämnesregler är hårda. */
  blocked: string | null;
  /** Sätt = placeringen går igenom men användaren varnas. Lärarregler är mjuka. */
  warning: string | null;
};

// --- Ämnesregler ---

/** Mönster där `*` betyder "vad som helst". Skiftlägesokänsligt, hela strängen. */
export const wildcardMatch = (pattern: string, text: string): boolean => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$', 'i');
  return regex.test(text);
};

/**
 * Letar efter en ämnesregel som förbjuder att posten ligger samtidigt som
 * något annat samma dag. Returnerar felmeddelandet, eller null om det är fritt.
 */
export const findRestrictionConflict = (
  candidate: PlacementCandidate,
  schedule: ScheduledEntry[],
  rules: RestrictionRule[]
): string | null => {
  if (rules.length === 0) return null;

  const overlapping = schedule.filter(entry =>
    entry.day === candidate.day
    && entry.instanceId !== candidate.instanceId
    && checkOverlap(candidate.startTime, candidate.endTime, entry.startTime, entry.endTime)
  );

  for (const existing of overlapping) {
    for (const rule of rules) {
      const newMatchesA = wildcardMatch(rule.subjectA, candidate.title);
      const newMatchesB = wildcardMatch(rule.subjectB, candidate.title);
      const existingMatchesA = wildcardMatch(rule.subjectA, existing.title);
      const existingMatchesB = wildcardMatch(rule.subjectB, existing.title);

      if ((newMatchesA && existingMatchesB) || (newMatchesB && existingMatchesA)) {
        return `Krock! "${candidate.title}" krockar med "${existing.title}" (${existing.startTime}-${existing.endTime}).`;
      }
    }
  }

  return null;
};

// --- Lärartillgänglighet ---

/** Förmiddag är före 12:00, eftermiddag efter. */
export const FORENOON_END_MINUTES = 12 * 60;

const DAY_PART_LABEL: Record<'fm' | 'em', string> = {
  fm: 'förmiddag',
  em: 'eftermiddag'
};

const normalizeTeacherKey = (name: string) => name.trim().toLocaleLowerCase('sv');

const isDayBlock = (value: unknown): value is TeacherDayBlock => (
  value === 'all' || value === 'fm' || value === 'em'
);

/** Plockar bort skräp ur data som lästs från localStorage eller en JSON-fil. */
export const sanitizeTeacherAvailability = (input: unknown): TeacherAvailability => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const result: TeacherAvailability = {};

  Object.entries(input as Record<string, unknown>).forEach(([teacher, days]) => {
    if (!teacher.trim()) return;
    if (!days || typeof days !== 'object' || Array.isArray(days)) return;

    const cleanedDays: Record<string, TeacherDayBlock[]> = {};

    Object.entries(days as Record<string, unknown>).forEach(([day, blocks]) => {
      if (!Array.isArray(blocks)) return;
      const cleanedBlocks = Array.from(new Set(blocks.filter(isDayBlock)));
      if (cleanedBlocks.length > 0) {
        cleanedDays[day] = cleanedBlocks;
      }
    });

    if (Object.keys(cleanedDays).length > 0) {
      result[teacher] = cleanedDays;
    }
  });

  return result;
};

/** Hela dagen är spärrad både av 'all' och av att båda halvorna är valda. */
export const blocksWholeDay = (blocks: TeacherDayBlock[]): boolean => (
  blocks.includes('all') || (blocks.includes('fm') && blocks.includes('em'))
);

/**
 * Avgör vilken spärr en lektion krockar med. En halvdagsspärr gäller bara
 * lektioner som ryms helt inom halvan, så 11:00–13:00 passerar både en
 * förmiddags- och en eftermiddagsspärr men fastnar på en heldagsspärr.
 */
const matchingBlock = (
  blocks: TeacherDayBlock[],
  startMinutes: number,
  endMinutes: number
): TeacherDayBlock | null => {
  if (blocks.length === 0) return null;
  if (blocksWholeDay(blocks)) return 'all';
  if (blocks.includes('fm') && endMinutes <= FORENOON_END_MINUTES) return 'fm';
  if (blocks.includes('em') && startMinutes >= FORENOON_END_MINUTES) return 'em';
  return null;
};

/**
 * Letar efter lärare som inte är tillgängliga när posten ska ligga.
 * Lärarfältet kan innehålla flera namn separerade med komma; alla prövas.
 * Står "alla" där prövas hela lärarmängden i stället.
 */
export const findAvailabilityWarning = (
  candidate: PlacementCandidate,
  availability: TeacherAvailability,
  allTeachers: string[] = []
): string | null => {
  const teachers = isAllTeachersField(candidate.teacher)
    ? allTeachers
    : splitTeacherNames(candidate.teacher);
  if (teachers.length === 0) return null;

  const byKey = new Map<string, Record<string, TeacherDayBlock[]>>();
  Object.entries(availability).forEach(([teacher, days]) => {
    byKey.set(normalizeTeacherKey(teacher), days);
  });
  if (byKey.size === 0) return null;

  const startMinutes = timeToMinutes(candidate.startTime);
  const endMinutes = timeToMinutes(candidate.endTime);
  const dayLabel = candidate.day.toLocaleLowerCase('sv');

  const conflicts = teachers.reduce<{ teacher: string; when: string }[]>((collected, teacher) => {
    const blocks = byKey.get(normalizeTeacherKey(teacher))?.[candidate.day];
    if (!blocks) return collected;

    const block = matchingBlock(blocks, startMinutes, endMinutes);
    if (!block) return collected;

    collected.push({
      teacher,
      when: block === 'all' ? dayLabel : `${dayLabel} ${DAY_PART_LABEL[block]}`
    });
    return collected;
  }, []);

  if (conflicts.length === 0) return null;

  // En "alla"-post kan krocka med halva kollegiet. Fem hopfogade meningar läser
  // ingen, så längre listor summeras i stället.
  if (conflicts.length > 3) {
    return `${conflicts[0].teacher} och ${conflicts.length - 1} andra är inte tillgängliga ${dayLabel}`;
  }

  return conflicts
    .map(conflict => `${conflict.teacher} är inte tillgänglig ${conflict.when}`)
    .join('. ');
};

/** Samlad bedömning av en placering: hårda ämnesregler och mjuka lärarregler. */
export const evaluatePlacement = (
  candidate: PlacementCandidate,
  schedule: ScheduledEntry[],
  rules: RestrictionRule[],
  availability: TeacherAvailability,
  allTeachers: string[] = []
): PlacementVerdict => ({
  blocked: findRestrictionConflict(candidate, schedule, rules),
  warning: findAvailabilityWarning(candidate, availability, allTeachers)
});
