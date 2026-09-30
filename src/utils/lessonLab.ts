import { COURSE_COLOR_PALETTE, PLANNER_DAYS } from '@/config/plannerConstants';
import { LAB_SEED } from '@/config/lessonLabSeed';
import type { LabArea, LabDay, LabLesson, LabState, LabTeacher, LabTeam, LabWeek } from '@/types/lessonLab';
import { checkOverlap, timeToMinutes } from '@/utils/scheduleTime';

/**
 * Logiken bakom veckolabbet: tvätt av sparat läge, varningar och summeringar.
 * Allt är rena funktioner, så att komponenterna bara ritar.
 */

export const LAB_DAYS: readonly LabDay[] = PLANNER_DAYS;

/** Lektioner som börjar före tolv räknas till förmiddagen, som på tavlan. */
const LUNCH_MINUTES = 12 * 60;

/** Färger för arbetsgrupper och områden. Vitt hoppas över, det syns inte. */
export const LAB_COLORS: readonly string[] = COURSE_COLOR_PALETTE.filter(color => color !== '#ffffff');

export const isBeforeLunch = (lesson: Pick<LabLesson, 'start'>) => timeToMinutes(lesson.start) < LUNCH_MINUTES;

export const lessonMinutes = (lesson: Pick<LabLesson, 'start' | 'end'>) =>
  Math.max(0, timeToMinutes(lesson.end) - timeToMinutes(lesson.start));

export const sortLessons = (lessons: LabLesson[]) => [...lessons].sort((a, b) =>
  LAB_DAYS.indexOf(a.day) - LAB_DAYS.indexOf(b.day)
  || timeToMinutes(a.start) - timeToMinutes(b.start)
  || timeToMinutes(a.end) - timeToMinutes(b.end));

export const nextColor = (color: string) => {
  const index = LAB_COLORS.indexOf(color);
  return LAB_COLORS[(index + 1) % LAB_COLORS.length];
};

/** "90 min" eller "2 h 45 min". */
export const formatMinutes = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

// ── Tvätt ──
//
// Läget ligger i localStorage och kan importeras från en fil, så det kan
// innehålla vad som helst. Allt som pekar på något som inte finns (en borttagen
// lärare i en arbetsgrupp, ett område som inte finns kvar) nollas i stället
// för att ligga kvar och ge konstiga varningar.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const isTime = (value: unknown): value is string => typeof value === 'string' && TIME_PATTERN.test(value);
const isDay = (value: unknown): value is LabDay => typeof value === 'string' && (LAB_DAYS as readonly string[]).includes(value);

