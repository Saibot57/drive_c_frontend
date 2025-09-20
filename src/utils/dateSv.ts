import type { SwedishDay } from '@/types/schedule';

export const SV_DAYS: SwedishDay[] = [
  'Måndag',
  'Tisdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lördag',
  'Söndag',
];

export const SV_FROM_ISO: Record<number, SwedishDay> = {
  1: 'Måndag',
  2: 'Tisdag',
  3: 'Onsdag',
  4: 'Torsdag',
  5: 'Fredag',
  6: 'Lördag',
  7: 'Söndag',
};

export function isoWeekYear(input: string | Date): { week: number; year: number } {
  const d = input instanceof Date ? new Date(input) : new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${input}`);
  }
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = tmp.getUTCDay() === 0 ? 7 : tmp.getUTCDay();
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const year = tmp.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((+tmp - +yearStart) / 86400000) + 1) / 7);
  return { week, year };
}

export function isoWeekday(input: string | Date): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const d = input instanceof Date ? new Date(input) : new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${input}`);
  }
  const day = d.getUTCDay();
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export function swedishDayFromDate(input: string | Date): SwedishDay {
  return SV_FROM_ISO[isoWeekday(input)];
}

export function dateFromISOWeek(
  year: number,
  week: number,
  isoWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7,
): Date {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay() || 7;
  const monday = new Date(simple);
  monday.setUTCDate(simple.getUTCDate() - dow + 1);
  const result = new Date(monday);
  result.setUTCDate(monday.getUTCDate() + (isoWeekday - 1));
  return result;
}
