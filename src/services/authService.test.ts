import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStoredAuth, login, readStoredAuth, register, storeAuth } from './authService';

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
