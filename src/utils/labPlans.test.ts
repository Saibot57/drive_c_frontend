import { describe, expect, it, vi } from 'vitest';
import { LAB_SEED } from '@/config/lessonLabSeed';
import type { LabPlan, LabPlanSummary, LabState } from '@/types/lessonLab';
import {
  changedLabel,
  importLegacyState,
  isOwnPlan,
  isSeedState,
  LEGACY_IMPORT_ID_KEY,
  LEGACY_MIGRATED_KEY,
  LEGACY_STATE_KEY,
  missingArchiveAccess,
  ownPlanCount,
  planFileName,
  sortPlans,
  uniquePlanName,
  upsertPlan,
} from './labPlans';
import { parseLabState } from './lessonLab';

const summary = (id: string, name: string, updatedAt: string | null = null): LabPlanSummary =>
  ({ id, name, version: 1, createdAt: null, updatedAt });

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
};

const changedState = (): LabState => ({ ...LAB_SEED, teams: [], teachers: LAB_SEED.teachers.slice(0, 2) });

const fakeCreate = () => vi.fn(async (plan: { id: string; name: string; state: LabState }): Promise<LabPlan> =>
  ({ ...plan, version: 1, createdAt: null, updatedAt: null }));

describe('uniquePlanName', () => {
  it('lägger till en siffra när namnet finns', () => {
    expect(uniquePlanName('Nytt upplägg', [])).toBe('Nytt upplägg');
    expect(uniquePlanName('Nytt upplägg', ['nytt upplägg'])).toBe('Nytt upplägg 2');
    expect(uniquePlanName('Nytt upplägg', ['Nytt upplägg', 'Nytt upplägg 2'])).toBe('Nytt upplägg 3');
  });

  it('använder standardnamnet för tomt namn', () => {
    expect(uniquePlanName('  ', [])).toBe('Nytt upplägg');
  });
});

