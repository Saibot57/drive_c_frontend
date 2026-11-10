import { RETENTION_DAYS, isWeekKey, weekMonday } from '@/utils/narvaroDocs';

/**
 * Påminnelser om gallring i Närvarorutor. Gallringen sker per vecka (se
 * `isExpiredWeek`), så påminnelserna gäller veckor, inte enskilda pass.
 */

/** Trösklarna i dagar. En vecka nämns först när den har 14 dagar kvar. */
export type PurgeTier = 14 | 7 | 1;

export type PurgeInfo = { daysLeft: number; tier: PurgeTier };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Antal dagar tills veckan är gallrad: 1 betyder att i dag är sista dagen den
 * syns. Samma gräns som `isExpiredWeek`, som gallrar dagen när måndagen är
 * äldre än `RETENTION_DAYS` dagar. `null` för en ogiltig eller redan gallrad
 * vecka.
 */
export function daysUntilPurge(week: string, now: Date): number | null {
  const monday = weekMonday(week);
  if (!monday) return null;
  const gone = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + RETENTION_DAYS + 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Avrundningen tar hand om sommartiden, då ett dygn inte är 24 timmar.
  const days = Math.round((gone.getTime() - today.getTime()) / DAY_MS);
  return days >= 1 ? days : null;
}

/** Tröskeln som gäller, eller `null` om veckan inte ska nämnas än. */
export function purgeTier(daysLeft: number): PurgeTier | null {
  if (daysLeft <= 1) return 1;
  if (daysLeft <= 7) return 7;
  if (daysLeft <= 14) return 14;
  return null;
}

/** Dagar kvar och tröskel för en vecka, eller `null` om den inte ska nämnas. */
export function purgeInfo(week: string | null, now: Date): PurgeInfo | null {
  if (!week) return null;
  const daysLeft = daysUntilPurge(week, now);
  const tier = daysLeft === null ? null : purgeTier(daysLeft);
  return daysLeft !== null && tier ? { daysLeft, tier } : null;
}

/** Märket vid veckan: `6 dagar kvar`, `Sista dagen`. */
export function purgeBadge(daysLeft: number): string {
  return daysLeft <= 1 ? 'Sista dagen' : `${daysLeft} dagar kvar`;
}

/** När veckan gallras, som en del av en mening: `om 6 dagar`. */
export function purgeWhen(daysLeft: number): string {
  return daysLeft <= 1 ? 'efter i dag' : `om ${daysLeft} dagar`;
}

/**
 * Veckorna som ska nämnas överst, den som gallras först först. Avfärdade
 * veckor tas bort helt, även sista dagen.
 */
export function weeksNearPurge(
  weeks: readonly (string | null)[],
  now: Date,
  dismissed: readonly string[],
): (PurgeInfo & { week: string })[] {
  const skip = new Set(dismissed);
  return weeks
    .flatMap(week => {
      if (!week || skip.has(week)) return [];
      const info = purgeInfo(week, now);
      return info ? [{ week, ...info }] : [];
    })
    .sort((a, b) => a.daysLeft - b.daysLeft || a.week.localeCompare(b.week));
}

/** Avfärdade veckor från localStorage: bara veckonycklar, utan dubbletter. */
export function sanitizeDismissed(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.filter((x): x is string => typeof x === 'string' && isWeekKey(x)))).slice(0, 200);
}

/** Lägger till en avfärdad vecka och släpper de som redan är gallrade. */
export function dismissWeek(dismissed: readonly string[], week: string, now: Date): string[] {
  return Array.from(new Set([...dismissed, week])).filter(w => daysUntilPurge(w, now) !== null);
}
