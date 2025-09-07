// src/services/authService.ts

// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tobiaslundh1.pythonanywhere.com/api';

// Helper function to get auth token from local storage
export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken');
  }
  return null;
};

// Decode JWT token to check expiry
const decodeToken = (token: string): { exp: number } | null => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
};

// Refresh access token using refresh endpoint
let refreshPromise: Promise<void> | null = null;
const refreshToken = async (): Promise<void> => {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          throw new Error(data.error || 'Failed to refresh token');
        }
        if (data.data?.token) {
          localStorage.setItem('authToken', data.data.token);
        }
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Ensure token is valid before making request
const ensureTokenValid = async () => {
  const token = getToken();
  if (!token) return;
  const payload = decodeToken(token);
  if (!payload) return;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp - now < 60) {
    await refreshToken();
  }
};

// Helper function to set authorization header
export const authHeader = (): HeadersInit => {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Enhanced fetch with authentication
export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {},
): Promise<any> => {
  await ensureTokenValid();

  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const makeRequest = () =>
    fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });

  let response = await makeRequest();

  if (response.status === 401) {
    try {
      await refreshToken();
      const newToken = getToken();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
      }
      response = await makeRequest();
    } catch {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
  }

  return response.json();
};

// Function to check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!getToken();
};

// Services that return appropriate functions
const authService = {
  login: async (username: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Login failed');
    }
    if (data.data?.token) {
      localStorage.setItem('authToken', data.data.token);
    }
    if (data.data?.user) {
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },

  register: async (username: string, password: string, email?: string) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password, email }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Registration failed');
    }
    if (data.data?.token) {
      localStorage.setItem('authToken', data.data.token);
    }
    if (data.data?.user) {
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },

  getUserProfile: async () => {
    const response = await fetchWithAuth(`${API_URL}/auth/me`);
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch profile');
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }
};

export default authService;

