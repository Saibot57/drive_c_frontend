'use client';

import { useCallback, useRef, useState } from 'react';
import { ThemeWheel } from '@/types/themeWheel';
import { useHotkeys } from '@/hooks/useHotkeys';

type CommitOptions = {
  /** Används vid inläsning: den nya datan ska inte gå att ångra tillbaka. */
  clearHistory?: boolean;
};

/**
 * Ångra/gör om för hela hjulet. Motsvarar useScheduleHistory i
 * schemaplaneraren, men håller hela ThemeWheel-objektet så att även namn,
 * antal veckor och lovmarkeringar omfattas av Ctrl+Z.
 */
export const useThemeWheelHistory = (initial: ThemeWheel) => {
  const [wheel, setWheel] = useState<ThemeWheel>(initial);
  const pastRef = useRef<ThemeWheel[]>([]);
  const futureRef = useRef<ThemeWheel[]>([]);

  const commit = useCallback((
    updater: (prev: ThemeWheel) => ThemeWheel,
    options?: CommitOptions
  ) => {
    setWheel(prev => {
      const next = updater(prev);
      if (next === prev) return prev;

      if (options?.clearHistory) {
        pastRef.current = [];
        futureRef.current = [];
        return next;
      }

      pastRef.current = [...pastRef.current, prev];
      futureRef.current = [];
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    setWheel(prev => {
      const previous = pastRef.current[pastRef.current.length - 1];
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [...futureRef.current, prev];
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    setWheel(prev => {
      const next = futureRef.current[futureRef.current.length - 1];
      futureRef.current = futureRef.current.slice(0, -1);
      pastRef.current = [...pastRef.current, prev];
      return next;
    });
  }, []);

  useHotkeys(
    [
      { key: 'z', ctrl: true, handler: undo },
      { key: 'z', ctrl: true, shift: true, handler: redo },
    ],
    [undo, redo],
  );

  return { wheel, commit, undo, redo };
};
