// src/services/authService.ts

import { API_URL } from '@/config/api';

/** Nycklarna inloggningen sparas under i localStorage. */
const AUTH_TOKEN_KEY = 'authToken';
const AUTH_USER_KEY = 'user';

export interface User {
  id: string;
  username: string;
  email?: string;
  createdAt?: string;
  lastLogin?: string;
}

export type AuthSession = { token: string; user: User };

const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }
  return null;
};

export const storeAuth = ({ token, user }: AuthSession) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};

export const readStoredAuth = (): AuthSession | null => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const user = localStorage.getItem(AUTH_USER_KEY);
  return token && user ? { token, user: JSON.parse(user) } : null;
};

export const clearStoredAuth = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
};

/**
 * Inloggning som gått ut (dataintegritet F14). Förut skickade ett 401 sidan
 * till /login, och allt som väntade på att sparas försvann med sidan. Nu
 * väntar anropet i stället medan AuthProvider visar en inloggningsruta, och
 * skickas om med den nya token. Sidan ligger kvar, så alla sparköer behåller
 * det som väntar. Ett 401 kommer innan servern skrivit något, så versionerna
 * i schemat och arbetslaget stämmer fortfarande när anropet körs om.
 */
let relogin: { promise: Promise<void>; resolve: () => void } | null = null;
const sessionListeners = new Set<(expired: boolean) => void>();

/** Om en inloggning väntar efter ett 401. */
export const isSessionExpired = (): boolean => relogin !== null;

/** Anropas med true när inloggningen gått ut och false när den är tillbaka. */
export const onSessionExpiredChange = (listener: (expired: boolean) => void): (() => void) => {
  sessionListeners.add(listener);
  return () => { sessionListeners.delete(listener); };
};

/** Väntar tills någon loggat in igen. Flera samtidiga 401 delar på en inloggning. */
const waitForLogin = (): Promise<void> => {
  if (!relogin) {
    let resolve!: () => void;
    const promise = new Promise<void>(r => { resolve = r; });
    relogin = { promise, resolve };
    // En omladdning medan rutan visas ska fortfarande hamna på /login.
    clearStoredAuth();
    sessionListeners.forEach(listener => listener(true));
  }
  return relogin.promise;
};

/**
 * Loggar in igen efter ett 401 och släpper anropen som väntar. Bara samma
 * användare får logga in här: det som väntar hör till det kontot och får
 * inte sparas i ett annat.
 */
export const reauthenticate = async (
  username: string,
  password: string,
  expectedUserId: string,
): Promise<AuthSession> => {
  const session = await login(username, password);
  if (session.user.id !== expectedUserId) {
    throw new Error('Här går det bara att logga in som samma användare. Logga ut för att byta konto.');
  }
  storeAuth(session);
  const waiting = relogin;
  relogin = null;
  sessionListeners.forEach(listener => listener(false));
  waiting?.resolve();
  return session;
};

/** fetch med inloggningens token. Vid 401 väntar anropet på en ny inloggning, se ovan. */
export const fetchWithAuth = async (
  url: string, 
  options: RequestInit = {}
): Promise<Response> => {
  const send = (token: string | null, init: RequestInit) => fetch(url, {
    ...init,
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  let token = getToken();
  let response = await send(token, options);

  // Även ett anrop med keepalive väntar: det skickas också när fliken bara
  // döljs, och ett 401 där skulle annars släppa ändringen. Stängs sidan
  // försvinner det som förut.
  while (response.status === 401 && typeof window !== 'undefined') {
    // Har någon loggat in sedan anropet skickades räcker det att skicka om.
    const current = getToken();
    if (!current || current === token) await waitForLogin();
    token = getToken();
    // Sidan lever, eftersom någon just loggade in, så keepalive behövs inte.
    response = await send(token, { ...options, keepalive: false });
  }

  return response;
};

/** POST mot auth-API:t. Kastar med serverns felmeddelande när svaret inte är ok. */
const postAuth = async (path: string, body: object, fallbackError: string): Promise<AuthSession> => {
  const response = await fetch(`${API_URL}/auth/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || fallbackError);
  }
  return data.data;
};

export const login = (username: string, password: string) =>
  postAuth('login', { username, password }, 'Login failed');

export const register = (username: string, password: string, inviteCode: string, email?: string) =>
  postAuth('register', { username, password, inviteCode, email }, 'Registration failed');