const uniqueById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter(item => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const cleanTeacher = (raw: unknown): LabTeacher | null => {
  if (!isRecord(raw)) return null;
  const name = str(raw.name).trim();
  if (!name) return null;
  const rawDays = Array.isArray(raw.days) ? raw.days : [];
  const days = LAB_DAYS.filter(day => rawDays.includes(day));
  return { id: str(raw.id), name, days, resource: raw.resource === true };
};

const cleanColor = (value: unknown) => {
  const color = str(value);
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : LAB_COLORS[0];
};

const cleanLesson = (
  raw: unknown,
  classes: string[],
  plannable: Set<string>,
  teamIds: Set<string>,
  areaIds: Set<string>
): LabLesson | null => {
  if (!isRecord(raw) || !isDay(raw.day) || !isTime(raw.start) || !isTime(raw.end)) return null;
  if (timeToMinutes(raw.end) <= timeToMinutes(raw.start)) return null;
  const rawClasses = isRecord(raw.classTeachers) ? raw.classTeachers : {};
  const classTeachers: Record<string, string | null> = {};
  for (const name of classes) {
    const teacher = rawClasses[name];
    if (typeof teacher === 'string' && plannable.has(teacher)) classTeachers[name] = teacher;
  }
  const areaId = str(raw.areaId);
  const teamId = str(raw.teamId);
  const split = raw.split === true;
  const absent = Array.isArray(raw.absentClasses)
    ? classes.filter(c => (raw.absentClasses as unknown[]).includes(c))
    : [];
  // En lektion utan en enda klass är ingen lektion.
  if (absent.length === classes.length) return null;
  const rawTeams = isRecord(raw.classTeams) ? raw.classTeams : {};
  const classTeams: Record<string, string | null> = {};
  if (split) {
    for (const name of classes) {
      const team = rawTeams[name];
      classTeams[name] = typeof team === 'string' && teamIds.has(team) ? team : null;
    }
  }
  return {
    id: str(raw.id),
    day: raw.day,
    start: raw.start,
    end: raw.end,
    title: str(raw.title),
    areaId: areaIds.has(areaId) ? areaId : null,
    teamId: !split && teamIds.has(teamId) ? teamId : null,
    split,
    classTeams,
    classTeachers,
    ...(absent.length > 0 ? { absentClasses: absent } : {}),
  };
};

/**
 * Ett giltigt läge ur okänd indata, eller `null` om indatan inte ens liknar
 * ett labbläge. Används både för localStorage och för importerade filer.
 */
export const parseLabState = (raw: unknown): LabState | null => {
  if (!isRecord(raw) || raw.version !== 1) return null;

  const classes = Array.isArray(raw.classes)
    ? Array.from(new Set(raw.classes.filter((c): c is string => typeof c === 'string' && c.trim() !== '').map(c => c.trim())))
    : [];
  if (classes.length === 0) return null;

  const teachers = uniqueById((Array.isArray(raw.teachers) ? raw.teachers : []).map(cleanTeacher).filter((t): t is LabTeacher => t !== null));
  // En resurs kan inte sitta i en arbetsgrupp eller ha en klass.
  const plannable = new Set(teachers.filter(t => !t.resource).map(t => t.id));

  const areas: LabArea[] = uniqueById((Array.isArray(raw.areas) ? raw.areas : []).flatMap(a => {
    if (!isRecord(a) || !str(a.name).trim()) return [];
    const goal = typeof a.goalMinutes === 'number' && Number.isFinite(a.goalMinutes) && a.goalMinutes > 0
      ? Math.round(a.goalMinutes)
      : null;
    return [{ id: str(a.id), name: str(a.name).trim(), color: cleanColor(a.color), goalMinutes: goal }];
  }));

  const teams: LabTeam[] = uniqueById((Array.isArray(raw.teams) ? raw.teams : []).flatMap(t => {
    if (!isRecord(t)) return [];
    const members = Array.isArray(t.memberIds)
      ? Array.from(new Set(t.memberIds.filter((id): id is string => typeof id === 'string' && plannable.has(id))))
      : [];
    return [{ id: str(t.id), name: str(t.name).trim() || 'Arbetsgrupp', color: cleanColor(t.color), memberIds: members }];
  }));

  const teamIds = new Set(teams.map(t => t.id));
  const areaIds = new Set(areas.map(a => a.id));
  const lessonsFrom = (list: unknown) => uniqueById(
    (Array.isArray(list) ? list : [])
      .map(l => cleanLesson(l, classes, plannable, teamIds, areaIds))
      .filter((l): l is LabLesson => l !== null)
  );

  const weeks: LabWeek[] = uniqueById((Array.isArray(raw.weeks) ? raw.weeks : []).flatMap(w => {
    if (!isRecord(w)) return [];
    return [{ id: str(w.id), label: str(w.label).trim() || 'Vecka', lessons: lessonsFrom(w.lessons) }];
  }));

  const archiveId = typeof raw.archiveId === 'string' && raw.archiveId ? raw.archiveId : null;
  return { version: 1, classes, teachers, teams, areas, template: lessonsFrom(raw.template), weeks, archiveId };
};

/** Som `parseLabState`, men faller tillbaka på tavlan. För localStorage. */
export const sanitizeLabState = (raw: unknown): LabState => parseLabState(raw) ?? LAB_SEED;

/**
 * Städar efter en ändring i lärarlistan: en lärare som tagits bort eller
 * blivit resurs försvinner ur arbetsgrupper och klasser.
 */
export const pruneReferences = (state: LabState): LabState => parseLabState(state) ?? state;

// ── Veckor ──

export const TEMPLATE_VIEW = 'mall';

export const lessonsForView = (state: LabState, viewId: string): LabLesson[] =>
  viewId === TEMPLATE_VIEW ? state.template : state.weeks.find(w => w.id === viewId)?.lessons ?? state.template;

/** Byter ut lektionerna i mallen eller i en vecka. */
export const withLessons = (state: LabState, viewId: string, lessons: LabLesson[]): LabState => (
  viewId === TEMPLATE_VIEW
    ? { ...state, template: lessons }
    : { ...state, weeks: state.weeks.map(w => (w.id === viewId ? { ...w, lessons } : w)) }
);

/** En ny vecka som kopia av mallen. Lektionerna behåller mallens id. */
export const weekFromTemplate = (state: LabState, id: string, label: string): LabWeek => ({
  id,
  label,
  lessons: state.template.map(lesson => ({
    ...lesson,
    classTeams: { ...lesson.classTeams },
    classTeachers: { ...lesson.classTeachers },
  })),
});

// ── Arbetsgrupper per klass ──

/** Klasserna som har lektionen. Oftast alla. */
export const presentClasses = (lesson: LabLesson, classes: string[]): string[] =>
  lesson.absentClasses?.length ? classes.filter(c => !lesson.absentClasses!.includes(c)) : classes;

const isAbsent = (lesson: LabLesson, className: string) => lesson.absentClasses?.includes(className) ?? false;

/** Arbetsgruppen som äger en klass i lektionen. */
export const classTeamId = (lesson: LabLesson, className: string): string | null => {
  if (isAbsent(lesson, className)) return null;
  return lesson.split ? lesson.classTeams[className] ?? null : lesson.teamId;
};

/** Arbetsgrupperna i lektionen, med klasserna var och en äger. */
export const teamsInLesson = (lesson: LabLesson, classes: string[]): Map<string, string[]> => {
  const result = new Map<string, string[]>();
  classes.forEach(className => {
    const teamId = classTeamId(lesson, className);
    if (teamId) result.set(teamId, [...(result.get(teamId) ?? []), className]);
  });
  return result;
};

/** Äger arbetsgruppen någon klass i lektionen? */
export const teamOwns = (lesson: LabLesson, classes: string[], teamId: string) =>
  classes.some(className => classTeamId(lesson, className) === teamId);

/** Delar en lektion så att klasserna kan få var sin arbetsgrupp. */
export const splitLesson = (lesson: LabLesson, classes: string[]): LabLesson => (
  lesson.split ? lesson : {
    ...lesson,
    split: true,
    teamId: null,
    classTeams: Object.fromEntries(presentClasses(lesson, classes).map(c => [c, lesson.teamId])),
  }
);

/**
 * Gör en delad lektion hel igen. Har alla klasser samma arbetsgrupp behålls
 * den, annars blir lektionen utan arbetsgrupp.
 */
export const mergeLesson = (lesson: LabLesson, classes: string[]): LabLesson => {
  if (!lesson.split) return lesson;
  const teams = new Set(presentClasses(lesson, classes).map(c => lesson.classTeams[c] ?? null));
  return { ...lesson, split: false, classTeams: {}, teamId: teams.size === 1 ? Array.from(teams)[0] : null };
};

/**
 * Ger hela lektionen, eller en klass i den, en arbetsgrupp (`null` tar bort).
 * En delad lektion där alla klasser hamnar i samma arbetsgrupp blir hel igen.
 */
export const assignTeam = (
  lesson: LabLesson,
  classes: string[],
  teamId: string | null,
  className?: string
): LabLesson => {
  if (!className) return { ...lesson, split: false, classTeams: {}, teamId };
  if (isAbsent(lesson, className)) return lesson;
  const base = splitLesson(lesson, classes);
  const next = { ...base, classTeams: { ...base.classTeams, [className]: teamId } };
  const teams = new Set(presentClasses(lesson, classes).map(c => next.classTeams[c] ?? null));
  return teamId && teams.size === 1 ? mergeLesson(next, classes) : next;
};

/**
 * Flyttar de klasser en arbetsgrupp äger i lektionen till en annan grupp
 * (`null` = ingen). Äger gruppen hela lektionen flyttas den hel.
 */
export const reassignTeam = (
  lesson: LabLesson,
  classes: string[],
  fromTeamId: string,
  toTeamId: string | null
): LabLesson => {
  const owned = teamsInLesson(lesson, classes).get(fromTeamId) ?? [];
  if (owned.length === 0) return lesson;
  if (!lesson.split) return assignTeam(lesson, classes, toTeamId);
  return owned.reduce((current, className) => assignTeam(current, classes, toTeamId, className), lesson);
};

// ── Varningar ──

export type LabWarningKind =
  | 'unavailable'
  | 'busy'
  | 'double'
  | 'shortTeam'
  | 'outsideTeam'
  | 'unassigned'
  | 'noTeam';

export type LabWarning = {
  kind: LabWarningKind;
  /** error = går inte att genomföra, warn = bör ses över, info = ofullständigt. */
  severity: 'error' | 'warn' | 'info';
  lessonId: string;
  teacherId?: string;
  /** Hela meningen, med dag och tid först. */
  message: string;
  /** Samma mening utan dag och tid, för lektionskortet. */
  detail: string;
};

const WARNING_ORDER: Record<LabWarning['severity'], number> = { error: 0, warn: 1, info: 2 };

const lessonLabel = (lesson: LabLesson) =>
  `${lesson.day.slice(0, 3)} ${lesson.start}${lesson.title ? ` (${lesson.title})` : ''}`;

export const availableOn = (teacher: LabTeacher, day: LabDay) => teacher.days.includes(day);

/** Tider då en lärare redan har en fast lektion, per lärar-id. */
export type BusyMap = Map<string, { day: LabDay; start: string; end: string; title: string }[]>;

/** Den fasta lektion läraren har under lektionen, om någon. */
export const busyDuring = (busy: BusyMap | undefined, teacherId: string, lesson: LabLesson) =>
  busy?.get(teacherId)?.find(b => b.day === lesson.day && checkOverlap(b.start, b.end, lesson.start, lesson.end));

export const labWarnings = (state: LabState, lessons: LabLesson[], busy?: BusyMap): LabWarning[] => {
  const teachers = new Map(state.teachers.map(t => [t.id, t]));
  const teams = new Map(state.teams.map(t => [t.id, t]));
  const warnings: LabWarning[] = [];
  const name = (id: string) => teachers.get(id)?.name ?? 'Okänd lärare';
  const push = (warning: Omit<LabWarning, 'message' | 'detail'>, lesson: LabLesson, detail: string) =>
    warnings.push({ ...warning, message: `${lessonLabel(lesson)}: ${detail}`, detail });

  for (const lesson of lessons) {
    const present = presentClasses(lesson, state.classes);
    const withoutTeam = present.filter(c => !teams.has(classTeamId(lesson, c) ?? ''));
    if (withoutTeam.length === present.length) {
      push({ kind: 'noTeam', severity: 'info', lessonId: lesson.id }, lesson, 'Ingen arbetsgrupp.');
    } else if (withoutTeam.length > 0) {
      push({ kind: 'noTeam', severity: 'info', lessonId: lesson.id }, lesson, `Ingen arbetsgrupp för ${withoutTeam.join(', ')}.`);
    }

    // En arbetsgrupp behöver en tillgänglig lärare per klass den äger här.
    teamsInLesson(lesson, state.classes).forEach((owned, teamId) => {
      const team = teams.get(teamId);
      if (!team) return;
      // En lärare med en fast lektion samtidigt kan inte ta en klass här.
      const available = team.memberIds.filter(id => {
        const teacher = teachers.get(id);
        return teacher && availableOn(teacher, lesson.day) && !busyDuring(busy, id, lesson);
      });
      if (available.length < owned.length) {
        push({ kind: 'shortTeam', severity: 'warn', lessonId: lesson.id }, lesson,
          `${team.name} har ${available.length} tillgängliga lärare till ${owned.length} ${owned.length === 1 ? 'klass' : 'klasser'}.`);
      }
    });

    const missing = present.filter(c => !lesson.classTeachers[c]);
    if (missing.length > 0) {
      push({ kind: 'unassigned', severity: 'info', lessonId: lesson.id }, lesson, `Ingen lärare för ${missing.join(', ')}.`);
    }

    for (const className of present) {
      const teacherId = lesson.classTeachers[className];
      if (!teacherId) continue;
      const teacher = teachers.get(teacherId);
      if (teacher && !availableOn(teacher, lesson.day)) {
        push({ kind: 'unavailable', severity: 'error', lessonId: lesson.id, teacherId }, lesson,
          `${teacher.name} är inte tillgänglig på ${lesson.day.toLowerCase()}.`);
      }
      const fixed = busyDuring(busy, teacherId, lesson);
      if (teacher && fixed) {
        push({ kind: 'busy', severity: 'error', lessonId: lesson.id, teacherId }, lesson,
          `${teacher.name} har ${fixed.title} samtidigt.`);
      }
      const team = teams.get(classTeamId(lesson, className) ?? '');
      if (team && !team.memberIds.includes(teacherId)) {
        push({ kind: 'outsideTeam', severity: 'warn', lessonId: lesson.id, teacherId }, lesson,
          `${name(teacherId)} har ${className} men är inte med i ${team.name}.`);
      }
    }
  }

  // Dubbelbokning: samma lärare i två klasser samtidigt, i samma lektion
  // eller i två lektioner som överlappar.
  const placements = lessons.flatMap(lesson => presentClasses(lesson, state.classes)
    .filter(c => lesson.classTeachers[c])
    .map(c => ({ lesson, className: c, teacherId: lesson.classTeachers[c] as string })));
  const reported = new Set<string>();
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i];
      const b = placements[j];
      if (a.teacherId !== b.teacherId || a.lesson.day !== b.lesson.day) continue;
      if (!checkOverlap(a.lesson.start, a.lesson.end, b.lesson.start, b.lesson.end)) continue;
      for (const p of [a, b]) {
        const key = `${p.lesson.id}|${p.teacherId}`;
        if (reported.has(key)) continue;
        reported.add(key);
        push({ kind: 'double', severity: 'error', lessonId: p.lesson.id, teacherId: p.teacherId }, p.lesson,
          `${name(p.teacherId)} har två klasser samtidigt.`);
      }
    }
  }

  const order = new Map(sortLessons(lessons).map((l, i) => [l.id, i]));
  return warnings.sort((a, b) =>
    WARNING_ORDER[a.severity] - WARNING_ORDER[b.severity]
    || (order.get(a.lessonId) ?? 0) - (order.get(b.lessonId) ?? 0));
};

