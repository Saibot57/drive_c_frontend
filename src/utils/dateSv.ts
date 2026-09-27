import type { SwedishDay } from '@/types/schedule';

export const SV_FROM_ISO: Record<number, SwedishDay> = {
  1: 'Måndag',
  2: 'Tisdag',
  3: 'Onsdag',
  4: 'Torsdag',
  5: 'Fredag',
  6: 'Lördag',
  7: 'Söndag',
};

/**
 * Kalenderdagen som UTC-midnatt, så att resten kan räkna med `getUTC*`.
 *
 * Ett `Date` läses med lokala delar: en lokal midnatt i Stockholm ligger på
 * föregående dygn i UTC, och med `getUTC*` hade en måndag räknats som söndag.
 * En `YYYY-MM-DD`-sträng är redan en ren kalenderdag.
 */
const toUtcDay = (input: string | Date): Date => {
  const d = input instanceof Date
    ? new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()))
    : new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${input}`);
  }
  return d;
};

export function isoWeekYear(input: string | Date): { week: number; year: number } {
  const tmp = toUtcDay(input);
  const dayNum = tmp.getUTCDay() === 0 ? 7 : tmp.getUTCDay();
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const year = tmp.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((+tmp - +yearStart) / 86400000) + 1) / 7);
  return { week, year };
}

export function isoWeekday(input: string | Date): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = toUtcDay(input).getUTCDay();
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}
