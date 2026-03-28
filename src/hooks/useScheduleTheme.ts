'use client';

import { useState, useCallback, useEffect } from 'react';

export type ScheduleTheme = 'neo' | 'clean';

const STORAGE_KEY = 'sp-theme';

export function useScheduleTheme() {
  const [theme, setThemeState] = useState<ScheduleTheme>('neo');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'neo' || stored === 'clean') {
      setThemeState(stored);
    }
  }, []);

  const setTheme = useCallback((next: ScheduleTheme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'neo' ? 'clean' : 'neo');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