// ── Summeringar ──

export type TeacherSummary = {
  teacher: LabTeacher;
  /** Undervisade minuter. En lektion räknas en gång även om läraren står på två klasser. */
  minutes: number;
  lessonCount: number;
  byArea: Record<string, number>;
  /** Lektioner som ägs av en arbetsgrupp läraren är med i: det läraren planerar. */
  ownedLessons: number;
  teamIds: string[];
};

export const teacherSummaries = (state: LabState, lessons: LabLesson[]): TeacherSummary[] =>
  state.teachers.filter(t => !t.resource).map(teacher => {
    const teaching = lessons.filter(l => presentClasses(l, state.classes).some(c => l.classTeachers[c] === teacher.id));
    const byArea: Record<string, number> = {};
    teaching.forEach(l => {
      const key = l.areaId ?? '';
      byArea[key] = (byArea[key] ?? 0) + lessonMinutes(l);
    });
    const teamIds = state.teams.filter(team => team.memberIds.includes(teacher.id)).map(team => team.id);
    return {
      teacher,
      minutes: teaching.reduce((sum, l) => sum + lessonMinutes(l), 0),
      lessonCount: teaching.length,
      byArea,
      ownedLessons: lessons.filter(l => teamIds.some(id => teamOwns(l, state.classes, id))).length,
      teamIds,
    };
  });

