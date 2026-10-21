import { PLANNER_DAYS } from '@/config/plannerConstants';
import { mapPlannerActivitiesToSchedule } from '@/hooks/usePlannerSync';
import type { PlannerActivity } from '@/types/schedule';
import type { ScheduleExportInput } from '@/types/scheduleExport';
import type { LabLesson, LabState, LabTeam } from '@/types/lessonLab';
import { matchesExcludeList } from '@/utils/exportExclusions';
import { classTeamId, sortTeams, teamOwns } from '@/utils/lessonLab';
import { fixedActivities, temaTarget } from '@/utils/lessonLabArchive';
import { isAllTeachersField } from '@/utils/scheduleStats';
import type { PageMode } from '@/utils/schedulePdf/theme';
import { timeToMinutes } from '@/utils/scheduleTime';
import { countedTeachers } from '@/utils/termPlanner';

/**
 * Export av scheman från Arbetslag (docs/plans/arbetslag-export.md).
 *
 * Räknar fram vilka av basschemats pass ett arbetslag eller en lärare har,
 * ur upplägget när man trycker. Inget sparas, och planerarens urval rörs inte.
 *
 * - **Ett lag** har temapassen det äger i veckomallen.
 * - **En lärare** har temapassen från alla sina lag, de fasta passen där
 *   läraren står som lärare och passen med "Alla" som lärare.
 * - **Lunch** kommer med de dagar laget eller läraren har något annat pass.
 *   **Rast och paus** bara när de ligger mellan två av passen samma dag.
 *
 * Bara mallen och det enkla läget räknas: lärare per klass, egna veckor och
 * resurser från detaljvyn används inte.
 */

const LUNCH_TITLES = ['Lunch*'];
const BREAK_TITLES = ['Rast*', 'Paus*'];

const isLunch = (activity: PlannerActivity) => matchesExcludeList(activity.title, LUNCH_TITLES);
const isShortBreak = (activity: PlannerActivity) => matchesExcludeList(activity.title, BREAK_TITLES);
const isBreak = (activity: PlannerActivity) => isLunch(activity) || isShortBreak(activity);

const normalize = (name: string) => name.trim().toLocaleLowerCase('sv');
const slotKey = (day: string, start: string, end: string) => `${day}|${start}|${end}`;

/** Lagets namn i menyn och i rubriken: "Lag 3 Skrivande", eller bara "Arbetslag 3". */
export const teamLabel = (team: LabTeam) => {
  const name = team.name.trim();
  const fallback = `Arbetslag ${team.number}`;
  return !name || name === fallback ? fallback : `Lag ${team.number} ${name}`;
};

/** Mallens lektioner nycklade på dag och tid, som när mallen byggs ur arkivet. */
const lessonsBySlot = (state: LabState) =>
  new Map(state.template.map(lesson => [slotKey(lesson.day, lesson.start, lesson.end), lesson]));

/** Äger laget temapasset? Ett tema utan klass hör till varje lag som äger någon klass i lektionen. */
const ownsTema = (lesson: LabLesson, activity: PlannerActivity, classes: string[], teamId: string) => {
  const target = temaTarget(activity.title, classes);
  if (!target) return false;
  return target === 'all' ? teamOwns(lesson, classes, teamId) : classTeamId(lesson, target) === teamId;
};

const temaForTeams = (state: LabState, activities: PlannerActivity[], teamIds: Set<string>) => {
  const bySlot = lessonsBySlot(state);
  return activities.filter(activity => {
    const lesson = bySlot.get(slotKey(activity.day, activity.startTime, activity.endTime));
    if (!lesson) return false;
    return Array.from(teamIds).some(teamId => ownsTema(lesson, activity, state.classes, teamId));
  });
};

/**
 * Lunch de dagar det finns egna pass, rast och paus bara mellan två egna pass.
 * Ett pass "före" slutar senast när rasten börjar, ett "efter" börjar tidigast
 * när den slutar.
 */
const breaksAround = (own: PlannerActivity[], breaks: PlannerActivity[]) => breaks.filter(pause => {
  const sameDay = own.filter(a => a.day === pause.day);
  if (sameDay.length === 0) return false;
  if (isLunch(pause)) return true;
  const start = timeToMinutes(pause.startTime);
  const end = timeToMinutes(pause.endTime);
  return sameDay.some(a => timeToMinutes(a.endTime) <= start)
    && sameDay.some(a => timeToMinutes(a.startTime) >= end);
});

