import { SV_DAYS, type SwedishDay } from './dateSv';

const CANON: Record<string, SwedishDay> = Object.fromEntries(
  SV_DAYS.flatMap((day) => {
    const lower = day.toLowerCase();
    const short = day.slice(0, 3).toLowerCase();
    const ascii = lower.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const shortAscii = short.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    return [
      [lower, day],
      [short, day],
      [ascii, day],
      [shortAscii, day],
    ];
  }),
);

export function normalizeSwedishDay(value: unknown): SwedishDay {
  if (typeof value !== 'string') throw new Error('day must be string');
  const key = value.trim().toLowerCase();
  const hit = CANON[key];
  if (!hit) throw new Error(`Unknown day: ${value}`);
  return hit;
}