/** Minuter per klass och område. Nyckeln `''` är lektioner utan område. */
export const classAreaMinutes = (state: LabState, lessons: LabLesson[]): Record<string, Record<string, number>> => {
  const result: Record<string, Record<string, number>> = {};
  for (const className of state.classes) {
    const row: Record<string, number> = {};
    lessons.forEach(l => {
      if (!presentClasses(l, state.classes).includes(className)) return;
      const key = l.areaId ?? '';
      row[key] = (row[key] ?? 0) + lessonMinutes(l);
    });
    result[className] = row;
  }
  return result;
};

export type TeamSummary = {
  team: LabTeam;
  /** Lektioner där arbetsgruppen äger minst en klass. */
  lessonCount: number;
  /** Lektion × klass som arbetsgruppen äger. En hel lektion är tre klasspass. */
  classPasses: number;
  /** Tiden i schemat: lektionernas längd, en gång per lektion. */
  minutes: number;
  /** Tillgängliga medlemmar per dag. */
  availableByDay: Record<LabDay, number>;
};

export const teamSummaries = (state: LabState, lessons: LabLesson[]): TeamSummary[] => {
  const teachers = new Map(state.teachers.map(t => [t.id, t]));
  return state.teams.map(team => {
    const owned = lessons.filter(l => teamOwns(l, state.classes, team.id));
    const classPasses = owned.reduce((sum, l) => sum + (teamsInLesson(l, state.classes).get(team.id)?.length ?? 0), 0);
    const availableByDay = Object.fromEntries(LAB_DAYS.map(day => [
      day,
      team.memberIds.filter(id => {
        const teacher = teachers.get(id);
        return teacher ? availableOn(teacher, day) : false;
      }).length,
    ])) as Record<LabDay, number>;
    return { team, lessonCount: owned.length, classPasses, minutes: owned.reduce((s, l) => s + lessonMinutes(l), 0), availableByDay };
  });
};