/** Lägger till rasterna och behåller arkivets ordning, med varje pass en gång. */
const withBreaks = (state: LabState, activities: PlannerActivity[], own: PlannerActivity[]) => {
  const breaks = fixedActivities(activities, state.classes).filter(isBreak);
  const ids = new Set([...own, ...breaksAround(own, breaks)].map(a => a.id));
  return activities.filter(a => ids.has(a.id));
};

/** Temapassen laget äger, plus lunch och raster runt dem. */
export const activitiesForTeam = (state: LabState, activities: PlannerActivity[], teamId: string) =>
  withBreaks(state, activities, temaForTeams(state, activities, new Set([teamId])));

/**
 * Temapassen från alla lärarens lag, de fasta passen med lärarens namn och
 * "Alla"-passen, plus lunch och raster runt dem. En lärare utan lag har inga pass.
 */
export const activitiesForTeacher = (state: LabState, activities: PlannerActivity[], teacherId: string) => {
  const teacher = state.teachers.find(t => t.id === teacherId);
  const teamIds = new Set(state.teams.filter(t => t.memberIds.includes(teacherId)).map(t => t.id));
  if (!teacher || teamIds.size === 0) return [];
  const name = normalize(teacher.name);
  const fixed = fixedActivities(activities, state.classes).filter(a => !isBreak(a) && (
    isAllTeachersField(a.teacher) || countedTeachers(a.teacher).some(n => normalize(n) === name)
  ));
  return withBreaks(state, activities, [...temaForTeams(state, activities, teamIds), ...fixed]);
};

// ── Menyn ──

export type LabExportSubject =
  | { kind: 'team'; id: string }
  | { kind: 'teacher'; id: string }
  | { kind: 'allTeams' }
  | { kind: 'allTeachers' };

export type LabExportTarget = {
  /** Värdet i menyns lista. */
  key: string;
  subject: LabExportSubject;
  label: string;
  /** Antal pass utom lunch och raster. Noll går inte att exportera. */
  passCount: number;
};

export type LabExportPage = { label: string; activities: PlannerActivity[] };

/** Lärarna som är med i något lag, i bokstavsordning. */
const teamTeachers = (state: LabState) => state.teachers
  .filter(t => !t.resource && state.teams.some(team => team.memberIds.includes(t.id)))
  .sort((a, b) => a.name.localeCompare(b.name, 'sv'));

const countOwn = (activities: PlannerActivity[]) => activities.filter(a => !isBreak(a)).length;

const teamPages = (state: LabState, activities: PlannerActivity[]): LabExportPage[] =>
  sortTeams(state.teams).map(team => ({ label: teamLabel(team), activities: activitiesForTeam(state, activities, team.id) }));

const teacherPages = (state: LabState, activities: PlannerActivity[]): LabExportPage[] =>
  teamTeachers(state).map(t => ({ label: t.name.trim(), activities: activitiesForTeacher(state, activities, t.id) }));

export const ALL_TEAMS_LABEL = 'Alla arbetslag';
export const ALL_TEACHERS_LABEL = 'Alla lärare';

/** Listan i menyn: "Alla"-valen först, sedan varje lag och varje lärare. */
export const exportTargets = (state: LabState, activities: PlannerActivity[]) => {
  const teams = teamPages(state, activities);
  const teachers = teacherPages(state, activities);
  const sortedTeams = sortTeams(state.teams);
  const sortedTeachers = teamTeachers(state);
  const sum = (pages: LabExportPage[]) => pages.reduce((total, page) => total + countOwn(page.activities), 0);
  return {
    all: [
      { key: 'all-teams', subject: { kind: 'allTeams' }, label: ALL_TEAMS_LABEL, passCount: sum(teams) },
      { key: 'all-teachers', subject: { kind: 'allTeachers' }, label: ALL_TEACHERS_LABEL, passCount: sum(teachers) },
    ] as LabExportTarget[],
    teams: teams.map((page, i): LabExportTarget => ({
      key: `team:${sortedTeams[i].id}`,
      subject: { kind: 'team', id: sortedTeams[i].id },
      label: page.label,
      passCount: countOwn(page.activities),
    })),
    teachers: teachers.map((page, i): LabExportTarget => ({
      key: `teacher:${sortedTeachers[i].id}`,
      subject: { kind: 'teacher', id: sortedTeachers[i].id },
      label: page.label,
      passCount: countOwn(page.activities),
    })),
  };
};

