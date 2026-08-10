import { DEFAULT_PLANNING_MIN_GAP_MINUTES, PLANNER_DAYS } from '@/components/schedule/constants';
import { ScheduledEntry, TeacherAvailability, TeacherDayBlock } from '@/types/schedule';
import { blocksWholeDay, FORENOON_END_MINUTES } from '@/utils/scheduleRules';
import {
  ALL_TEACHERS_TOKEN,
  isAllTeachersField,
  splitTeacherNames,
  TimeInterval
} from '@/utils/scheduleStats';
import { END_HOUR, START_HOUR, timeToMinutes } from '@/utils/scheduleTime';

/** Ordet som slår om filterrutan från vanlig sökning till planeringsvy. */
export const PLANNING_KEYWORD = 'planering';

const GRID_START_MINUTES = START_HOUR * 60;
const GRID_END_MINUTES = END_HOUR * 60;

/** Tider utanför rutnätet går inte att rita, så de dras in till kanten. */
const clampToGrid = (minutes: number) => (
  Math.min(GRID_END_MINUTES, Math.max(GRID_START_MINUTES, minutes))
);

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
  /** Kort etikett för verktygsfältet: "alla lärare" i stället för tolv namn. */
  label: string;
};

/**
 * Lärarmängden kan innehålla samma person i två stavningar: "Tobias" ur schemat
 * och "Tobias Lundh" ur debug-menyn. Bara för etiketten behålls den längsta, så
 * det står en person och inte två. Beräkningen får behålla båda – där är en
 * dubblett harmlös, medan en felaktig sammanslagning kunde tappa en spärr.
 */
const collapseNameVariants = (names: string[]): string[] => names.filter(name => (
  !names.some(other => other !== name && normalize(other).includes(normalize(name)))
));

const noPlanning = (): PlanningQuery => ({
  isPlanning: false,
  terms: [],
  teachers: [],
  ignoredWords: [],
  label: ''
});

/**
 * Läser filterrutan och avgör om den ska tolkas som planeringssökning.
 * Nyckelordet ensamt räcker inte – det krävs minst ett ord som pekar ut en
 * lärare, så en kurs som faktiskt heter "Planering" fortfarande går att
 * filtrera fram på vanligt vis.
 *
 * `teachers` är hela lärarmängden, alltså debug-menyns lista plus namnen som
 * förekommer i schemat. Ordet "alla" pekar ut dem samtliga, så "alla planering"
 * ger tiden då hela kollegiet är fritt.
 */