/**
 * Varje lärares undervisningstid i temat, i minuter, räknad i klasspass: varje
 * klass behöver en egen lärare hela lektionen, så en hel lektion med tre
 * klasser är tre lärarpass.
 *
 * - En klass där man satt en lärare (detaljplanen) ger den läraren hela
 *   lektionen, precis som i schemaplaneraren.
 * - Övriga klasser fördelas jämnt på arbetsgruppens medlemmar som kan den
 *   dagen: tillgängliga, utan en fast lektion samtidigt och inte redan satta
 *   på en annan klass i lektionen. Fyra lärare till tre klasser ger ¾ av
 *   lektionen var, i genomsnitt över veckorna.
 * - Ingen får mer än lektionens längd från samma lektion: man kan bara vara i
 *   ett rum i taget. Klasser som blir över saknar lärare (den röda pricken).
 */
export const teacherTeachingMinutes = (
  state: LabState,
  lessons: LabLesson[],
  busy?: BusyMap
): Map<string, number> => {
  const teachers = new Map(state.teachers.map(t => [t.id, t]));
  const teams = new Map(state.teams.map(t => [t.id, t]));
  const total = new Map<string, number>();

  for (const lesson of lessons) {
    const minutes = lessonMinutes(lesson);
    const present = presentClasses(lesson, state.classes);
    const inLesson = new Map<string, number>();

    // Satta lärare: hela lektionen, en gång även om läraren står på två klasser.
    const placed = new Set<string>();
    present.forEach(c => { const t = lesson.classTeachers[c]; if (t) placed.add(t); });
    placed.forEach(id => inLesson.set(id, minutes));

    // Klasser utan satt lärare, per arbetsgrupp.
    const open = new Map<string, number>();
    present.forEach(c => {
      if (lesson.classTeachers[c]) return;
      const teamId = classTeamId(lesson, c);
      if (teamId) open.set(teamId, (open.get(teamId) ?? 0) + 1);
    });
    open.forEach((classCount, teamId) => {
      const eligible = (teams.get(teamId)?.memberIds ?? []).filter(id => {
        const teacher = teachers.get(id);
        return teacher && !teacher.resource && availableOn(teacher, lesson.day)
          && !busyDuring(busy, id, lesson) && !placed.has(id);
      });
      if (eligible.length === 0) return;
      const share = minutes * Math.min(1, classCount / eligible.length);
      eligible.forEach(id => inLesson.set(id, (inLesson.get(id) ?? 0) + share));
    });

    inLesson.forEach((value, id) => total.set(id, (total.get(id) ?? 0) + Math.min(value, minutes)));
  }
  return total;
};

