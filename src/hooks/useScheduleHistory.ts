'use client';

import { useCallback, useRef, useState } from 'react';
import { ScheduledEntry } from '@/types/schedule';
import { useHotkeys } from '@/hooks/useHotkeys';

type CommitOptions = {
  clearHistory?: boolean;
};

export const useScheduleHistory = () => {
  const [schedule, setSchedule] = useState<ScheduledEntry[]>([]);
  const scheduleHistoryRef = useRef<ScheduledEntry[][]>([]);
  const scheduleFutureRef = useRef<ScheduledEntry[][]>([]);

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
