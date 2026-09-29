import type { PlannerActivity } from '@/types/schedule';
import type { LabDay, LabLesson, LabTeacher } from '@/types/lessonLab';
import { BusyMap, LAB_DAYS } from '@/utils/lessonLab';
import { columnForTitle, countedTeachers, StatColumn, teacherMinutesForWeek } from '@/utils/termPlanner';
import { timeToMinutes } from '@/utils/scheduleTime';

/**
 * Veckolabbet med ett av schemaplanerarens arkiv som grund.
 *
 * - **Temapassen** blir labbets lektioner. Tema Grund, Oliv och Rosa som går
 *   vid samma tid blir en lektion. Ett pass som heter bara "Tema…" utan klass
 *   gäller alla klasser. Saknas en klass vid en tid blir den frånvarande.
 * - **Allt annat** med en namngiven lärare (matte, studieverkstad, …) är
 *   lärarnas fasta timmar. De räknas med i timräknaren och gör läraren
 *   upptagen den tiden. "Alla" räknas inte, som i terminsplaneraren.
 *
 * Lärarna som står på temapassen i arkivet används inte: labbet är till för
 * att pröva nya fördelningar.
 */

const TEMA_PATTERN = /^\s*tema\b/i;

const CLASS_COLUMNS: Partial<Record<StatColumn, string>> = { grund: 'grund', oliv: 'oliv', rosa: 'rosa' };

const isLabDay = (day: string): day is LabDay => (LAB_DAYS as readonly string[]).includes(day);

const validTimes = (a: PlannerActivity) =>
  /^\d\d:\d\d$/.test(a.startTime ?? '') && /^\d\d:\d\d$/.test(a.endTime ?? '')
  && timeToMinutes(a.endTime) > timeToMinutes(a.startTime);

/**
 * Klassen ett temapass gäller, `'all'` för ett tema utan klass, eller `null`
 * när passet inte är tema. Klassen matchas mot labbets klassnamn.
 */
export const temaTarget = (title: string, classes: string[]): string | 'all' | null => {
  const column = CLASS_COLUMNS[columnForTitle(title ?? '')];
  if (column) return classes.find(c => c.toLocaleLowerCase('sv') === column) ?? null;
  return TEMA_PATTERN.test(title ?? '') ? 'all' : null;
};

const isTema = (activity: PlannerActivity, classes: string[]) => temaTarget(activity.title, classes) !== null;

/**
 * Labbets lektioner ur arkivets temapass. En lektion som redan fanns vid samma
 * dag och tid behåller sitt id, sin arbetsgrupp och sina lärare, så att "Läs
 * om" inte river det man planerat.
 */
export const lessonsFromArchive = (
  activities: PlannerActivity[],
  classes: string[],
  previous: LabLesson[],
  newId: () => string
): LabLesson[] => {
  const slots = new Map<string, { day: LabDay; start: string; end: string; classes: Set<string> }>();
  for (const activity of activities) {
    if (!isLabDay(activity.day) || !validTimes(activity)) continue;
    const target = temaTarget(activity.title, classes);
    if (!target) continue;
    const key = `${activity.day}|${activity.startTime}|${activity.endTime}`;
    const slot = slots.get(key) ?? { day: activity.day, start: activity.startTime, end: activity.endTime, classes: new Set<string>() };
    (target === 'all' ? classes : [target]).forEach(c => slot.classes.add(c));
    slots.set(key, slot);
  }

  const byTime = new Map(previous.map(l => [`${l.day}|${l.start}|${l.end}`, l]));
  return Array.from(slots.entries()).map(([key, slot]) => {
    const absent = classes.filter(c => !slot.classes.has(c));
    const old = byTime.get(key);
    const base: LabLesson = old ?? {
      id: newId(),
      day: slot.day,
      start: slot.start,
      end: slot.end,
      title: '',
      areaId: null,
      teamId: null,
      split: false,
      classTeams: {},
      classTeachers: {},
    };
    // Klasser som inte längre har lektionen släpper sin grupp och lärare.
    const drop = <T,>(record: Record<string, T>) =>
      Object.fromEntries(Object.entries(record).filter(([c]) => !absent.includes(c)));
    const { absentClasses: _previousAbsent, ...rest } = base;
    void _previousAbsent;
    return {
      ...rest,
      classTeams: drop(base.classTeams),
      classTeachers: drop(base.classTeachers),
      ...(absent.length > 0 ? { absentClasses: absent } : {}),
    };
  });
};

const normalize = (name: string) => name.trim().toLocaleLowerCase('sv');

/** Arkivets pass som inte är tema, t.ex. matte och studieverkstad. */
export const fixedActivities = (activities: PlannerActivity[], classes: string[]) =>
  activities.filter(a => isLabDay(a.day) && validTimes(a) && !isTema(a, classes));

export type FixedHours = {
  total: number;
  parts: { label: string; minutes: number }[];
};

const FIXED_GROUPS: { label: string; columns: StatColumn[] }[] = [
  { label: 'Matte', columns: ['maGrund', 'ma1', 'ma2'] },
  { label: 'Studieverkstad', columns: ['studieverkstad'] },
  { label: 'Övrigt', columns: ['ovrigt', 'grund', 'oliv', 'rosa'] },
];

/**
 * Varje labblärares fasta minuter i arkivet, nycklade på lärar-id. Samtidiga
 * pass räknas en gång, som i terminsplaneraren.
 */
export const fixedHoursByTeacher = (
  activities: PlannerActivity[],
  teachers: LabTeacher[],
  classes: string[]
): Map<string, FixedHours> => {
  const minutes = teacherMinutesForWeek(fixedActivities(activities, classes));
  const result = new Map<string, FixedHours>();
  for (const teacher of teachers) {
    const entry = minutes.get(normalize(teacher.name));
    if (!entry || entry.minutes.total === 0) continue;
    const parts = FIXED_GROUPS
      .map(group => ({ label: group.label, minutes: group.columns.reduce((s, c) => s + (entry.minutes.byColumn[c] ?? 0), 0) }))
      .filter(part => part.minutes > 0);
    result.set(teacher.id, { total: entry.minutes.total, parts });
  }
  return result;
};

/** När labbets lärare redan har en fast lektion. */
export const busyFromArchive = (
  activities: PlannerActivity[],
  teachers: LabTeacher[],
  classes: string[]
): BusyMap => {
  const byName = new Map(teachers.map(t => [normalize(t.name), t.id]));
  const busy: BusyMap = new Map();
  for (const activity of fixedActivities(activities, classes)) {
    countedTeachers(activity.teacher).forEach(name => {
      const id = byName.get(normalize(name));
      if (!id) return;
      busy.set(id, [...(busy.get(id) ?? []), {
        day: activity.day as LabDay,
        start: activity.startTime,
        end: activity.endTime,
        title: activity.title.trim() || 'en lektion',
      }]);
    });
  }
  return busy;
};

/** Lärarnamn i arkivet som inte finns i labbet. */
export const unknownTeacherNames = (activities: PlannerActivity[], teachers: LabTeacher[]): string[] => {
  const known = new Set(teachers.map(t => normalize(t.name)));
  const found = new Map<string, string>();
  activities.forEach(a => countedTeachers(a.teacher).forEach(name => {
    const key = normalize(name);
    if (!known.has(key) && !found.has(key)) found.set(key, name.trim());
  }));
  return Array.from(found.values()).sort((a, b) => a.localeCompare(b, 'sv'));
};
