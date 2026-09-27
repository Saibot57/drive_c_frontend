'use client';

import { useCallback, useEffect, useState } from 'react';

const NO_PALETTE: readonly string[] = [];

/**
 * De senast valda egna färgerna, sparade i localStorage under `storageKey`.
 * Färger som redan finns i paletten sparas inte – de syns ju ändå.
 */
export function useRecentColors(storageKey: string, max: number, palette: readonly string[] = NO_PALETTE) {
  const [recentColors, setRecentColors] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setRecentColors(
        Array.isArray(parsed)
          ? parsed.filter((color): color is string => typeof color === 'string').slice(0, max)
          : []
      );
    } catch {
      // Ingen lagring tillgänglig – färgerna fungerar ändå, de minns bara inte.
    }
  }, [storageKey, max]);

  const rememberColor = useCallback((color: string) => {
    if (palette.includes(color)) return;
    setRecentColors(prev => {
      const updated = [color, ...prev.filter(c => c !== color)].slice(0, max);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // Privat läge eller full kvot – färgen fungerar ändå, den minns bara inte.
      }
      return updated;
    });
  }, [storageKey, max, palette]);

  return { recentColors, rememberColor };
}
