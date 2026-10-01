import type { PlannerActivity } from '@/types/schedule';
import type { LabPlanSummary, LabState } from '@/types/lessonLab';
import { toFileSlug } from '@/utils/download';
import {
  availableOn,
  BusyMap,
  busyDuring,
  classAreaMinutes,
  classTeamId,
  isBeforeLunch,
  LAB_DAYS,
  labWarnings,
  lessonMinutes,
  parseLabState,
  presentClasses,
  sortLessons,
  sortTeams,
  teacherTeachingMinutes,
  teamSummaries,
  teamsInLesson,
} from '@/utils/lessonLab';
import { busyFromArchive, FixedHours, fixedHoursByTeacher, unknownTeacherNames } from '@/utils/lessonLabArchive';

/**
 * Ett upplägg som JSON-fil för en språkmodell: hela läget (`state`), som kan
 * läsas in igen, plus det som annars bara räknas fram i webbläsaren. Det är
 * arkivets fasta pass, lärarnas timmar, lagens kapacitet och varningarna.
 * `readme` förklarar reglerna, så att modellen kan föreslå alternativ utan
 * att känna till appen.
 */

export const LAB_EXPORT_FORMAT = 'arbetslag-upplagg';

export type LabExportArchive = {
  id: string | null;
  name: string | null;
  /** Arkivets pass, eller `null` när de inte har hämtats. */
  activities: PlannerActivity[] | null;
};

/** Minuter med en decimal, så att filen inte fylls av långa bråk. */
const round = (minutes: number) => Math.round(minutes * 10) / 10;

const README = [
  'Det här är ett upplägg från Arbetslag, ett planeringsverktyg för en skola. Det beskriver vilka arbetslag (grupper av lärare) som tar hand om veckans temalektioner, och vilka lärare som ingår i varje lag.',
  'Modellen: Varje lektion i `state.template` går samtidigt för alla klasser i `state.classes`, utom klasserna i `absentClasses`. Varje närvarande klass behöver en egen lärare hela lektionen, så en lektion med tre klasser kräver tre lärare samtidigt.',
  'Arbetslag: En hel lektion (`split: false`) ägs av ett lag i `teamId`. En delad lektion (`split: true`) har ett lag per klass i `classTeams`. Ett lag behöver minst lika många tillgängliga medlemmar som klasser det äger i lektionen. Tillgänglig betyder att lektionens dag finns i lärarens `days` och att läraren inte har ett fast pass samtidigt (`summary.teachers[].fixedLessons`).',
  'Lärare: `resource: true` betyder resurs, t.ex. studiecoach. En resurs kan inte sitta i ett lag eller ha en klass. `classTeachers` sätter en viss lärare på en klass. Den används sällan, och utan den fördelas klasserna på lagets tillgängliga medlemmar.',
  'Timmar: `summary.teachers[].temaMinutes` räknas i klasspass. En satt lärare får hela lektionen. Övriga klasser delas jämnt på lagets tillgängliga medlemmar, men ingen får mer än lektionens längd från samma lektion. `fixedMinutes` är lärarens fasta pass i schemaarkivet (matte, studieverkstad m.m.). `totalMinutes` är summan per vecka. Målet är oftast en jämn och rimlig fördelning mellan lärarna.',
  'Varningar: `summary.warnings` är det appen själv flaggar. `error` går inte att genomföra, `warn` bör ses över och `info` är ofullständigt.',
  'Vad som kan ändras: lagens medlemmar (`teams[].memberIds`), vilket lag som äger varje lektion eller klass (`teamId`, `split`, `classTeams`), och nya eller borttagna lag. Lektionernas dagar och tider kommer från schemaarkivet. Det gör även de fasta passen. Lärarnas dagar (`days`) är fakta om när de kan arbeta. Ändra inte de här sakerna om inte användaren ber om det.',
  'Att lämna ett alternativ: Svara med ett komplett `state`-objekt i samma format som här. Behåll befintliga id:n. Ett nytt lag behöver ett nytt unikt `id`, ett unikt heltal i `number`, ett `name` och en färg (`color`, t.ex. "#fde68a"). Filen kan läsas in i Arbetslags detaljplan som ett nytt upplägg, antingen som hela den här filen eller bara `state`. `summary` behöver inte skickas tillbaka. Den räknas om av appen.',
].join('\n\n');

