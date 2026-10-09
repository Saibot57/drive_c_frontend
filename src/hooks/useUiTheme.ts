'use client';

import { useCallback, useEffect, useState } from 'react';
import { isUiTheme, UI_THEME_EVENT, UI_THEME_KEY, UiTheme } from '@/config/uiTheme';

const readTheme = (): UiTheme => {
  if (typeof document === 'undefined') return 'neo';
  return document.documentElement.getAttribute('data-theme') === 'kronberg' ? 'kronberg' : 'neo';
};

/** Läser och byter utseende. Attributet på <html> är sanningen. */
export const useUiTheme = () => {
  // Neo tills komponenten monterats: servern vet inte vad webbläsaren valt.
  const [theme, setThemeState] = useState<UiTheme>('neo');

  useEffect(() => {
    setThemeState(readTheme());
    const sync = () => setThemeState(readTheme());
    window.addEventListener(UI_THEME_EVENT, sync);
    return () => window.removeEventListener(UI_THEME_EVENT, sync);
  }, []);

  const setTheme = useCallback((next: UiTheme) => {
    if (!isUiTheme(next)) return;
    if (next === 'kronberg') {
      document.documentElement.setAttribute('data-theme', 'kronberg');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try {
      window.localStorage.setItem(UI_THEME_KEY, next);
    } catch {
      // Utan lagring gäller valet tills sidan laddas om.
    }
    window.dispatchEvent(new Event(UI_THEME_EVENT));
  }, []);

  return { theme, setTheme };
};