/** Timmar med en decimal: "1 h", "1,5 h", "0,7 h". */
export const formatHours = (minutes: number) =>
  `${(Math.round(minutes / 6) / 10).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} h`;

// ── Hjälp vid fördelning ──

/** Lärare som redan har en klass i en annan lektion som överlappar. */
const busyTeachers = (lessons: LabLesson[], target: LabLesson, classes: string[]) => {
  const busy = new Set<string>();
  lessons.forEach(l => {
    if (l.id === target.id || l.day !== target.day) return;
    if (!checkOverlap(l.start, l.end, target.start, target.end)) return;
    classes.forEach(c => { const t = l.classTeachers[c]; if (t) busy.add(t); });
  });
  return busy;
};

/**
 * Fyller klasser utan lärare med arbetsgruppens medlemmar: de som är
 * tillgängliga den dagen, inte redan har en klass i lektionen och inte är
 * upptagna i en annan lektion samtidigt. Klasser som redan har lärare rörs inte.
 */
export const fillFromTeam = (
  state: LabState,
  lessons: LabLesson[],
  lessonId: string,
  fixedBusy?: BusyMap
): LabLesson[] => {
  const lesson = lessons.find(l => l.id === lessonId);
  if (!lesson || teamsInLesson(lesson, state.classes).size === 0) return lessons;

  const teachers = new Map(state.teachers.map(t => [t.id, t]));
  const teams = new Map(state.teams.map(t => [t.id, t]));
  const busy = busyTeachers(lessons, lesson, state.classes);
  const classTeachers = { ...lesson.classTeachers };
  const used = new Set(state.classes.map(c => classTeachers[c]).filter(Boolean) as string[]);

  // Varje klass tar från sin egen arbetsgrupp, så en delad lektion fylls rätt.
  for (const className of state.classes) {
    if (classTeachers[className]) continue;
    const team = teams.get(classTeamId(lesson, className) ?? '');
    const next = team?.memberIds.find(id => {
      const teacher = teachers.get(id);
      return teacher && !teacher.resource && availableOn(teacher, lesson.day)
        && !busy.has(id) && !used.has(id) && !busyDuring(fixedBusy, id, lesson);
    });
    if (!next) continue;
    classTeachers[className] = next;
    used.add(next);
  }
  return lessons.map(l => (l.id === lessonId ? { ...l, classTeachers } : l));
};

