import type { PlannerActivity, PlannerArchiveSummary } from '@/types/schedule';
import type { TermWeek } from '@/types/term';
import type { ThemeWheel } from '@/types/themeWheel';
import { classifyPass } from '@/utils/publicScheduleFilter';
import {
  ALL_TEACHERS_TOKEN,
  mergeIntervalMinutes,
  splitTeacherNames,
  TimeInterval,
} from '@/utils/scheduleStats';
import { timeToMinutes } from '@/utils/scheduleTime';

/**
 * Terminsplaneraren: veckor, schemaförslag och terminsstatistik.
 *
 * Statistiken räknar lärartid ur veckoscheman. Reglerna:
 *
 * - Bara namngivna lärare räknas. "alla" i lärarfältet ger ingen tid åt någon,
 *   men ett fält som "Anna, alla" ger Anna sin tid.
 * - Samtidiga pass för samma lärare räknas en gång, precis som i planerarens
 *   egen timsummering. Det görs per kolumn och separat för totalen, så om en
 *   lärare står i två klasser samtidigt syns båda i kolumnerna men bara en
 *   gång i totalen.
 * - Klassen avgörs av titeln, med samma tolkning som den publika schemalänken
 *   (Tema Oliv/Rosa/Grund, Ma Grund/1/2, Studieverkstad). Allt annat är Övrigt.
 */

// --- Kolumner ---

export type StatColumn =
  | 'oliv'
  | 'rosa'
  | 'grund'
  | 'maGrund'
  | 'ma1'
  | 'ma2'
  | 'studieverkstad'
  | 'ovrigt';

export const STAT_COLUMNS: { key: StatColumn; label: string }[] = [
  { key: 'oliv', label: 'Oliv' },
  { key: 'rosa', label: 'Rosa' },
  { key: 'grund', label: 'Grund' },
  { key: 'maGrund', label: 'Ma Grund' },
  { key: 'ma1', label: 'Ma 1' },
  { key: 'ma2', label: 'Ma 2' },
  { key: 'studieverkstad', label: 'Studieverkstad' },
  { key: 'ovrigt', label: 'Övrigt' },
];

export const columnForTitle = (title: string): StatColumn => {
  const kind = classifyPass(title);
  switch (kind.kind) {
    case 'tema':
      return kind.tema;
    case 'math':
      return kind.course === 'grund' ? 'maGrund' : kind.course === '1' ? 'ma1' : 'ma2';
    case 'studieverkstad':
      return 'studieverkstad';
    case 'common':
      return 'ovrigt';
  }
};

// --- Minuter ---

export type StatsActivity = Pick<PlannerActivity, 'title' | 'teacher' | 'day' | 'startTime' | 'endTime'>;

export interface TeacherMinutes {
  byColumn: Record<StatColumn, number>;
  /** Tid med samtidiga pass räknade en gång, oavsett kolumn. */
  total: number;
}

export const emptyMinutes = (): TeacherMinutes => ({
  byColumn: {
    oliv: 0, rosa: 0, grund: 0, maGrund: 0, ma1: 0, ma2: 0, studieverkstad: 0, ovrigt: 0,
  },
  total: 0,
});

const addMinutes = (target: TeacherMinutes, source: TeacherMinutes) => {
  STAT_COLUMNS.forEach(({ key }) => { target.byColumn[key] += source.byColumn[key]; });
  target.total += source.total;
};

const normalizeName = (name: string) => name.trim().toLocaleLowerCase('sv');

/** Lärarna som får tid för ett pass: namngivna, utan "alla". */
export const countedTeachers = (teacher: unknown): string[] =>
  splitTeacherNames(teacher).filter(name => normalizeName(name) !== ALL_TEACHERS_TOKEN);

type DayIntervals = Record<string, TimeInterval[]>;

const sumByDay = (intervalsByDay: DayIntervals) =>
  Object.values(intervalsByDay).reduce((sum, intervals) => sum + mergeIntervalMinutes(intervals), 0);

export interface TeacherWeekMinutes {
  label: string;
  minutes: TeacherMinutes;
}

/** Varje lärares minuter i ett veckoschema, nycklade på normaliserat namn. */
export const teacherMinutesForWeek = (activities: StatsActivity[]): Map<string, TeacherWeekMinutes> => {
  type Collect = { label: string; columns: Map<StatColumn, DayIntervals>; total: DayIntervals };
  const collected = new Map<string, Collect>();

  activities.forEach(activity => {
    const interval = {
      start: timeToMinutes(activity.startTime ?? ''),
      end: timeToMinutes(activity.endTime ?? ''),
    };
    const column = columnForTitle(activity.title ?? '');

    countedTeachers(activity.teacher).forEach(name => {
      const key = normalizeName(name);
      let entry = collected.get(key);
      if (!entry) {
        entry = { label: name.trim(), columns: new Map(), total: {} };
        collected.set(key, entry);
      }
      const columnDays = entry.columns.get(column) ?? {};
      entry.columns.set(column, columnDays);
      columnDays[activity.day] = [...(columnDays[activity.day] ?? []), interval];
      entry.total[activity.day] = [...(entry.total[activity.day] ?? []), interval];
    });
  });

  const result = new Map<string, TeacherWeekMinutes>();
  collected.forEach((entry, key) => {
    const minutes = emptyMinutes();
    entry.columns.forEach((days, column) => { minutes.byColumn[column] = sumByDay(days); });
    minutes.total = sumByDay(entry.total);
    result.set(key, { label: entry.label, minutes });
  });
  return result;
};

