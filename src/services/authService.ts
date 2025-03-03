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

// Helper function to set authorization header
export const authHeader = (): HeadersInit => {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
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
    // Clear token and user from localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    // Redirect to login page if in browser context
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
  
  return response;
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
      body: JSON.stringify({ username, password }),
    });
    
    return await response.json();
  },
  
  register: async (username: string, password: string, email?: string) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, email }),
    });
    
    return await response.json();
  },
  
  getUserProfile: async () => {
    const response = await fetchWithAuth(`${API_URL}/auth/me`);
    return await response.json();
  },
  
  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }
};

export default authService;