describe('ordning och rader', () => {
  it('senast ändrade först, lika tider i namnordning', () => {
    const plans = [
      summary('a', 'Örn', '2026-09-30T10:00:00'),
      summary('b', 'Björk', '2026-09-30T12:00:00'),
      summary('c', 'Al', '2026-09-30T10:00:00'),
    ];
    expect(sortPlans(plans).map(p => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('upsert ersätter raden och tar inte med läget', () => {
    const plans = [summary('a', 'A', '2026-09-30T10:00:00'), summary('b', 'B', '2026-09-30T11:00:00')];
    const next = upsertPlan(plans, { ...summary('a', 'A2', '2026-09-30T12:00:00'), state: LAB_SEED } as LabPlan);
    expect(next.map(p => p.name)).toEqual(['A2', 'B']);
    expect(next[0]).not.toHaveProperty('state');
  });
});

describe('delning', () => {
  it('upsert behåller ägare och delning', () => {
    const shared = { ...summary('a', 'A'), ownerUsername: 'anna', isOwner: false, sharedWith: ['bo'] };
    expect(upsertPlan([], shared)[0]).toEqual(shared);
  });

  it('upplägg utan uppgift om ägare räknas som egna', () => {
    const plans = [
      summary('a', 'A'),
      { ...summary('b', 'B'), isOwner: true },
      { ...summary('c', 'C'), isOwner: false, ownerUsername: 'anna' },
    ];
    expect(plans.map(isOwnPlan)).toEqual([true, true, false]);
    expect(ownPlanCount(plans)).toBe(2);
  });

  it('säger vilka med tillgång till upplägget som inte når arkivet', () => {
    const plan = { ownerUsername: 'tobias', sharedWith: ['hanna', 'gustav'] };
    expect(missingArchiveAccess(plan, { ownerUsername: 'tobias', sharedWith: ['hanna'] })).toEqual(['gustav']);
    expect(missingArchiveAccess(plan, { ownerUsername: 'hanna', sharedWith: [] })).toEqual(['tobias', 'gustav']);
    expect(missingArchiveAccess({ ownerUsername: 'tobias', sharedWith: [] }, { ownerUsername: 'tobias', sharedWith: [] })).toEqual([]);
    expect(missingArchiveAccess(plan, null)).toBeNull();
  });
});

describe('texter', () => {
  it('filnamnet behåller åäö', () => {
    expect(planFileName('Höstens upplägg', new Date('2026-09-30T12:00:00Z'))).toBe('arbetslag-Höstens-upplägg-2026-09-30.json');
    expect(planFileName('!!', new Date('2026-09-30T12:00:00Z'))).toBe('arbetslag-arbetslag-2026-09-30.json');
  });

  it('visar klockslag i dag och datum annars, med serverns tid som UTC', () => {
    const now = new Date('2026-09-30T15:00:00+02:00');
    expect(changedLabel('2026-09-30T12:32:00', now)).toBe('Ändrad 14:32');
    expect(changedLabel('2026-09-28T12:32:00', now)).toBe('Ändrad 28 sep');
    expect(changedLabel(null, now)).toBe('');
  });
});

describe('isSeedState', () => {
  it('känner igen tavlan efter tvätten men inte en ändrad', () => {
    expect(isSeedState(parseLabState(LAB_SEED)!)).toBe(true);
    expect(isSeedState(parseLabState(JSON.parse(JSON.stringify(LAB_SEED)))!)).toBe(true);
    expect(isSeedState(parseLabState(changedState())!)).toBe(false);
  });
});

describe('importLegacyState', () => {
  const now = new Date('2026-09-30T12:00:00Z');

  it('importerar det gamla läget även när servern redan har upplägg', async () => {
    const storage = memoryStorage({ [LEGACY_STATE_KEY]: JSON.stringify(changedState()) });
    const create = fakeCreate();
    const plan = await importLegacyState([summary('x', 'Mitt upplägg')], { storage, create, newId: () => 'id-1', now });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ id: 'id-1', name: 'Mitt upplägg (importerat 30 sep)' });
    expect(create.mock.calls[0][0].state.teachers).toHaveLength(2);
    expect(plan?.id).toBe('id-1');
    expect(storage.data.get(LEGACY_MIGRATED_KEY)).toBe('id-1');
    // Den gamla nyckeln ligger kvar som reservkopia.
    expect(storage.data.has(LEGACY_STATE_KEY)).toBe(true);
  });

  it('heter Mitt upplägg när namnet är ledigt', async () => {
    const storage = memoryStorage({ [LEGACY_STATE_KEY]: JSON.stringify(changedState()) });
    const create = fakeCreate();
    await importLegacyState([], { storage, create, newId: () => 'id-1', now });
    expect(create.mock.calls[0][0].name).toBe('Mitt upplägg');
  });

  it('importerar inte två gånger', async () => {
    const storage = memoryStorage({ [LEGACY_STATE_KEY]: JSON.stringify(changedState()), [LEGACY_MIGRATED_KEY]: 'id-1' });
    const create = fakeCreate();
    expect(await importLegacyState([], { storage, create, newId: () => 'id-2', now })).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('hoppar över tavlan och trasiga lägen men sätter markeringen', async () => {
    for (const raw of [JSON.stringify(LAB_SEED), '{inte json', JSON.stringify({ version: 9 })]) {
      const storage = memoryStorage({ [LEGACY_STATE_KEY]: raw });
      const create = fakeCreate();
      expect(await importLegacyState([], { storage, create, newId: () => 'id-1', now })).toBeNull();
      expect(create).not.toHaveBeenCalled();
      expect(storage.data.has(LEGACY_MIGRATED_KEY)).toBe(true);
    }
  });

  it('gör ingenting utan gammalt läge', async () => {
    const storage = memoryStorage();
    const create = fakeCreate();
    expect(await importLegacyState([], { storage, create, newId: () => 'id-1', now })).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('skriver id:t före anropet och återanvänder det efter ett fel', async () => {
    const storage = memoryStorage({ [LEGACY_STATE_KEY]: JSON.stringify(changedState()) });
    const failing = vi.fn(async () => {
      expect(storage.data.get(LEGACY_IMPORT_ID_KEY)).toBe('id-1');
      throw new Error('Nätverksfel');
    });
    await expect(importLegacyState([], { storage, create: failing, newId: () => 'id-1', now })).rejects.toThrow('Nätverksfel');
    expect(storage.data.has(LEGACY_MIGRATED_KEY)).toBe(false);

    const create = fakeCreate();
    // Upplägget med id:t finns redan (POST gick fram fast svaret tappades): namnet krockar inte med sig självt.
    await importLegacyState([summary('id-1', 'Mitt upplägg')], { storage, create, newId: () => 'id-2', now });
    expect(create.mock.calls[0][0]).toMatchObject({ id: 'id-1', name: 'Mitt upplägg' });
  });
});
