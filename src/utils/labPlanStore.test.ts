import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAB_SEED } from '@/config/lessonLabSeed';
import { PlanConflictError, SavePlanBody } from '@/services/arbetslagService';
import type { LabPlan, LabState } from '@/types/lessonLab';
import { createPlanStore, SaveStatus } from './labPlanStore';

const withName = (name: string): LabState => ({ ...LAB_SEED, classes: [...LAB_SEED.classes], teams: [], teachers: LAB_SEED.teachers.map(t => ({ ...t, name })) });

const plan = (version: number, state: LabState = LAB_SEED): LabPlan =>
  ({ id: 'p1', name: 'Mitt upplägg', version, createdAt: null, updatedAt: null, state });

/** En falsk server: varje anrop väntar tills testet släpper det. */
const fakeServer = () => {
  let version = 1;
  const calls: SavePlanBody[] = [];
  const waiting: Array<() => void> = [];
  const save = vi.fn((_id: string, body: SavePlanBody) => {
    calls.push(body);
    return new Promise<LabPlan>((resolve, reject) => {
      waiting.push(() => {
        if (body.version !== version) {
          reject(new PlanConflictError(version));
          return;
        }
        version += 1;
        resolve(plan(version, body.state));
      });
    });
  });
  const release = async () => {
    const next = waiting.shift();
    next?.();
    await vi.advanceTimersByTimeAsync(0);
  };
  return { save, calls, release, bump: () => { version += 1; }, get pending() { return waiting.length; } };
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const setup = () => {
  const server = fakeServer();
  const store = createPlanStore({ save: server.save, delayMs: 800 });
  store.adopt(plan(1));
  const statuses: SaveStatus[] = [];
  store.subscribe('p1', event => statuses.push(event.status));
  return { server, store, statuses };
};

describe('labPlanStore', () => {
  it('slår ihop snabba ändringar till ett anrop', async () => {
    const { server, store } = setup();
    store.schedule('p1', withName('a'));
    await vi.advanceTimersByTimeAsync(500);
    store.schedule('p1', withName('b'));
    await vi.advanceTimersByTimeAsync(799);
    expect(server.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].state?.teachers[0].name).toBe('b');
    expect(server.calls[0].version).toBe(1);
    await server.release();
    expect(store.status('p1')).toBe('saved');
  });

  it('flush skickar direkt och blir klar först när sparningen är klar', async () => {
    const { server, store } = setup();
    store.schedule('p1', withName('a'));
    let done = false;
    const flushed = store.flush('p1').then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(server.calls).toHaveLength(1);
    expect(done).toBe(false);
    await server.release();
    await flushed;
    expect(done).toBe(true);
    // Timern är stoppad: inget andra anrop efter debouncen.
    await vi.advanceTimersByTimeAsync(2000);
    expect(server.calls).toHaveLength(1);
  });

  it('skickar aldrig två anrop samtidigt, och nästa får versionen från svaret', async () => {
    const { server, store } = setup();
    store.schedule('p1', withName('a'));
    await vi.advanceTimersByTimeAsync(800);
    expect(server.pending).toBe(1);

    store.schedule('p1', withName('b'));
    await vi.advanceTimersByTimeAsync(800);
    expect(server.calls).toHaveLength(1);

    await server.release();
    expect(server.calls).toHaveLength(2);
    expect(server.calls[1]).toMatchObject({ version: 2 });
    expect(server.calls[1].state?.teachers[0].name).toBe('b');
    await server.release();
    expect(store.status('p1')).toBe('saved');
  });

  it('flush under ett anrop i flykt väntar in även det som ändrats under tiden', async () => {
    const { server, store } = setup();
    store.schedule('p1', withName('a'));
    await vi.advanceTimersByTimeAsync(800);
    store.schedule('p1', withName('b'));

    let done = false;
    const flushed = store.flush('p1').then(() => { done = true; });
    await server.release();
    expect(server.calls).toHaveLength(2);
    expect(done).toBe(false);
    await server.release();
    await flushed;
    expect(done).toBe(true);
    expect(store.status('p1')).toBe('saved');
  });

  it('byter namn genom samma kö', async () => {
    const { server, store } = setup();
    store.schedule('p1', withName('a'));
    const renamed = store.rename('p1', 'Höstens upplägg');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0]).toMatchObject({ version: 1, name: 'Höstens upplägg' });
    expect(server.calls[0].state).toBeDefined();
    await server.release();
    await renamed;

    store.rename('p1', 'Vårens');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.calls[1]).toEqual({ version: 2, name: 'Vårens' });
    await server.release();
  });

  it('slutar spara efter en konflikt tills upplägget läses om', async () => {
    const { server, store, statuses } = setup();
    server.bump();
    store.schedule('p1', withName('a'));
    await vi.advanceTimersByTimeAsync(800);
    await server.release();
    expect(store.status('p1')).toBe('conflict');
    expect(statuses.at(-1)).toBe('conflict');

    store.schedule('p1', withName('b'));
    await vi.advanceTimersByTimeAsync(2000);
    await store.flush('p1');
    expect(server.calls).toHaveLength(1);

    // Ett nytt besök på sidan ser de osparade ändringarna och konflikten.
    expect(store.adopt(plan(2)).teachers[0].name).toBe('b');

    store.reset('p1');
    expect(store.adopt(plan(2))).toBe(LAB_SEED);
    store.schedule('p1', withName('c'));
    await vi.advanceTimersByTimeAsync(800);
    expect(server.calls[1]).toMatchObject({ version: 2 });
  });

  it('behåller ändringen efter ett fel och försöker igen', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('Nätverksfel'))
      .mockImplementation(async (_id: string, body: SavePlanBody) => plan(body.version + 1, body.state));
    const store = createPlanStore({ save, delayMs: 800 });
    store.adopt(plan(1));

    store.schedule('p1', withName('a'));
    await store.flush('p1');
    expect(store.status('p1')).toBe('error');
    expect(store.error('p1')).toBe('Nätverksfel');

    // Ett nytt besök visar det osparade läget, inte serverns.
    expect(store.adopt(plan(1)).teachers[0].name).toBe('a');

    await store.flush('p1');
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][1].state.teachers[0].name).toBe('a');
    expect(store.status('p1')).toBe('saved');
  });

  it('adopt tar serverns version när kön är tom', async () => {
    const save = vi.fn(async (_id: string, body: SavePlanBody) => plan(body.version + 1, body.state));
    const store = createPlanStore({ save });
    expect(store.adopt(plan(7))).toBe(LAB_SEED);
    store.schedule('p1', withName('a'));
    await store.flush('p1');
    expect(save.mock.calls[0][1].version).toBe(7);
  });
});
