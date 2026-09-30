import { LAB_SEED } from '@/config/lessonLabSeed';
import type { LabPlan, LabPlanSummary, LabState } from '@/types/lessonLab';
import { toFileSlug } from '@/utils/download';
import { parseLabState } from '@/utils/lessonLab';

/**
 * Det som går att räkna ut om Arbetslags sparade upplägg utan React och
 * utan server: namn, ordning, filnamn och importen av det gamla läget.
 */

/** Samma gräns som servern (`MAX_PLANS_PER_USER`). */
export const MAX_PLANS = 50;

export const DEFAULT_PLAN_NAME = 'Mitt upplägg';
export const NEW_PLAN_NAME = 'Nytt upplägg';

/** `base`, eller `base 2`, `base 3` … om namnet redan finns. */
export const uniquePlanName = (base: string, existing: readonly string[]): string => {
  const taken = new Set(existing.map(name => name.trim().toLocaleLowerCase('sv')));
  const trimmed = base.trim() || NEW_PLAN_NAME;
  if (!taken.has(trimmed.toLocaleLowerCase('sv'))) return trimmed;
  for (let n = 2; ; n++) {
    const candidate = `${trimmed} ${n}`;
    if (!taken.has(candidate.toLocaleLowerCase('sv'))) return candidate;
  }
};

/** Senast ändrade först. Lika tider i namnordning, så att listan inte hoppar. */
export const sortPlans = <T extends LabPlanSummary>(plans: readonly T[]): T[] =>
  [...plans].sort((a, b) =>
    (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.name.localeCompare(b.name, 'sv'));

export const toSummary = ({ id, name, version, createdAt, updatedAt }: LabPlanSummary): LabPlanSummary =>
  ({ id, name, version, createdAt, updatedAt });

/** Lägger till eller ersätter en rad och sorterar om. */
export const upsertPlan = (plans: readonly LabPlanSummary[], plan: LabPlanSummary): LabPlanSummary[] =>
  sortPlans([...plans.filter(p => p.id !== plan.id), toSummary(plan)]);

/** "30 sep", utan punkten som `sv-SE` sätter efter månaden. */
export const shortDate = (date: Date): string =>
  new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(date).replace(/\.$/, '');

/** "Ändrad 14:32" i dag, annars "Ändrad 28 sep". */
export const changedLabel = (iso: string | null, now: Date = new Date()): string => {
  if (!iso) return '';
  // Servern skickar UTC utan tidszon.
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return '';
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? `Ändrad ${date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
    : `Ändrad ${shortDate(date)}`;
};

/** Filnamnet när ett upplägg sparas som fil. `toFileSlug` behåller åäö. */
export const planFileName = (name: string, date: Date = new Date()): string =>
  `arbetslag-${toFileSlug(name, 'arbetslag')}-${date.toISOString().slice(0, 10)}.json`;

const SEED_JSON = JSON.stringify(parseLabState(LAB_SEED));

/** Sant om läget är tavlan som den levereras, alltså inget att importera. */
export const isSeedState = (state: LabState): boolean => JSON.stringify(state) === SEED_JSON;

// --- Import av läget som bara låg i webbläsaren ---

export const LEGACY_STATE_KEY = 'lessonLab.state.v1';
/** Satt när importen är gjord (upplägget id) eller inte behövs. */
export const LEGACY_MIGRATED_KEY = `${LEGACY_STATE_KEY}.migrated`;
/** Id:t importen skickar. Skrivs före anropet, så att ett omförsök skickar samma. */
export const LEGACY_IMPORT_ID_KEY = `${LEGACY_STATE_KEY}.importId`;

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type LegacyImportDeps = {
  storage: KeyValueStorage;
  create: (plan: { id: string; name: string; state: LabState }) => Promise<LabPlan>;
  newId: () => string;
  now?: Date;
};

const readLegacyState = (storage: KeyValueStorage): LabState | null => {
  const raw = storage.getItem(LEGACY_STATE_KEY);
  if (raw === null) return null;
  try {
    return parseLabState(JSON.parse(raw));
  } catch {
    return null;
  }
};

/**
 * Importerar läget från tiden då Arbetslag bara sparade i webbläsaren, en
 * gång per webbläsare. Villkoret är markeringen, inte en tom lista: har
 * läget legat i två webbläsare ska båda komma med.
 *
 * Den gamla nyckeln lämnas kvar som reservkopia. Misslyckas anropet sätts
 * ingen markering, så importen görs nästa gång.
 */
export const importLegacyState = async (
  existing: readonly LabPlanSummary[],
  { storage, create, newId, now = new Date() }: LegacyImportDeps,
): Promise<LabPlan | null> => {
  if (storage.getItem(LEGACY_MIGRATED_KEY)) return null;

  const state = readLegacyState(storage);
  if (!state || isSeedState(state)) {
    storage.setItem(LEGACY_MIGRATED_KEY, 'inget att importera');
    return null;
  }

  let id = storage.getItem(LEGACY_IMPORT_ID_KEY);
  if (!id) {
    id = newId();
    storage.setItem(LEGACY_IMPORT_ID_KEY, id);
  }

  const names = existing.filter(p => p.id !== id).map(p => p.name);
  const taken = names.some(n => n.trim().toLocaleLowerCase('sv') === DEFAULT_PLAN_NAME.toLocaleLowerCase('sv'));
  const name = taken
    ? uniquePlanName(`${DEFAULT_PLAN_NAME} (importerat ${shortDate(now)})`, names)
    : DEFAULT_PLAN_NAME;

  const plan = await create({ id, name, state });
  storage.setItem(LEGACY_MIGRATED_KEY, plan.id);
  return plan;
};
