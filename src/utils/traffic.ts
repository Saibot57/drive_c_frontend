/** Ren logik för trafiksidan, utbruten för att gå att testa. */

const WEEKDAYS = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];

/** `2026-11-03` → `tis 3/11`. Datumet tolkas som ett kalenderdatum, utan tidszon. */
export const dayLabel = (isoDate: string): string => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${d}/${m}`;
};

/** `2026-11-04T00:30+01:00` → `4/11 00:30`, i den tid backend skrev. */
export const timeLabel = (isoMinute: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(isoMinute);
  if (!match) return isoMinute;
  return `${Number(match[3])}/${Number(match[2])} ${match[4]}`;
};

export type Change = { text: string; direction: 'up' | 'down' | 'same' };

/**
 * Förändring mot perioden före, som `+12 %`. Null när det inte finns något
 * att jämföra med (ingen period före, eller noll före).
 */
export const changeFrom = (current: number, previous: number | null | undefined): Change | null => {
  if (previous === null || previous === undefined || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: '±0 %', direction: 'same' };
  return { text: `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`, direction: pct > 0 ? 'up' : 'down' };
};

/** Tal med mellanslag som tusentalsavgränsare, som på svenska. */
export const formatCount = (n: number): string =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Andel som `79 %`. */
export const formatShare = (part: number, whole: number): string =>
  whole > 0 ? `${Math.round((part / whole) * 100)} %` : '–';

/**
 * Stödlinjer för y-axeln: ungefär fyra jämna steg (1, 2 eller 5 gånger en
 * tiopotens) från noll upp till minst `value`.
 */
export const axisTicks = (value: number): number[] => {
  const target = Math.max(1, value) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 5, 10].map(f => f * magnitude).find(s => s >= target) ?? 10 * magnitude;
  const roundedStep = Math.max(1, step);
  const top = Math.ceil(Math.max(1, value) / roundedStep) * roundedStep;
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += roundedStep) ticks.push(t);
  return ticks;
};
