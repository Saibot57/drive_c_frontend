import { DEFAULT_PLANNING_MIN_GAP_MINUTES, PLANNER_DAYS } from '@/components/schedule/constants';
import { ScheduledEntry, TeacherAvailability, TeacherDayBlock } from '@/types/schedule';
import { blocksWholeDay, FORENOON_END_MINUTES } from '@/utils/scheduleRules';
import { splitTeacherNames, TimeInterval } from '@/utils/scheduleStats';
import { END_HOUR, START_HOUR, timeToMinutes } from '@/utils/scheduleTime';

/** Ordet som slår om filterrutan från vanlig sökning till planeringsvy. */
export const PLANNING_KEYWORD = 'planering';

const GRID_START_MINUTES = START_HOUR * 60;
const GRID_END_MINUTES = END_HOUR * 60;

const normalize = (value: string) => value.trim().toLocaleLowerCase('sv');

/**
 * Lärarfältet är fritext och stavas sällan lika överallt. "Tobias" ska hitta
 * "Tobias Lundh" och tvärtom, därför räcker det att det ena namnet ryms i det
 * andra.
 */
const namesOverlap = (a: string, b: string): boolean => {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
};

// --- Tolkning av sökrutan ---

export type PlanningQuery = {
  isPlanning: boolean;
  /** Orden ur sökningen som träffade en lärare. Matchas mot posternas lärarfält. */
  terms: string[];
  /** Fullständiga namn ur lärarlistan. Nyckeln till spärrarna i debug-menyn. */
  teachers: string[];
  /** Ord som varken var nyckelordet eller träffade en lärare. */
  ignoredWords: string[];
};

const noPlanning = (): PlanningQuery => ({
  isPlanning: false,
  terms: [],
  teachers: [],
  ignoredWords: []
});

/**
 * Läser filterrutan och avgör om den ska tolkas som planeringssökning.
 * Nyckelordet ensamt räcker inte – det krävs minst ett ord som pekar ut en
 * lärare, så en kurs som faktiskt heter "Planering" fortfarande går att
 * filtrera fram på vanligt vis.
 */
export const parsePlanningQuery = (query: string, teachers: string[]): PlanningQuery => {
  if (!query.trim()) return noPlanning();

  const words = query.split(/[\s;+,]+/).map(word => word.trim()).filter(Boolean);
  if (!words.some(word => normalize(word) === PLANNING_KEYWORD)) return noPlanning();

  const terms: string[] = [];
  const matchedTeachers: string[] = [];
  const ignoredWords: string[] = [];

  words.forEach(word => {
    if (normalize(word) === PLANNING_KEYWORD) return;

    const hits = teachers.filter(teacher => namesOverlap(teacher, word));
    if (hits.length === 0) {
      ignoredWords.push(word);
      return;
    }

    terms.push(word);
    hits.forEach(teacher => {
      if (!matchedTeachers.includes(teacher)) matchedTeachers.push(teacher);
    });
  });

  if (matchedTeachers.length === 0) return noPlanning();

  return { isPlanning: true, terms, teachers: matchedTeachers, ignoredWords };
};

// --- Intervallräkning ---

/** Slår ihop överlappande och angränsande intervall till en sorterad lista. */
export const mergeIntervals = (intervals: TimeInterval[]): TimeInterval[] => {
  const sorted = intervals
    .filter(interval => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);

  const merged: TimeInterval[] = [];
  sorted.forEach(interval => {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
      return;
    }
    merged.push({ ...interval });
  });

  return merged;
};

/** Det som blir kvar av ramen när alla bortfall klippts ur. */
export const subtractIntervals = (frame: TimeInterval, cuts: TimeInterval[]): TimeInterval[] => {
  let remaining: TimeInterval[] = frame.end > frame.start ? [{ ...frame }] : [];

  mergeIntervals(cuts).forEach(cut => {
    const next: TimeInterval[] = [];
    remaining.forEach(part => {
      if (cut.end <= part.start || cut.start >= part.end) {
        next.push(part);
        return;
      }
      if (cut.start > part.start) next.push({ start: part.start, end: cut.start });
      if (cut.end < part.end) next.push({ start: cut.end, end: part.end });
    });
    remaining = next;
  });

  return remaining;
};

// --- Planeringstid ---

