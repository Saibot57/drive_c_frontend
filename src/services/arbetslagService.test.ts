import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAB_SEED } from '@/config/lessonLabSeed';
import { arbetslagService, PlanConflictError } from './arbetslagService';

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

const raw = (state: unknown) => ({ id: 'p1', name: 'Mitt upplägg', version: 3, createdAt: null, updatedAt: null, state });

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => 'token', setItem: () => {}, removeItem: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('arbetslagService', () => {
  it('känner igen en konflikt och läser serverns version', async () => {
    vi.stubGlobal('fetch', respond(409, { success: false, error: 'Upplägget har ändrats någon annanstans', data: { version: 5 } }));
    const error = await arbetslagService.savePlan('p1', { version: 3, name: 'x' }).catch(e => e);
    expect(error).toBeInstanceOf(PlanConflictError);
    expect(error.currentVersion).toBe(5);
  });

  it('kastar serverns felmeddelande för andra fel', async () => {
    vi.stubGlobal('fetch', respond(400, { success: false, error: 'Upplägget är för stort (högst 512 kB)' }));
    await expect(arbetslagService.savePlan('p1', { version: 3, state: LAB_SEED })).rejects.toThrow('för stort');
  });

  it('tvättar läget och visar tavlan när det inte går att läsa', async () => {
    vi.stubGlobal('fetch', respond(200, { success: true, data: raw({ version: 9 }) }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plan = await arbetslagService.getPlan('p1');
    expect(plan.state).toBe(LAB_SEED);
    expect(plan.version).toBe(3);
    warn.mockRestore();
  });

  it('skickar klientens id när ett upplägg skapas', async () => {
    const fetch = respond(201, { success: true, data: raw(LAB_SEED) });
    vi.stubGlobal('fetch', fetch);
    await arbetslagService.createPlan({ id: 'p1', name: 'Mitt upplägg', state: LAB_SEED });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/arbetslag$/);
    expect(JSON.parse(init.body)).toMatchObject({ id: 'p1', name: 'Mitt upplägg' });
  });

  it('delar med ett användarnamn och läser svaret som en rad i listan', async () => {
    const fetch = respond(201, { success: true, data: { id: 'p1', name: 'Mitt upplägg', version: 3, createdAt: null, updatedAt: null, sharedWith: ['hanna'] } });
    vi.stubGlobal('fetch', fetch);
    const shared = await arbetslagService.addShare('p1', 'hanna');
    expect(shared.sharedWith).toEqual(['hanna']);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/arbetslag\/p1\/shares$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ username: 'hanna' });
  });

  it('tar bort en delning med kodat namn och visar serverns fel', async () => {
    const fetch = respond(200, { success: true, data: { id: 'p1' } });
    vi.stubGlobal('fetch', fetch);
    await arbetslagService.removeShare('p1', 'å b');
    expect(fetch.mock.calls[0][0]).toMatch(/\/arbetslag\/p1\/shares\/%C3%A5%20b$/);
    expect(fetch.mock.calls[0][1].method).toBe('DELETE');

    vi.stubGlobal('fetch', respond(403, { success: false, error: 'Bara ägaren kan ta bort andras tillgång' }));
    await expect(arbetslagService.removeShare('p1', 'bo')).rejects.toThrow('Bara ägaren');
  });
});