export const isAllSubject = (subject: LabExportSubject) =>
  subject.kind === 'allTeams' || subject.kind === 'allTeachers';

/**
 * Sidorna för ett val. Vid "Alla …" hoppas lag och lärare utan pass över, och
 * `skipped` säger vilka.
 */
export const pagesFor = (
  state: LabState,
  activities: PlannerActivity[],
  subject: LabExportSubject
): { label: string; pages: LabExportPage[]; skipped: string[] } => {
  switch (subject.kind) {
    case 'team': {
      const team = state.teams.find(t => t.id === subject.id);
      const label = team ? teamLabel(team) : 'Arbetslag';
      return { label, pages: [{ label, activities: activitiesForTeam(state, activities, subject.id) }], skipped: [] };
    }
    case 'teacher': {
      const label = state.teachers.find(t => t.id === subject.id)?.name.trim() || 'Lärare';
      return { label, pages: [{ label, activities: activitiesForTeacher(state, activities, subject.id) }], skipped: [] };
    }
    case 'allTeams':
    case 'allTeachers': {
      const all = subject.kind === 'allTeams' ? teamPages(state, activities) : teacherPages(state, activities);
      return {
        label: subject.kind === 'allTeams' ? ALL_TEAMS_LABEL : ALL_TEACHERS_LABEL,
        pages: all.filter(page => countOwn(page.activities) > 0),
        skipped: all.filter(page => countOwn(page.activities) === 0).map(page => page.label),
      };
    }
  }
};

/**
 * Lektioner i mallen med ett lag men utan temapass vid samma tid i arkivet.
 * Händer när arkivet ändrats efter att mallen byggdes; "Läs om schemat" rättar det.
 */
export const lessonsWithoutPass = (state: LabState, activities: PlannerActivity[]) => {
  const slots = new Set(activities
    .filter(a => temaTarget(a.title, state.classes) !== null)
    .map(a => slotKey(a.day, a.startTime, a.endTime)));
  return state.template.filter(lesson =>
    state.classes.some(c => classTeamId(lesson, c) !== null)
    && !slots.has(slotKey(lesson.day, lesson.start, lesson.end))
  ).length;
};

// ── Exportens indata ──

/** Rubriken och filnamnet, som planerarens urval: "Ht26 – Anna". */
export const exportTitle = (archiveName: string | null | undefined, label: string) =>
  `${archiveName?.trim() || 'Schema'} – ${label}`;

/**
 * Sista sluttiden i hela basschemat. Varje sida ritas till den, så att alla
 * sidor får basschemats skala och går att jämföra.
 */
export const baseScheduleEndMinutes = (activities: PlannerActivity[]): number | undefined => {
  const ends = activities
    .filter(a => (PLANNER_DAYS as readonly string[]).includes(a.day))
    .map(a => timeToMinutes(a.endTime))
    .filter(Number.isFinite);
  return ends.length > 0 ? Math.max(...ends) : undefined;
};

type InputOptions = {
  archiveName: string | null | undefined;
  /** Hela arkivet, för skalan. */
  activities: PlannerActivity[];
  resolveColor: ScheduleExportInput['resolveColor'];
  resolveRoom: ScheduleExportInput['resolveRoom'];
  pageMode: PageMode;
};

/** En exportsida per lag eller lärare, ritad som planerarens export. */
export const exportInputsFor = (pages: LabExportPage[], options: InputOptions): ScheduleExportInput[] => {
  const extraEndMinutes = baseScheduleEndMinutes(options.activities);
  return pages.map(page => ({
    schedule: mapPlannerActivitiesToSchedule(page.activities),
    isVisible: () => true,
    resolveColor: options.resolveColor,
    resolveRoom: options.resolveRoom,
    planningByDay: null,
    extraEndMinutes,
    archiveName: exportTitle(options.archiveName, page.label),
    pageMode: options.pageMode,
  }));
};
