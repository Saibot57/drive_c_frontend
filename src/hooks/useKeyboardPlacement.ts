'use client';

import { useCallback, useState } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';
import { PlannerCourse, ScheduledEntry } from '@/types/schedule';
import { PLANNER_DAYS } from '@/components/schedule/constants';
import {
  START_HOUR,
  END_HOUR,
  minutesToTime,
  snapTime,
  SNAP_MINUTES,
} from '@/utils/scheduleTime';
import { v4 as uuidv4 } from 'uuid';
import { GhostPlacement } from '@/types/plannerUI';
import { PlacementCandidate, PlacementVerdict } from '@/utils/scheduleRules';

type UseKeyboardPlacementOptions = {
  commitSchedule: (updater: (prev: ScheduledEntry[]) => ScheduledEntry[]) => void;
  validatePlacement: (candidate: PlacementCandidate) => PlacementVerdict;
  showNotice: (msg: string, tone: 'success' | 'warning' | 'error') => void;
  /** I planeringsvyn ritas inga poster, så en ny post skulle annars försvinna tyst. */
  isPlanningMode?: boolean;
};

export function useKeyboardPlacement({
  commitSchedule,
  validatePlacement,
  showNotice,
  isPlanningMode = false,
}: UseKeyboardPlacementOptions) {
  const [kbPlacement, setKbPlacement] = useState<{
    course: PlannerCourse;
    dayIndex: number;
    timeMinutes: number;
  } | null>(null);

  const startPlacement = useCallback((course: PlannerCourse, initialDayIndex?: number, initialTimeMinutes?: number) => {
    setKbPlacement({
      course,
      dayIndex: initialDayIndex ?? 0,
      timeMinutes: initialTimeMinutes ?? START_HOUR * 60,
    });
  }, []);

  const cancelPlacement = useCallback(() => {
    setKbPlacement(null);
  }, []);

  // Derive ghost from keyboard placement state
  const placementGhost: GhostPlacement | null = kbPlacement
    ? {
        day: PLANNER_DAYS[kbPlacement.dayIndex],
        startTime: minutesToTime(kbPlacement.timeMinutes),
        endTime: minutesToTime(kbPlacement.timeMinutes + kbPlacement.course.duration),
        duration: kbPlacement.course.duration,
        color: kbPlacement.course.color,
        title: kbPlacement.course.title,
      }
    : null;

  useHotkeys(
    kbPlacement
      ? [
          // Left/Right change day
          {
            key: 'ArrowLeft',
            handler: () =>
              setKbPlacement(prev =>
                prev ? { ...prev, dayIndex: Math.max(prev.dayIndex - 1, 0) } : null,
              ),
          },
          {
            key: 'ArrowRight',
            handler: () =>
              setKbPlacement(prev =>
                prev
                  ? { ...prev, dayIndex: Math.min(prev.dayIndex + 1, PLANNER_DAYS.length - 1) }
                  : null,
              ),
          },
          {
            key: 'h',
            handler: () =>
              setKbPlacement(prev =>
                prev ? { ...prev, dayIndex: Math.max(prev.dayIndex - 1, 0) } : null,
              ),
          },
          {
            key: 'l',
            handler: () =>
              setKbPlacement(prev =>
                prev
                  ? { ...prev, dayIndex: Math.min(prev.dayIndex + 1, PLANNER_DAYS.length - 1) }
                  : null,
              ),
          },
          // Up/Down change time
          {
            key: 'ArrowUp',
            handler: () =>
              setKbPlacement(prev => {
                if (!prev) return null;
                const newTime = Math.max(prev.timeMinutes - SNAP_MINUTES, START_HOUR * 60);
                return { ...prev, timeMinutes: snapTime(newTime) };
              }),
          },
          {
            key: 'ArrowDown',
            handler: () =>
              setKbPlacement(prev => {
                if (!prev) return null;
                const maxTime = END_HOUR * 60 - prev.course.duration;
                const newTime = Math.min(prev.timeMinutes + SNAP_MINUTES, maxTime);
                return { ...prev, timeMinutes: snapTime(newTime) };
              }),
          },
          {
            key: 'k',
            handler: () =>
              setKbPlacement(prev => {
                if (!prev) return null;
                const newTime = Math.max(prev.timeMinutes - SNAP_MINUTES, START_HOUR * 60);
                return { ...prev, timeMinutes: snapTime(newTime) };
              }),
          },
          {
            key: 'j',
            handler: () =>
              setKbPlacement(prev => {
                if (!prev) return null;
                const maxTime = END_HOUR * 60 - prev.course.duration;
                const newTime = Math.min(prev.timeMinutes + SNAP_MINUTES, maxTime);
                return { ...prev, timeMinutes: snapTime(newTime) };
              }),
          },
          // Enter commits
          {
            key: 'Enter',
            handler: () => {
              if (!kbPlacement) return;
              const day = PLANNER_DAYS[kbPlacement.dayIndex];
              const startTime = minutesToTime(kbPlacement.timeMinutes);
              const endTime = minutesToTime(kbPlacement.timeMinutes + kbPlacement.course.duration);

              const { blocked, warning } = validatePlacement({
                title: kbPlacement.course.title,
                teacher: kbPlacement.course.teacher,
                day,
                startTime,
                endTime,
              });
              if (blocked) {
                showNotice(blocked, 'error');
                return;
              }

              const newEntry: ScheduledEntry = {
                ...kbPlacement.course,
                instanceId: uuidv4(),
                day,
                startTime,
                endTime,
              };
              commitSchedule(prev => [...prev, newEntry]);
              setKbPlacement(null);
              if (isPlanningMode) {
                showNotice('Posten lades till – töm filtret för att se den.', 'warning');
                return;
              }
              showNotice(warning ?? 'Post placerad', warning ? 'warning' : 'success');
            },
          },
          // Escape cancels
          {
            key: 'Escape',
            handler: () => setKbPlacement(null),
          },
        ]
      : [],
    [kbPlacement, commitSchedule, isPlanningMode, showNotice, validatePlacement],
  );

  return {
    kbPlacement,
    kbPlacementGhost: placementGhost,
    startPlacement,
    cancelPlacement,
    isKbPlacementActive: kbPlacement !== null,
  };
}
