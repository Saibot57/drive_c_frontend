/**
 * Kalenderveckorna bakom temahjulets tårtbitar.
 *
 * Hjulet lagrar bara startvecka och antal, så veckonummer, årsskiften och
 * datumspann räknas fram här. ISO-8601 gäller: vecka 1 är veckan som innehåller
 * 4 januari, och veckan börjar på måndag.
 */

import { isoWeekYear } from '@/utils/dateSv';

const SV_MONTHS_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
] as const;

export interface WheelWeek {
  /** Hjulindex, 0-baserat. */
  index: number;
  /** Kalendervecka, 1–53. */
  week: number;
  /** ISO-veckoår. Skiljer sig från kalenderåret kring årsskiftet. */
  year: number;
  monday: Date;
  sunday: Date;
  /** "v.34" */
  label: string;
  /** "1–7 sep" eller "29 sep–5 okt" */
  dateLabel: string;
}

/**
 * 53 veckor när året börjar på torsdag, eller när det är skottår som börjar på
 * onsdag. Annars 52.
 */
export const isoWeeksInYear = (year: number): number => {
  const weekday = (y: number) => (
    (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400)) % 7
  );
  return weekday(year) === 4 || weekday(year - 1) === 3 ? 53 : 52;
};

/** Måndagen i en given ISO-vecka, i UTC. */
export const mondayOfIsoWeek = (year: number, week: number): Date => {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const weekday = jan4.getUTCDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - weekday + 1);
  const monday = new Date(firstMonday);
  monday.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);
  return monday;
};

const formatDay = (date: Date) => date.getUTCDate();
const formatMonth = (date: Date) => SV_MONTHS_SHORT[date.getUTCMonth()];

/** "1–7 sep" när veckan ligger i en månad, annars "29 sep–5 okt". */
export const formatWeekRange = (monday: Date, sunday: Date): string => {
  if (monday.getUTCMonth() === sunday.getUTCMonth()) {
    return `${formatDay(monday)}–${formatDay(sunday)} ${formatMonth(sunday)}`;
  }
  return `${formatDay(monday)} ${formatMonth(monday)}–${formatDay(sunday)} ${formatMonth(sunday)}`;
};

/**
 * Veckorna i hjulet, i ordning. Räknar över årsskiftet: efter vecka 52 (eller
 * 53) kommer vecka 1 nästa år.
 */
export const buildWheelWeeks = (
  startWeek: number,
  startYear: number,
  weekCount: number
): WheelWeek[] => {
  const weeks: WheelWeek[] = [];
  let week = startWeek;
  let year = startYear;

  for (let index = 0; index < weekCount; index++) {
    if (week > isoWeeksInYear(year)) {
      week = 1;
      year += 1;
    }
    const monday = mondayOfIsoWeek(year, week);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    weeks.push({
      index,
      week,
      year,
      monday,
      sunday,
      label: `v.${week}`,
      dateLabel: formatWeekRange(monday, sunday),
    });

    week += 1;
  }

  return weeks;
};

/** Hjulindex för dagens vecka, eller null när i dag ligger utanför hjulet. */
export const currentWheelIndex = (weeks: WheelWeek[], today: Date = new Date()): number | null => {
  const { week, year } = isoWeekYear(today);
  const hit = weeks.find(candidate => candidate.week === week && candidate.year === year);
  return hit ? hit.index : null;
};
