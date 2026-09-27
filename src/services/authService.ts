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

const authHeader = (): HeadersInit => {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
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

// Enhanced fetch with authentication
export const fetchWithAuth = async (
  url: string, 
  options: RequestInit = {}
): Promise<Response> => {
  // Get auth headers
  const headers = authHeader();
  
  // Merge with existing headers
  const mergedHeaders = {
    ...headers,
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Create the fetch request with merged headers
  const response = await fetch(url, {
    ...options,
    headers: mergedHeaders
  });
  
  // Handle 401 Unauthorized responses (token expired or invalid)
  if (response.status === 401) {
    clearStoredAuth();
    
    // Redirect to login page if in browser context
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
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
