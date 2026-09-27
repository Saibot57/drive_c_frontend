'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as authService from '@/services/authService';
import type { AuthSession, User } from '@/services/authService';

// Define the auth context type
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, inviteCode: string, email?: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}

// Create the auth context
const AuthContext = createContext<AuthContextType | null>(null);

// Props for AuthProvider
interface AuthProviderProps {
  children: ReactNode;
}

// Auth Provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing auth on component mount
  useEffect(() => {
    const stored = authService.readStoredAuth();
    if (stored) {
      setToken(stored.token);
      setUser(stored.user);
    }
    
    setIsLoading(false);
  }, []);

  // Sparar inloggningen både i state och i localStorage.
  const startSession = (session: AuthSession) => {
    setToken(session.token);
    setUser(session.user);
    authService.storeAuth(session);
  };

  // Login function
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      startSession(await authService.login(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during login');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (username: string, password: string, inviteCode: string, email?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      startSession(await authService.register(username, password, inviteCode, email));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during registration');
      console.error('Register error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    setToken(null);
    setUser(null);
    authService.clearStoredAuth();
  };

  // Value object to provide in context
  const value = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    register,
    logout,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};