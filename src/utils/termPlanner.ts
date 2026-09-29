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
 * Terminens veckor ur ett temahjul: veckorna och lovveckorna. Teman används
 * inte längre (29 sep 2026), så arbetsområdena följer inte med.
 */
export const termWeeksFromWheel = (wheel: ThemeWheel): TermWeek[] =>
  Array.from({ length: wheel.weekCount }, (_, index) => ({
    theme: '',
    holiday: wheel.holidayWeeks.includes(index),
    archiveId: null,
  }));

// --- Diagram ---

/**
 * Lärarnas färger: referenspaletten ur dataviz-skillen, validerad mot vit
 * yta (alla hårda krav godkända; tre ljusa steg under 3:1, därför står värdena
 * alltid utskrivna bredvid diagrammen). Ordningen är det som gör den
 * färgblindsäker — byt inte plats på stegen.
 */
export const TEACHER_COLORS = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948',
] as const;

/** Det som inte får en egen färg: lärare efter den åttonde, lektioner efter den sjätte. */
export const OTHER_COLOR = '#a8a7a1';

/**
 * Färgen följer läraren, inte rangen: lärarna tar paletten i bokstavsordning
 * över hela terminen, så samma lärare har samma färg i varje diagram.
 */
export const teacherColorMap = (teacherKeys: string[]): Map<string, string> =>
  new Map(teacherKeys.map((key, index) => [key, TEACHER_COLORS[index] ?? OTHER_COLOR]));

export interface Slice {
  key: string;
  label: string;
  minutes: number;
  color: string;
}

export const OTHER_SLICE_KEY = '__ovriga__';

/**
 * Högst `max` bitar: de största behålls och resten slås ihop till "Övriga".
 * Ett cirkeldiagram med fler bitar än så går inte att läsa.
 */
