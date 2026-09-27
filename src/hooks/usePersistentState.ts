'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Ett värde som sparas i localStorage under `key`.
 *
 * `sanitize` körs både på det som läses och på det som sparas, så att ett
 * gammalt eller trasigt värde aldrig når komponenten. Går nyckeln inte att
 * läsa gäller `fallback` för just den – andra inställningar påverkas inte.
 * Värdet läses efter montering; dessförinnan gäller `fallback`.
 *
 * `sanitize` ska vara stabil (en funktion på modulnivå), annars byts
 * sparfunktionen ut vid varje rendering.
 */
export function usePersistentState<T>(
  key: string,
  sanitize: (raw: unknown) => T,
  fallback: T,
): [T, (next: unknown) => void] {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(sanitize(JSON.parse(raw)));
    } catch (error) {
      console.warn(`Kunde inte läsa ${key}.`, error);
    }
  }, [key, sanitize]);

  const persist = useCallback((next: unknown) => {
    const clean = sanitize(next);
    setValue(clean);
    try {
      window.localStorage.setItem(key, JSON.stringify(clean));
    } catch (error) {
      console.warn(`Kunde inte spara ${key}.`, error);
    }
  }, [key, sanitize]);

  return [value, persist];
}
