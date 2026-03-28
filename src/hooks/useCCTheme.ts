'use client';

import { useState, useCallback, useEffect } from 'react';

export type CCTheme = 'neo' | 'clean';

const STORAGE_KEY = 'cc-theme';

export function useCCTheme() {
  const [theme, setThemeState] = useState<CCTheme>('neo');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'neo' || stored === 'clean') {
      setThemeState(stored);
    }
  }, []);

  const setTheme = useCallback((next: CCTheme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'neo' ? 'clean' : 'neo');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
