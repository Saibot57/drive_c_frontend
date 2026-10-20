import type { PlannerActivity, PublicSchedulePayload } from '@/types/schedule';

/**
 * Senaste lyckade hämtningen av en publik schemalänk, sparad i deltagarens
 * webbläsare.
 *
 * Den 20 oktober 2026 kl. 06.55–07.31 gick MySQL hos PythonAnywhere inte att
 * nå, och deltagare som öppnade länken på morgonen fick bara ett felmeddelande.
 * Med en sparad kopia visar sidan i stället det schema de senast såg, märkt
 * med när det uppdaterades och att det inte gick att kontrollera just nu.
 *
 * Nyckeln är per token: två länkar kan peka på olika scheman. Kopian är en
 * bekvämlighet, så rensad lagring eller ett privat fönster ger bara samma
 * felvy som förut.
 */
export const PUBLIC_SCHEDULE_CACHE_PREFIX = 'publicSchedule.cache.v1.';

export const publicScheduleCacheKey = (token: string) => `${PUBLIC_SCHEDULE_CACHE_PREFIX}${token}`;

type CacheStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type CachedPublicSchedule = {
  updatedAt: string | null;
  payload: PublicSchedulePayload;
};

/** `window.localStorage` kan saknas (servern) eller kasta (avstängd lagring). */
const defaultStorage = (): CacheStorage => window.localStorage;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const stringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/**
 * Läser det som sparats defensivt: en äldre eller trasig kopia ska ge `null`,
 * inte en krasch i vyn. Aktiviteterna tvättas vidare av
 * `mapPlannerActivitiesToSchedule`, här rensas bara det som inte är objekt.
 */
export const sanitizeCachedSchedule = (input: unknown): PublicSchedulePayload | null => {
  if (!isRecord(input) || !isRecord(input.payload)) return null;
  const payload = input.payload;
  if (!Array.isArray(payload.activities)) return null;

  return {
    label: stringOrNull(payload.label),
    archiveName: stringOrNull(payload.archiveName),
    updatedAt: stringOrNull(input.updatedAt) ?? stringOrNull(payload.updatedAt),
    activities: payload.activities.filter(isRecord) as unknown as PlannerActivity[],
    colorTriggers: payload.colorTriggers,
    roomTriggers: payload.roomTriggers,
  };
};

export const readCachedSchedule = (
  token: string,
  storage?: CacheStorage
): PublicSchedulePayload | null => {
  try {
    const raw = (storage ?? defaultStorage()).getItem(publicScheduleCacheKey(token));
    return raw ? sanitizeCachedSchedule(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const writeCachedSchedule = (
  token: string,
  payload: PublicSchedulePayload,
  storage?: CacheStorage
) => {
  const entry: CachedPublicSchedule = { updatedAt: payload.updatedAt, payload };
  try {
    (storage ?? defaultStorage()).setItem(publicScheduleCacheKey(token), JSON.stringify(entry));
  } catch {
    // Avstängd eller full lagring. Sidan fungerar som förut, utan reservkopia.
  }
};

export const clearCachedSchedule = (token: string, storage?: CacheStorage) => {
  try {
    (storage ?? defaultStorage()).removeItem(publicScheduleCacheKey(token));
  } catch {
    // Går inte lagringen att nå finns inget att rensa heller.
  }
};