export const foldSlices = (slices: Slice[], max: number, otherLabel = 'Övriga'): Slice[] => {
  const sorted = slices.filter(slice => slice.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  if (sorted.length <= max) return sorted;
  const kept = sorted.slice(0, max - 1);
  const rest = sorted.slice(max - 1);
  return [
    ...kept,
    {
      key: OTHER_SLICE_KEY,
      label: `${otherLabel} (${rest.length})`,
      minutes: rest.reduce((sum, slice) => sum + slice.minutes, 0),
      color: OTHER_COLOR,
    },
  ];
};

export interface TeacherShare {
  /** Lärarens normaliserade namn, samma nyckel som i `teacherColorMap`. */
  key: string;
  label: string;
  minutes: number;
}

/**
 * Lärarnas andelar som bitar i lärarens färg, störst först. Lärare utan egen
 * färg (efter den åttonde) slås ihop, så att två gråa bitar aldrig står
 * bredvid varandra.
 */
export const teacherShareSlices = (shares: TeacherShare[], colors: Map<string, string>): Slice[] => {
  const named: Slice[] = [];
  let otherMinutes = 0;
  let otherCount = 0;
  shares.forEach(share => {
    if (share.minutes <= 0) return;
    const color = colors.get(share.key) ?? OTHER_COLOR;
    if (color === OTHER_COLOR) {
      otherMinutes += share.minutes;
      otherCount += 1;
    } else {
      named.push({ ...share, color });
    }
  });
  const slices = named.sort((a, b) => b.minutes - a.minutes);
  if (otherCount > 0) {
    slices.push({ key: OTHER_SLICE_KEY, label: `Övriga lärare (${otherCount})`, minutes: otherMinutes, color: OTHER_COLOR });
  }
  return slices;
};

/** Hur en klass tid fördelas på lärarna. */
export const classShareSlices = (
  stats: TermStats,
  column: StatColumn,
  colors: Map<string, string>
): Slice[] => teacherShareSlices(
  stats.rows.map(row => ({ key: row.key, label: row.label, minutes: row.minutes.byColumn[column] })),
  colors
);

export type LessonActivity = StatsActivity & { color?: string | null };

export interface TeacherLessonMix {
  key: string;
  label: string;
  /** En bit per lektionstitel, störst först. Inte hopslagna — det gör diagrammet. */
  lessons: Slice[];
  total: number;
}

const normalizeTitle = (title: string) => title.toLocaleLowerCase('sv').replace(/\s+/g, ' ').trim();

/**
 * Vad varje lärares tid består av, per lektionstitel, över de räknade
 * veckorna. Samma regler som tabellen: bara namngivna lärare, och samtidiga
 * pass med samma titel räknas en gång. Titlar slås ihop oavsett skiftläge och
 * extra mellanslag ("Ma  Grund" = "Ma Grund").
 *
 * Färgen är den som oftast förekommer på titelns pass, genom `resolveColor`
 * — planerarens färgregler — så att bitarna har samma färg som korten i schemat.
 */
export const teacherLessonMix = (
  weeks: { activities: LessonActivity[] }[],
  resolveColor: (title: string, fallback: string) => string = (_, fallback) => fallback
): TeacherLessonMix[] => {
  const titleLabels = new Map<string, string>();
  const titleColorCounts = new Map<string, Map<string, number>>();
  const teacherLabels = new Map<string, string>();
  const minutes = new Map<string, Map<string, number>>();

  weeks.forEach(({ activities }) => {
    // lärare -> titel -> dag -> intervall, för en vecka i taget
    const week = new Map<string, Map<string, DayIntervals>>();

    activities.forEach(activity => {
      const title = activity.title ?? '';
      const titleKey = normalizeTitle(title);
      if (!titleKey) return;
      if (!titleLabels.has(titleKey)) titleLabels.set(titleKey, title.replace(/\s+/g, ' ').trim());
      if (activity.color) {
        const counts = titleColorCounts.get(titleKey) ?? new Map<string, number>();
        counts.set(activity.color, (counts.get(activity.color) ?? 0) + 1);
        titleColorCounts.set(titleKey, counts);
      }

      const interval = {
        start: timeToMinutes(activity.startTime ?? ''),
        end: timeToMinutes(activity.endTime ?? ''),
      };
      countedTeachers(activity.teacher).forEach(name => {
        const teacherKey = normalizeName(name);
        if (!teacherLabels.has(teacherKey)) teacherLabels.set(teacherKey, name.trim());
        const byTitle = week.get(teacherKey) ?? new Map<string, DayIntervals>();
        week.set(teacherKey, byTitle);
        const days = byTitle.get(titleKey) ?? {};
        byTitle.set(titleKey, days);
        days[activity.day] = [...(days[activity.day] ?? []), interval];
      });
    });

    week.forEach((byTitle, teacherKey) => {
      const totals = minutes.get(teacherKey) ?? new Map<string, number>();
      minutes.set(teacherKey, totals);
      byTitle.forEach((days, titleKey) => {
        totals.set(titleKey, (totals.get(titleKey) ?? 0) + sumByDay(days));
      });
    });
  });

  const colorFor = (titleKey: string) => {
    const counts = titleColorCounts.get(titleKey);
    const common = counts
      ? Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0]
      : OTHER_COLOR;
    return resolveColor(titleLabels.get(titleKey) ?? titleKey, common);
  };

  return Array.from(minutes.entries())
    .map(([teacherKey, totals]) => {
      const lessons = Array.from(totals.entries())
        .filter(([, value]) => value > 0)
        .map(([titleKey, value]) => ({
          key: titleKey,
          label: titleLabels.get(titleKey) ?? titleKey,
          minutes: value,
          color: colorFor(titleKey),
        }))
        .sort((a, b) => b.minutes - a.minutes);
      return {
        key: teacherKey,
        label: teacherLabels.get(teacherKey) ?? teacherKey,
        lessons,
        total: lessons.reduce((sum, lesson) => sum + lesson.minutes, 0),
      };
    })
    .filter(mix => mix.total > 0)
    .sort((a, b) => a.label.localeCompare(b.label, 'sv'));
};

export interface LessonTeachers {
  /** Titeln normaliserad, samma nyckel som i `teacherLessonMix`. */
  key: string;
  label: string;
  /** Lektionens färg från planeraren. */
  color: string;
  total: number;
  teachers: TeacherShare[];
}

/**
 * Samma siffror som `teacherLessonMix`, vända: per pass, hur tiden fördelas
 * på lärarna. Störst pass först.
 */
export const lessonTeacherBreakdown = (mixes: TeacherLessonMix[]): LessonTeachers[] => {
  const lessons = new Map<string, LessonTeachers>();
  mixes.forEach(mix => {
    mix.lessons.forEach(lesson => {
      const entry = lessons.get(lesson.key)
        ?? { key: lesson.key, label: lesson.label, color: lesson.color, total: 0, teachers: [] };
      entry.teachers.push({ key: mix.key, label: mix.label, minutes: lesson.minutes });
      entry.total += lesson.minutes;
      lessons.set(lesson.key, entry);
    });
  });
  return Array.from(lessons.values())
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'sv'));
};

/** Tema Oliv, Rosa och Grund — de pass som redan har en egen ruta. */
export const isClassLesson = (title: string): boolean => {
  const column = columnForTitle(title);
  return column === 'oliv' || column === 'rosa' || column === 'grund';
};

/** För `usePersistentState`: titel → ikryssad, bara riktiga booleska värden. */
export const sanitizeSelection = (raw: unknown): Record<string, boolean> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(([, value]) => typeof value === 'boolean')
  ) as Record<string, boolean>;
};