export const parsePlanningQuery = (query: string, teachers: string[]): PlanningQuery => {
  if (!query.trim()) return noPlanning();

  const words = query.split(/[\s;+,]+/).map(word => word.trim()).filter(Boolean);
  if (!words.some(word => normalize(word) === PLANNING_KEYWORD)) return noPlanning();

  const terms: string[] = [];
  const matchedTeachers: string[] = [];
  const ignoredWords: string[] = [];
  let usedEveryone = false;

  const addTeacher = (teacher: string) => {
    if (!matchedTeachers.includes(teacher)) matchedTeachers.push(teacher);
  };

  words.forEach(word => {
    if (normalize(word) === PLANNING_KEYWORD) return;

    if (normalize(word) === ALL_TEACHERS_TOKEN) {
      // Namnen blir både sökbegrepp och nycklar, så snittet räknas mot varje
      // lärares egna poster och egna spärrar.
      teachers.forEach(teacher => {
        addTeacher(teacher);
        if (!terms.includes(teacher)) terms.push(teacher);
      });
      usedEveryone = teachers.length > 0;
      return;
    }

    const hits = teachers.filter(teacher => namesOverlap(teacher, word));
    if (hits.length === 0) {
      ignoredWords.push(word);
      return;
    }

    terms.push(word);
    hits.forEach(addTeacher);
  });

  if (matchedTeachers.length === 0) return noPlanning();

  return {
    isPlanning: true,
    terms,
    teachers: matchedTeachers,
    ignoredWords,
    label: usedEveryone ? 'alla lärare' : collapseNameVariants(matchedTeachers).join(', ')
  };
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

/**
 * Poster som tar allas tid, oavsett vem du söker på: lunchen, och poster med
 * "alla" under lärare (ATP, konferens). Den lärare du söker på ligger per
 * definition i lärarmängden, så en "alla"-post är alltid upptagen för hen –
 * mängden behöver inte skickas hit.
 */
const cutsForEveryone = (entry: ScheduledEntry): boolean => (
  (typeof entry.title === 'string' && normalize(entry.title).includes(NON_PLANNING_TITLE))
  || isAllTeachersField(entry.teacher)
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
  /** Ramens början. `null` = rutnätets början, alltså 08:00. */
  planningStartMinutes?: number | null;
  /** Ramens slut. `null` = dagens sista lektion, som förut. */
  planningEndMinutes?: number | null;
};

const emptyDay = (isDayOff = false): PlanningDayResult => ({
  blocks: [],
  isDayOff,
  totalMinutes: 0
});

/**
 * Räknar ut de sammanhängande luckor där samtliga sökta lärare är fria.
 *
 * Arbetsdagen börjar när rutnätet börjar och slutar med dagens sista post i
 * hela schemat, inte bara de sökta lärarnas: slutar alla 15:00 är 15:00–17:00
 * inte planeringstid. Båda gränserna går att sätta för hand i debug-menyn, och
 * en satt gräns är hård – den både förlänger och kapar.
 *
 * Ur ramen klipps de sökta lärarnas egna poster, deras spärrar från debug-menyn,
 * lunchen och poster som gäller alla. Halvdagsspärrar delar dagen hårt vid 12:00.
 */
export const computePlanningForDay = (
  {
    schedule,
    query,
    availability,
    minGapMinutes,
    planningStartMinutes = null,
    planningEndMinutes = null
  }: PlanningParams,
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

  const frameStart = clampToGrid(planningStartMinutes ?? GRID_START_MINUTES);

  // Utan satt sluttid och utan poster finns inget slut att räkna mot, och då
  // finns ingen planeringstid – till skillnad från början, som alltid är känd.
  const lastEntryEnd = dayEntries.length > 0
    ? Math.max(...dayEntries.map(entry => timeToMinutes(entry.endTime)))
    : null;
  const frameEnd = planningEndMinutes ?? lastEntryEnd;
  if (frameEnd === null) return emptyDay();

  const clampedEnd = clampToGrid(frameEnd);
  if (clampedEnd <= frameStart) return emptyDay();

  dayEntries.forEach(entry => {
    const names = splitTeacherNames(entry.teacher);
    const isBusy = names.some(name => query.terms.some(term => namesOverlap(name, term)));
    if (!isBusy && !cutsForEveryone(entry)) return;
    cuts.push({ start: timeToMinutes(entry.startTime), end: timeToMinutes(entry.endTime) });
  });

  const blocks = subtractIntervals({ start: frameStart, end: clampedEnd }, cuts)
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

/**
 * Läser ett klockslag ur debug-menyn till minuter. "16", "16:00" och "16.00"
 * duger alla; tomt och skräp ger `null`, vilket betyder att standarden gäller.
 * Resultatet klamras till rutnätet.
 */
export const sanitizePlanningTime = (input: unknown): number | null => {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? clampToGrid(Math.round(input)) : null;
  }
  if (typeof input !== 'string') return null;

  const text = input.trim();
  if (!text) return null;

  const match = text.match(/^(\d{1,2})(?:[:.](\d{1,2}))?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (hours > 23 || minutes > 59) return null;

  return clampToGrid(hours * 60 + minutes);
};

/** Tröskeln kommer från localStorage eller en importerad fil och kan vara skräp. */
export const sanitizePlanningMinGap = (input: unknown): number => {
  const value = typeof input === 'string' ? Number(input) : input;
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_PLANNING_MIN_GAP_MINUTES;
  return Math.min(240, Math.max(0, Math.round(value)));
};
