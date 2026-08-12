'use client';

import { useCallback, useRef, useState } from 'react';
import { ScheduledEntry } from '@/types/schedule';
import { useHotkeys } from '@/hooks/useHotkeys';

type CommitOptions = {
  clearHistory?: boolean;
};

type UseScheduleHistoryOptions = {
  /**
   * Frågas innan en ångring körs. Skickas som funktion och inte som värde:
   * läsläget avgörs längre ned i planeraren än där historiken skapas, så svaret
   * finns inte än när hooken anropas — det läses först när tangenten trycks.
   */
  canEdit?: () => boolean;
};

export const useScheduleHistory = ({ canEdit }: UseScheduleHistoryOptions = {}) => {
  const [schedule, setSchedule] = useState<ScheduledEntry[]>([]);
  const scheduleHistoryRef = useRef<ScheduledEntry[][]>([]);
  const scheduleFutureRef = useRef<ScheduledEntry[][]>([]);
  // Via en ref, så att en ny funktionsidentitet per rendering inte tvingar
  // fram en omregistrering av tangentgenvägen.
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;

  const commitSchedule = useCallback((
    updater: (prev: ScheduledEntry[]) => ScheduledEntry[],
    options?: CommitOptions
  ) => {
    setSchedule(prev => {
      const next = updater(prev);
      if (next === prev) {
        return next;
      }

      if (options?.clearHistory) {
        scheduleHistoryRef.current = [];
        scheduleFutureRef.current = [];
        return next;
      }

      scheduleHistoryRef.current = [...scheduleHistoryRef.current, prev];
      scheduleFutureRef.current = [];
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    // Ctrl+Z går inte genom commitSchedule och skulle annars vara den enda
    // vägen som ändrade ett schema man bara har läsrätt till.
    if (canEditRef.current && !canEditRef.current()) return;

    const history = scheduleHistoryRef.current;
    if (history.length === 0) return;

    setSchedule(prev => {
      const previous = history[history.length - 1];
      scheduleHistoryRef.current = history.slice(0, -1);
      scheduleFutureRef.current = [...scheduleFutureRef.current, prev];
      return previous;
    });
  }, []);

  useHotkeys(
    [{ key: 'z', ctrl: true, handler: handleUndo }],
    [handleUndo],
  );

  return {
    schedule,
    commitSchedule,
    handleUndo
  };
};
