'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScheduledEntry } from '@/types/schedule';

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable;
      if (isEditable) return;

      const isUndoKey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z';
      if (!isUndoKey || event.shiftKey) return;

      event.preventDefault();
      handleUndo();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  return {
    schedule,
    commitSchedule,
    handleUndo
  };
};
