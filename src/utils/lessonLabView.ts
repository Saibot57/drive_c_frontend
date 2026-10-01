import type { LabDay, LabLesson, LabState } from '@/types/lessonLab';
import {
  availableOn,
  BusyMap,
  busyDuring,
  classTeamId,
  isBeforeLunch,
  LabWarning,
  presentClasses,
  sortLessons,
  teamsInLesson,
} from '@/utils/lessonLab';
import { checkOverlap, timeToMinutes } from '@/utils/scheduleTime';

/**
 * Det som den enkla vyn i Arbetslag räknar fram för att visa upplägget:
 * tidsaxeln som alla dagar delar, var rutorna hamnar, bemanningen per
 * lektion och raden med status. Rena funktioner, så att de går att testa.
 */

// ── Tidsaxeln ──

export type Timeline = {
  /** Axelns början och slut, i minuter från midnatt. */
  start: number;
  end: number;
  /** Lunchen: från sista passet som börjar före tolv till första efter. */
  lunch: { start: number; end: number } | null;
  /** Hela timmar att skriva ut på axeln, i minuter. */
  hours: number[];
};

const DEFAULT_START = 8 * 60;
const DEFAULT_END = 15 * 60;
const STEP = 30;

/** En gemensam tidsaxel för alla dagar, så att samma klockslag står i samma höjd. */
export const timelineFor = (lessons: Pick<LabLesson, 'start' | 'end'>[]): Timeline => {
  if (lessons.length === 0) {
    return { start: DEFAULT_START, end: DEFAULT_END, lunch: null, hours: hoursBetween(DEFAULT_START, DEFAULT_END) };
  }
  const start = Math.floor(Math.min(...lessons.map(l => timeToMinutes(l.start))) / STEP) * STEP;
  const end = Math.ceil(Math.max(...lessons.map(l => timeToMinutes(l.end))) / STEP) * STEP;
  const morning = lessons.filter(isBeforeLunch);
  const afternoon = lessons.filter(l => !isBeforeLunch(l));
  const lunchStart = morning.length ? Math.max(...morning.map(l => timeToMinutes(l.end))) : null;
  const lunchEnd = afternoon.length ? Math.min(...afternoon.map(l => timeToMinutes(l.start))) : null;
  const lunch = lunchStart !== null && lunchEnd !== null && lunchEnd > lunchStart ? { start: lunchStart, end: lunchEnd } : null;
  return { start, end, lunch, hours: hoursBetween(start, end) };
};

const hoursBetween = (start: number, end: number) => {
  const hours: number[] = [];
  for (let h = Math.ceil(start / 60) * 60; h <= end; h += 60) if (h > start) hours.push(h);
  return hours;
};

/** Luften ovanför och nedanför lunchbandet, i minuter. Högst en fjärdedel av luckan. */
const LUNCH_AIR = 8;

/**
 * Dagens lunch: luckan mellan dagens sista förmiddagspass och första
 * eftermiddagspass, med lika mycket luft ovanför som nedanför. En dag utan
 * pass på ena sidan använder veckans gemensamma lunch för den sidan.
 */
export const dayLunch = (
  dayLessons: Pick<LabLesson, 'start' | 'end'>[],
  timeline: Pick<Timeline, 'lunch'>
): { start: number; end: number } | null => {
  if (!timeline.lunch) return null;
  const morning = dayLessons.filter(isBeforeLunch);
  const afternoon = dayLessons.filter(l => !isBeforeLunch(l));
  const start = morning.length ? Math.max(...morning.map(l => timeToMinutes(l.end))) : timeline.lunch.start;
  const end = afternoon.length ? Math.min(...afternoon.map(l => timeToMinutes(l.start))) : timeline.lunch.end;
  if (end <= start) return null;
  const air = Math.min(LUNCH_AIR, (end - start) / 4);
  return { start: start + air, end: end - air };
};

export type PlacedLesson = {
  lesson: LabLesson;
  /** Minuter från axelns början. */
  offset: number;
  minutes: number;
  /** Lektioner som krockar står bredvid varandra: kolumn och antal. */
  column: number;
  columns: number;
};