/** Flyttar varje lärare ett steg: Grund → Oliv → Rosa → Grund. */
export const rotateClasses = (lesson: LabLesson, classes: string[]): LabLesson => {
  if (classes.length < 2) return lesson;
  const classTeachers: Record<string, string | null> = {};
  classes.forEach((className, i) => {
    const from = classes[(i - 1 + classes.length) % classes.length];
    classTeachers[className] = lesson.classTeachers[from] ?? null;
  });
  return { ...lesson, classTeachers };
};

/**
 * Lärare att välja bland för en klass, i tre grupper: klassens arbetsgrupps
 * tillgängliga, övriga tillgängliga och de som inte är tillgängliga den dagen.
 */
export const teacherOptions = (state: LabState, lesson: LabLesson, className: string) => {
  const teamId = classTeamId(lesson, className);
  const team = teamId ? state.teams.find(t => t.id === teamId) : undefined;
  const plannable = state.teachers.filter(t => !t.resource);
  const inTeam = (t: LabTeacher) => team?.memberIds.includes(t.id) ?? false;
  return {
    team: plannable.filter(t => inTeam(t) && availableOn(t, lesson.day)),
    others: plannable.filter(t => !inTeam(t) && availableOn(t, lesson.day)),
    unavailable: plannable.filter(t => !availableOn(t, lesson.day)),
  };
};