export interface CountedWeek {
  /** Veckans index i terminen. */
  index: number;
  activities: StatsActivity[];
}

export interface TeacherTermRow {
  key: string;
  label: string;
  minutes: TeacherMinutes;
  /** En post per räknad vecka, även de där läraren inte har någon tid. */
  weeks: { index: number; minutes: TeacherMinutes }[];
}

export interface TermStats {
  rows: TeacherTermRow[];
  /** Summan av alla lärares tid. */
  totals: TeacherMinutes;
}

/** Terminens statistik ur de veckor som ska räknas. Lärarna i bokstavsordning. */
export const buildTermStats = (weeks: CountedWeek[]): TermStats => {
  const perWeek = weeks.map(week => ({ index: week.index, teachers: teacherMinutesForWeek(week.activities) }));

  const labels = new Map<string, string>();
  perWeek.forEach(({ teachers }) => {
    teachers.forEach((value, key) => { if (!labels.has(key)) labels.set(key, value.label); });
  });

  const rows: TeacherTermRow[] = Array.from(labels.entries()).map(([key, label]) => {
    const minutes = emptyMinutes();
    const weekRows = perWeek.map(({ index, teachers }) => {
      const weekMinutes = teachers.get(key)?.minutes ?? emptyMinutes();
      addMinutes(minutes, weekMinutes);
      return { index, minutes: weekMinutes };
    });
    return { key, label, minutes, weeks: weekRows };
  });

  rows.sort((a, b) => a.label.localeCompare(b.label, 'sv'));

  const totals = emptyMinutes();
  rows.forEach(row => addMinutes(totals, row.minutes));
  return { rows, totals };
};

/** "12,5" för tabellen. Noll blir tom sträng så att tabellen går att läsa. */
export const formatHours = (minutes: number): string => {
  if (!minutes) return '';
  return (minutes / 60).toLocaleString('sv-SE', { maximumFractionDigits: 2 });
};

// --- Veckor och schemaförslag ---

export const emptyTermWeek = (): TermWeek => ({ theme: '', holiday: false, archiveId: null });

/** Behåller befintliga veckor och fyller på eller kapar till `count`. */
export const resizeTermWeeks = (weeks: TermWeek[], count: number): TermWeek[] =>
  Array.from({ length: count }, (_, index) => weeks[index] ?? emptyTermWeek());

const WEEK_IN_NAME = /(?:^|[^a-zåäö0-9])v(?:ecka|\.)?\s*(\d{1,2})(?!\d)/i;

/** Veckonumret i ett arkivnamn som "v.35", "V35" eller "Vecka 35". */
export const weekNumberFromName = (name: string): number | null => {
  const match = name.match(WEEK_IN_NAME);
  if (!match) return null;
  const week = Number(match[1]);
  return week >= 1 && week <= 53 ? week : null;
};

export interface ArchiveSuggestion {
  archiveId: string;
  /** Fler än ett arkiv matchade veckan; det egna och senast ändrade valdes. */
  ambiguous: boolean;
}

/** Arkivet vars namn anger veckan. Egna arkiv före delade, sedan senast ändrat. */
export const suggestArchiveForWeek = (
  week: number,
  archives: PlannerArchiveSummary[]
): ArchiveSuggestion | null => {
  const matches = archives
    .filter(archive => weekNumberFromName(archive.name) === week)
    .sort((a, b) => (
      Number(b.isOwner) - Number(a.isOwner)
      || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    ));
  if (matches.length === 0) return null;
  return { archiveId: matches[0].id, ambiguous: matches.length > 1 };
};

/**
 * Fyller i schema för veckor som saknar ett. Lovveckor och redan valda
 * scheman lämnas orörda.
 */
export const fillSuggestedArchives = (
  weeks: TermWeek[],
  calendarWeeks: number[],
  archives: PlannerArchiveSummary[]
): TermWeek[] => weeks.map((week, index) => {
  if (week.holiday || week.archiveId) return week;
  const suggestion = suggestArchiveForWeek(calendarWeeks[index], archives);
  return suggestion ? { ...week, archiveId: suggestion.archiveId } : week;
});

/**
 * Terminens veckor ur ett temahjul: lovveckorna och arbetsområdena som tema.
 * Bara huvudområden räknas — delområden ligger inom sin förälder. Går flera
 * huvudområden samma vecka blir temat båda namnen.
 */
export const termWeeksFromWheel = (wheel: ThemeWheel): TermWeek[] => {
  const topLevel = wheel.blocks.filter(block => !block.parentId);
  return Array.from({ length: wheel.weekCount }, (_, index) => ({
    theme: topLevel
      .filter(block => block.startWeek <= index && index <= block.endWeek)
      .sort((a, b) => a.startWeek - b.startWeek || a.title.localeCompare(b.title, 'sv'))
      .map(block => block.title)
      .join(' / '),
    holiday: wheel.holidayWeeks.includes(index),
    archiveId: null,
  }));
};

/** Terminens teman i den ordning de först förekommer. */
export const termThemes = (weeks: TermWeek[]): string[] => {
  const seen: string[] = [];
  weeks.forEach(week => {
    const theme = week.theme.trim();
    if (theme && !seen.includes(theme)) seen.push(theme);
  });
  return seen;
};