export const buildLabExport = ({
  state,
  plan,
  archive,
  exportedAt = new Date(),
}: {
  state: LabState;
  plan: Pick<LabPlanSummary, 'id' | 'name' | 'version' | 'updatedAt'> | null;
  archive: LabExportArchive;
  exportedAt?: Date;
}) => {
  const lessons = sortLessons(state.template);
  const activities = archive.activities;
  const busy: BusyMap | undefined = activities ? busyFromArchive(activities, state.teachers, state.classes) : undefined;
  const fixed = activities ? fixedHoursByTeacher(activities, state.teachers, state.classes) : new Map<string, FixedHours>();
  const tema = teacherTeachingMinutes(state, lessons, busy);

  const teacherName = new Map(state.teachers.map(t => [t.id, t.name]));
  const teamsById = new Map(state.teams.map(t => [t.id, t]));
  const areaName = new Map(state.areas.map(a => [a.id, a.name]));
  const teamRef = (id: string | null) => {
    const team = id ? teamsById.get(id) : undefined;
    return team ? { id: team.id, number: team.number, name: team.name } : null;
  };

  const teachers = state.teachers.map(teacher => {
    const fixedHours = fixed.get(teacher.id);
    const temaMinutes = round(tema.get(teacher.id) ?? 0);
    const fixedMinutes = fixedHours?.total ?? 0;
    return {
      id: teacher.id,
      name: teacher.name,
      resource: teacher.resource,
      availableDays: teacher.days,
      teams: sortTeams(state.teams.filter(t => t.memberIds.includes(teacher.id))).map(t => ({ number: t.number, name: t.name })),
      fixedLessons: busy?.get(teacher.id) ?? [],
      fixedMinutes: { total: fixedMinutes, parts: fixedHours?.parts ?? [] },
      temaMinutes,
      totalMinutes: round(fixedMinutes + temaMinutes),
    };
  });

  const teams = teamSummaries(state, lessons)
    .sort((a, b) => a.team.number - b.team.number)
    .map(summary => ({
      id: summary.team.id,
      number: summary.team.number,
      name: summary.team.name,
      members: summary.team.memberIds.map(id => ({ id, name: teacherName.get(id) ?? 'Okänd lärare' })),
      lessonCount: summary.lessonCount,
      classPasses: summary.classPasses,
      minutes: summary.minutes,
      membersAvailableByDay: summary.availableByDay,
    }));

  const lessonSummaries = lessons.map(lesson => {
    const present = presentClasses(lesson, state.classes);
    // Lagens behov i lektionen: klasser de äger mot medlemmar som kan.
    const staffing = Array.from(teamsInLesson(lesson, state.classes).entries()).flatMap(([teamId, owned]) => {
      const team = teamsById.get(teamId);
      if (!team) return [];
      const available = team.memberIds.filter(id => {
        const teacher = state.teachers.find(t => t.id === id);
        return teacher && availableOn(teacher, lesson.day) && !busyDuring(busy, id, lesson);
      });
      return [{
        team: teamRef(teamId),
        classes: owned,
        availableMembers: available.map(id => teacherName.get(id) ?? 'Okänd lärare'),
        enough: available.length >= owned.length,
      }];
    });
    return {
      id: lesson.id,
      day: lesson.day,
      start: lesson.start,
      end: lesson.end,
      minutes: lessonMinutes(lesson),
      beforeLunch: isBeforeLunch(lesson),
      title: lesson.title || null,
      area: lesson.areaId ? areaName.get(lesson.areaId) ?? null : null,
      split: lesson.split,
      classes: state.classes.map(className => {
        const teacherId = present.includes(className) ? lesson.classTeachers[className] ?? null : null;
        return {
          class: className,
          present: present.includes(className),
          team: teamRef(classTeamId(lesson, className)),
          teacher: teacherId ? { id: teacherId, name: teacherName.get(teacherId) ?? 'Okänd lärare' } : null,
        };
      }),
      staffing,
    };
  });

  const warnings = labWarnings(state, lessons, busy).map(w => ({
    severity: w.severity,
    kind: w.kind,
    message: w.message,
    lessonId: w.lessonId,
    ...(w.teacherId ? { teacherId: w.teacherId } : {}),
  }));

  return {
    format: LAB_EXPORT_FORMAT,
    formatVersion: 1,
    exportedAt: exportedAt.toISOString(),
    readme: README,
    plan: plan ? { id: plan.id, name: plan.name, version: plan.version, updatedAt: plan.updatedAt } : null,
    archive: {
      id: archive.id,
      name: archive.name,
      loaded: activities !== null,
      note: archive.id === null
        ? 'Upplägget bygger på tavlan, inte på ett schemaarkiv. Det finns inga fasta pass.'
        : activities === null
          ? 'Arkivets pass kunde inte hämtas. Fasta pass och fasta timmar saknas i summary.'
          : 'Lektionerna är arkivets temapass. Övriga pass med lärare är lärarnas fasta pass.',
      teacherNamesNotInPlan: activities ? unknownTeacherNames(activities, state.teachers) : [],
    },
    summary: {
      note: 'Uträknat av appen för veckomallen (`state.template`). Egna veckor i `state.weeks` räknas inte här.',
      days: LAB_DAYS,
      classes: state.classes,
      totalLessonMinutesPerWeek: lessons.reduce((sum, l) => sum + lessonMinutes(l), 0),
      minutesPerClassAndArea: Object.fromEntries(Object.entries(classAreaMinutes(state, lessons)).map(([className, row]) => [
        className,
        Object.fromEntries(Object.entries(row).map(([areaId, minutes]) => [areaId ? areaName.get(areaId) ?? areaId : 'Inget område', minutes])),
      ])),
      teachers,
      teams,
      lessons: lessonSummaries,
      warnings,
    },
    state,
  };
};

export type LabExport = ReturnType<typeof buildLabExport>;

/** Filnamnet för exporten. `toFileSlug` behåller åäö. */
export const labExportFileName = (name: string, date: Date = new Date()): string =>
  `arbetslag-${toFileSlug(name, 'arbetslag')}-${date.toISOString().slice(0, 10)}-ai.json`;

/**
 * Läget ur en inläst fil: antingen ett rent läge eller en export från
 * `buildLabExport`, t.ex. ett alternativ som en språkmodell skickat tillbaka.
 */
export const labStateFromFile = (raw: unknown): LabState | null => {
  const direct = parseLabState(raw);
  if (direct) return direct;
  return raw && typeof raw === 'object' && 'state' in raw ? parseLabState((raw as { state: unknown }).state) : null;
};