/** Var en dags lektioner hamnar på axeln. Lektioner som överlappar delar bredden. */
export const placeLessons = (lessons: LabLesson[], timeline: Pick<Timeline, 'start'>): PlacedLesson[] => {
  const sorted = sortLessons(lessons);
  const placed: PlacedLesson[] = [];
  let cluster: PlacedLesson[] = [];
  let clusterEnd = -Infinity;
  const columnEnds: number[] = [];

  const closeCluster = () => {
    const columns = Math.max(1, ...cluster.map(p => p.column + 1));
    cluster.forEach(p => { p.columns = columns; });
    cluster = [];
    clusterEnd = -Infinity;
    columnEnds.length = 0;
  };

  for (const lesson of sorted) {
    const start = timeToMinutes(lesson.start);
    const end = timeToMinutes(lesson.end);
    if (cluster.length && start >= clusterEnd) closeCluster();
    let column = columnEnds.findIndex(e => e <= start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = end;
    const item = { lesson, offset: start - timeline.start, minutes: end - start, column, columns: 1 };
    cluster.push(item);
    placed.push(item);
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length) closeCluster();
  return placed;
};

// ── Bemanning ──

export type TeamStaffing = {
  teamId: string;
  /** Klasserna laget äger i lektionen. */
  classes: string[];
  /** Lagets lärare som kan: tillgängliga dagen och utan fast pass samtidigt. */
  availableIds: string[];
};

/** Varje lags behov i lektionen mot lärarna som kan. */
export const lessonStaffing = (state: LabState, lesson: LabLesson, busy?: BusyMap): TeamStaffing[] => {
  const teachers = new Map(state.teachers.map(t => [t.id, t]));
  return Array.from(teamsInLesson(lesson, state.classes).entries()).flatMap(([teamId, classes]) => {
    const team = state.teams.find(t => t.id === teamId);
    if (!team) return [];
    const availableIds = team.memberIds.filter(id => {
      const teacher = teachers.get(id);
      return !!teacher && !teacher.resource && availableOn(teacher, lesson.day) && !busyDuring(busy, id, lesson);
    });
    return [{ teamId, classes, availableIds }];
  });
};

/** `short`: laget har för få lärare som kan. */
export const staffingLevel = (staffing: TeamStaffing): 'short' | 'ok' =>
  staffing.availableIds.length < staffing.classes.length ? 'short' : 'ok';

/**
 * Lärare i hela skolan som blir över under lektionen: de som kan dagen och
 * inte har ett fast pass samtidigt, minus en lärare per klass i lektionen
 * och i lektionerna som går samtidigt. Lagen kan ta varandras pass, så det
 * räcker att någon i skolan är ledig. Noll eller mindre: ingen kan hoppa in.
 */
export const lessonReserve = (state: LabState, lesson: LabLesson, lessons: LabLesson[], busy?: BusyMap): number => {
  const free = state.teachers.filter(t => !t.resource && availableOn(t, lesson.day) && !busyDuring(busy, t.id, lesson));
  const needed = lessons
    .filter(l => l.day === lesson.day && checkOverlap(l.start, l.end, lesson.start, lesson.end))
    .reduce((sum, l) => sum + presentClasses(l, state.classes).length, 0);
  return free.length - needed;
};

/** Kan läraren undervisa lektionen: med i ett lag som äger den, och kan då? */
export const canTeachLesson = (state: LabState, lesson: LabLesson, teacherId: string, busy?: BusyMap) =>
  lessonStaffing(state, lesson, busy).some(s => s.availableIds.includes(teacherId));

// ── Delade lektioner ──

export type ClassGroup = {
  /** Lagets id, eller `null` för klasser utan lag. */
  teamId: string | null;
  classes: string[];
  /** Klasser som inte har lektionen alls. */
  absent: boolean;
};

/** Klasserna i ordning, där grannar med samma lag blir en grupp. */
export const classGroups = (lesson: LabLesson, classes: string[]): ClassGroup[] => {
  const present = presentClasses(lesson, classes);
  const groups: ClassGroup[] = [];
  for (const className of classes) {
    const absent = !present.includes(className);
    const teamId = absent ? null : classTeamId(lesson, className);
    const last = groups[groups.length - 1];
    if (last && last.absent === absent && last.teamId === teamId) last.classes.push(className);
    else groups.push({ teamId, classes: [className], absent });
  }
  return groups;
};

// ── Status ──

export type PlanStatus = {
  lessonCount: number;
  /** Lektioner där varje närvarande klass har ett lag. */
  withTeam: number;
  errors: LabWarning[];
  warnings: LabWarning[];
  /** Lektioner där ingen lärare i skolan är ledig att hoppa in (och inget lag saknar lärare). */
  tight: LabLesson[];
};

/**
 * Upplägget i en rad. Lärare per klass sätts bara i detaljplanen, så att
 * de saknas räknas inte här.
 */
export const planStatus = (state: LabState, lessons: LabLesson[], allWarnings: LabWarning[], busy?: BusyMap): PlanStatus => {
  const noTeam = new Set(allWarnings.filter(w => w.kind === 'noTeam').map(w => w.lessonId));
  return {
    lessonCount: lessons.length,
    withTeam: lessons.filter(l => !noTeam.has(l.id)).length,
    errors: allWarnings.filter(w => w.severity === 'error'),
    warnings: allWarnings.filter(w => w.severity === 'warn'),
    tight: sortLessons(lessons).filter(l =>
      lessonReserve(state, l, lessons, busy) <= 0
      && !lessonStaffing(state, l, busy).some(s => staffingLevel(s) === 'short')),
  };
};

export type StaffingFix = {
  teamId: string;
  day: LabDay;
  lessonIds: string[];
  /** Läraren som föreslås gå med i laget. */
  teacherId: string;
};

/**
 * Förslag när ett lag har för få lärare en dag: den lärare utanför laget som
 * kan alla de lektionerna och har minst tid sedan tidigare.
 */
export const staffingFixes = (
  state: LabState,
  lessons: LabLesson[],
  totals: Map<string, number>,
  busy?: BusyMap
): StaffingFix[] => {
  const short = new Map<string, { teamId: string; day: LabDay; lessons: LabLesson[] }>();
  for (const lesson of sortLessons(lessons)) {
    for (const staffing of lessonStaffing(state, lesson, busy)) {
      if (staffingLevel(staffing) !== 'short') continue;
      const key = `${staffing.teamId}|${lesson.day}`;
      const entry = short.get(key) ?? { teamId: staffing.teamId, day: lesson.day, lessons: [] };
      entry.lessons.push(lesson);
      short.set(key, entry);
    }
  }
  return Array.from(short.values()).flatMap(({ teamId, day, lessons: affected }) => {
    const team = state.teams.find(t => t.id === teamId);
    const candidates = state.teachers
      .filter(t => !t.resource && !team?.memberIds.includes(t.id) && availableOn(t, day)
        && affected.every(l => !busyDuring(busy, t.id, l)))
      .sort((a, b) => (totals.get(a.id) ?? 0) - (totals.get(b.id) ?? 0) || a.name.localeCompare(b.name, 'sv'));
    return candidates.length ? [{ teamId, day, lessonIds: affected.map(l => l.id), teacherId: candidates[0].id }] : [];
  });
};
