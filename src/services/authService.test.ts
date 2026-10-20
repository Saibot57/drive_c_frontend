import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStoredAuth,
  fetchWithAuth,
  isSessionExpired,
  login,
  onSessionExpiredChange,
  readStoredAuth,
  reauthenticate,
  register,
  storeAuth,
} from './authService';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
};

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('login och register', () => {
  it('returnerar token och användare', async () => {
    const session = { token: 't1', user: { id: 'u1', username: 'tobias' } };
    vi.stubGlobal('fetch', respond(200, { success: true, data: session }));
    await expect(login('tobias', 'hemligt')).resolves.toEqual(session);
  });

  it('kastar med serverns felmeddelande', async () => {
    vi.stubGlobal('fetch', respond(401, { success: false, error: 'Fel lösenord' }));
    await expect(login('tobias', 'fel')).rejects.toThrow('Fel lösenord');
  });

  it('har ett eget reservmeddelande för registrering', async () => {
    vi.stubGlobal('fetch', respond(400, { success: false }));
    await expect(register('ny', 'lösen', 'kod')).rejects.toThrow('Registration failed');
  });
});

describe('sparad inloggning', () => {
  it('sparas, läses och rensas', () => {
    const session = { token: 't1', user: { id: 'u1', username: 'tobias' } };
    expect(readStoredAuth()).toBeNull();
    storeAuth(session);
    expect(readStoredAuth()).toEqual(session);
    clearStoredAuth();
    expect(readStoredAuth()).toBeNull();
  });
});

describe('fetchWithAuth när inloggningen gått ut (dataintegritet F14)', () => {
  const alice = { token: 'gammal', user: { id: 'u1', username: 'alice' } };
  const fresh = { token: 'ny', user: { id: 'u1', username: 'alice' } };

  /** Svar på API-anrop efter token; inloggningen svarar med `loginAs`. */
  const server = (loginAs: { token: string; user: { id: string; username: string } }) => vi.fn(
    async (url: string, init: RequestInit = {}) => {
      if (url.endsWith('/auth/login')) {
        return { ok: true, status: 200, json: async () => ({ success: true, data: loginAs }) };
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      const status = auth === `Bearer ${fresh.token}` ? 200 : 401;
      return { ok: status === 200, status, json: async () => ({ success: status === 200 }) };
    },
  );

  const apiCalls = (fetchMock: ReturnType<typeof server>) => fetchMock.mock.calls
    .filter(([url]) => !String(url).endsWith('/auth/login'))
    .map(([url, init]) => [url, (init?.headers as Record<string, string>).Authorization ?? null, init?.keepalive ?? false]);

  /** Låter väntande löften gå klart. */
  const settle = async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  };

  let location: { href: string };

  beforeEach(() => {
    location = { href: '/schema' };
    vi.stubGlobal('window', { location });
    storeAuth(alice);
  });

  afterEach(async () => {
    // Släpper en inloggning som ett test lämnat öppen, så att nästa test börjar om.
    if (isSessionExpired()) {
      vi.stubGlobal('fetch', server(fresh));
      await reauthenticate('alice', 'lösen', 'u1');
    }
  });

  it('skickar inte till /login utan väntar och kör om anropet med den nya token', async () => {
    const fetchMock = server(fresh);
    vi.stubGlobal('fetch', fetchMock);

    let response: Response | undefined;
    const call = fetchWithAuth('/api/workspace/elements/e1', { method: 'PUT', body: '{}' })
      .then(r => { response = r; });
    await settle();

    expect(location.href).toBe('/schema');
    expect(isSessionExpired()).toBe(true);
    expect(response).toBeUndefined();

    await reauthenticate('alice', 'lösen', 'u1');
    await call;

    expect(response?.status).toBe(200);
    expect(isSessionExpired()).toBe(false);
    expect(readStoredAuth()).toEqual(fresh);
    expect(apiCalls(fetchMock)).toEqual([
      ['/api/workspace/elements/e1', 'Bearer gammal', false],
      ['/api/workspace/elements/e1', 'Bearer ny', false],
    ]);
  });

  it('ger en enda inloggning för flera samtidiga 401', async () => {
    const fetchMock = server(fresh);
    vi.stubGlobal('fetch', fetchMock);
    const changes: boolean[] = [];
    const stop = onSessionExpiredChange(expired => changes.push(expired));

    const calls = Promise.all([
      fetchWithAuth('/api/planner/a'),
      fetchWithAuth('/api/calendar/b'),
      fetchWithAuth('/api/arbetslag/c'),
    ]);
    await settle();
    expect(changes).toEqual([true]);

    await reauthenticate('alice', 'lösen', 'u1');
    const responses = await calls;
    stop();

    expect(responses.map(r => r.status)).toEqual([200, 200, 200]);
    expect(changes).toEqual([true, false]);
  });

  it('nekar inloggning som en annan användare, och anropet fortsätter vänta', async () => {
    const fetchMock = server({ token: 'ny', user: { id: 'u2', username: 'bob' } });
    vi.stubGlobal('fetch', fetchMock);

    let done = false;
    const call = fetchWithAuth('/api/planner/a').then(() => { done = true; });
    await settle();

    await expect(reauthenticate('bob', 'lösen', 'u1')).rejects.toThrow(/samma användare/);
    await settle();
    expect(done).toBe(false);
    expect(isSessionExpired()).toBe(true);
    expect(readStoredAuth()).toBeNull();

    vi.stubGlobal('fetch', server(fresh));
    await reauthenticate('alice', 'lösen', 'u1');
    await call;
    expect(done).toBe(true);
  });

  it('väntar även med keepalive, och skickar om utan keepalive', async () => {
    // En dold flik sparar med keepalive. Ett 401 där får inte släppa ändringen.
    const fetchMock = server(fresh);
    vi.stubGlobal('fetch', fetchMock);

    const call = fetchWithAuth('/api/planner/a', { method: 'PUT', body: '{}', keepalive: true });
    await settle();
    expect(isSessionExpired()).toBe(true);

    await reauthenticate('alice', 'lösen', 'u1');
    expect((await call).status).toBe(200);
    expect(apiCalls(fetchMock)).toEqual([
      ['/api/planner/a', 'Bearer gammal', true],
      ['/api/planner/a', 'Bearer ny', false],
    ]);
  });

  it('skickar om direkt när någon redan loggat in sedan anropet skickades (regressionsskydd)', async () => {
    let answer!: (r: unknown) => void;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }))
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);

    const call = fetchWithAuth('/api/planner/a');
    await settle();
    // Anropet med den gamla token är i flykt när en ny inloggning sparas.
    storeAuth(fresh);
    answer({ ok: false, status: 401, json: async () => ({ success: false }) });

    expect((await call).status).toBe(200);
    expect(isSessionExpired()).toBe(false);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer ny');
  });

  it('släpper igenom andra fel utan att fråga efter inloggning (regressionsskydd)', async () => {
    vi.stubGlobal('fetch', respond(403, { success: false }));
    expect((await fetchWithAuth('/api/planner/a')).status).toBe(403);
    expect(isSessionExpired()).toBe(false);
    expect(readStoredAuth()).toEqual(alice);
  });
});