/**
 * Poster vars titel innehåller det här är ingens planeringstid och klipps bort
 * oavsett vem som står på dem. Lunchpass har oftast tomt lärarfält, så en regel
 * som krävde namnmatchning hade varit verkningslös.
 */
const NON_PLANNING_TITLE = 'lunch';

const isNonPlanningEntry = (entry: ScheduledEntry): boolean => (
  typeof entry.title === 'string' && normalize(entry.title).includes(NON_PLANNING_TITLE)
);

export type PlanningDayResult = {
  blocks: TimeInterval[];
  /** Hela dagen är spärrad för minst en av lärarna – dagen är ledig, inte fri. */
  isDayOff: boolean;
  totalMinutes: number;
};

type PlanningParams = {
  schedule: ScheduledEntry[];
  query: PlanningQuery;
  availability: TeacherAvailability;
  minGapMinutes: number;
};

const emptyDay = (isDayOff = false): PlanningDayResult => ({
  blocks: [],
  isDayOff,
  totalMinutes: 0
});

/**
 * Räknar ut de sammanhängande luckor där samtliga sökta lärare är fria.
 *
 * Arbetsdagens ram sätts av dagens första och sista post i hela schemat, inte
 * bara av de sökta lärarnas egna poster: slutar alla 15:00 är 15:00–17:00 inte
 * planeringstid. Ur ramen klipps de sökta lärarnas egna poster, deras spärrar
 * från debug-menyn och lunchen. Halvdagsspärrar delar dagen hårt vid 12:00.
 */
export const computePlanningForDay = (
  { schedule, query, availability, minGapMinutes }: PlanningParams,
  day: string
): PlanningDayResult => {
  if (!query.isPlanning) return emptyDay();

  const availabilityByKey = new Map<string, Record<string, TeacherDayBlock[]>>();
  Object.entries(availability).forEach(([teacher, days]) => {
    availabilityByKey.set(normalize(teacher), days);
  });

  const cuts: TimeInterval[] = [];
  let isDayOff = false;

  query.teachers.forEach(teacher => {
    const blocks = availabilityByKey.get(normalize(teacher))?.[day] ?? [];
    if (blocks.length === 0) return;
    if (blocksWholeDay(blocks)) {
      isDayOff = true;
      return;
    }
    if (blocks.includes('fm')) cuts.push({ start: GRID_START_MINUTES, end: FORENOON_END_MINUTES });
    if (blocks.includes('em')) cuts.push({ start: FORENOON_END_MINUTES, end: GRID_END_MINUTES });
  });

  // En ledig dag är ledig även när ingen annan har lektion, så det avgörs före
  // ramen räknas ut.
  if (isDayOff) return emptyDay(true);

  const dayEntries = schedule.filter(entry => entry.day === day);
  if (dayEntries.length === 0) return emptyDay();

  const frameStart = Math.max(
    GRID_START_MINUTES,
    Math.min(...dayEntries.map(entry => timeToMinutes(entry.startTime)))
  );
  const frameEnd = Math.min(
    GRID_END_MINUTES,
    Math.max(...dayEntries.map(entry => timeToMinutes(entry.endTime)))
  );
  if (frameEnd <= frameStart) return emptyDay();

  dayEntries.forEach(entry => {
    const names = splitTeacherNames(entry.teacher);
    const isBusy = names.some(name => query.terms.some(term => namesOverlap(name, term)));
    if (!isBusy && !isNonPlanningEntry(entry)) return;
    cuts.push({ start: timeToMinutes(entry.startTime), end: timeToMinutes(entry.endTime) });
  });

  const blocks = subtractIntervals({ start: frameStart, end: frameEnd }, cuts)
    .filter(block => block.end - block.start >= minGapMinutes);

  return {
    blocks,
    isDayOff: false,
    totalMinutes: blocks.reduce((sum, block) => sum + (block.end - block.start), 0)
  };
};

export const computePlanningByDay = (params: PlanningParams): Record<string, PlanningDayResult> => {
  const result: Record<string, PlanningDayResult> = {};
  PLANNER_DAYS.forEach(day => {
    result[day] = computePlanningForDay(params, day);
  });
  return result;
};

/** Tröskeln kommer från localStorage eller en importerad fil och kan vara skräp. */
export const sanitizePlanningMinGap = (input: unknown): number => {
  const value = typeof input === 'string' ? Number(input) : input;
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_PLANNING_MIN_GAP_MINUTES;
  return Math.min(240, Math.max(0, Math.round(value)));
};
