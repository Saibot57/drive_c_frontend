'use client';

import { useCallback, useState } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { v4 as uuidv4 } from 'uuid';
import { GhostPlacement } from '@/types/plannerUI';
import { PlannerCourse, ScheduledEntry } from '@/types/schedule';
import { PlacementCandidate, PlacementVerdict } from '@/utils/scheduleRules';
import { END_HOUR, minutesToTime, PIXELS_PER_MINUTE, snapTime, START_HOUR, timeToMinutes } from '@/utils/scheduleTime';

type UseDragHandlersParams = {
  commitSchedule: (
    updater: (prev: ScheduledEntry[]) => ScheduledEntry[],
    options?: { clearHistory?: boolean }
  ) => void;
  validatePlacement: (candidate: PlacementCandidate) => PlacementVerdict;
  /** Ger förhandsvisningen samma färg som den placerade posten kommer att få. */
  resolveColor: (title: string, fallbackColor: string) => string;
  isMobileDragDisabled: boolean;
  showNotice: (message: string, tone: 'success' | 'error' | 'warning') => void;
  /** I planeringsvyn ritas inga poster, så en ny post skulle annars försvinna tyst. */
  isPlanningMode?: boolean;
  /** Någon annan har det delade schemat öppet. Då går inget att flytta. */
  isReadOnly?: boolean;
};

type DropTimeResult = {
  targetDay: string;
  newStartTime: string;
  newEndTime: string;
  itemDuration: number;
};

export const useDragHandlers = ({
  commitSchedule,
  validatePlacement,
  resolveColor,
  isMobileDragDisabled,
  showNotice,
  isPlanningMode = false,
  isReadOnly = false
}: UseDragHandlersParams) => {
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const [ghostPlacement, setGhostPlacement] = useState<GhostPlacement | null>(null);

  const desktopSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );
  const mobileSensors = useSensors(useSensor(KeyboardSensor));
  // Läsläget stänger av dragandet via kortens `dragDisabled`, inte genom att
  // byta sensoruppsättning: dnd-kit använder sensorlistan som beroendelista
  // internt, och en lista som ändrar längd ger varningar och tappade lyssnare.
  const sensors = isMobileDragDisabled ? mobileSensors : desktopSensors;

  const computeDropTime = useCallback((event: any): DropTimeResult | null => {
    const { active, over } = event;
    if (!over) return null;

    const targetDay = over.id as string;
    const type = active.data.current?.type;

    const itemDuration = type === 'course'
      ? (active.data.current?.course.duration || 60)
      : active.data.current?.entry.duration;

    let totalMinutes: number;

    if (type === 'scheduled') {
      const entry = active.data.current?.entry as ScheduledEntry | undefined;
      if (!entry) return null;
      const originalStartMinutes = timeToMinutes(entry.startTime);
      const deltaMinutes = event.delta.y / PIXELS_PER_MINUTE;
      totalMinutes = originalStartMinutes + deltaMinutes;
    } else {
      const overRect = over.rect;
      const activeRect = active.rect.current?.translated;
      if (!activeRect || !overRect) return null;
      const relativeY = activeRect.top - overRect.top;
      const minutesFromStart = relativeY / PIXELS_PER_MINUTE;
      totalMinutes = (START_HOUR * 60) + minutesFromStart;
    }

    totalMinutes = snapTime(totalMinutes);
    const minTime = START_HOUR * 60;
    const maxTime = (END_HOUR * 60) - itemDuration;
    totalMinutes = Math.max(minTime, Math.min(totalMinutes, maxTime));

    const newStartTime = minutesToTime(totalMinutes);
    const newEndTime = minutesToTime(totalMinutes + itemDuration);

    return { targetDay, newStartTime, newEndTime, itemDuration };
  }, []);

  const handleDragStart = useCallback((event: any) => {
    setActiveDragItem(event.active.data.current);
  }, []);

  const handleDragMove = useCallback((event: any) => {
    const computed = computeDropTime(event);
    if (!computed) {
      setGhostPlacement(null);
      return;
    }

    const { active } = event;
    const type = active.data.current?.type;

    if (type === 'course') {
      const course = active.data.current?.course as PlannerCourse;
      setGhostPlacement({
        day: computed.targetDay,
        startTime: computed.newStartTime,
        endTime: computed.newEndTime,
        duration: computed.itemDuration,
        color: resolveColor(course.title, course.color),
        title: course.title
      });
      return;
    }

    if (type === 'scheduled') {
      const entry = active.data.current?.entry as ScheduledEntry;
      setGhostPlacement({
        day: computed.targetDay,
        startTime: computed.newStartTime,
        endTime: computed.newEndTime,
        duration: computed.itemDuration,
        color: resolveColor(entry.title, entry.color),
        title: entry.title
      });
      return;
    }

    setGhostPlacement(null);
  }, [computeDropTime, resolveColor]);

  const handleDragEnd = useCallback((event: any) => {
    const { active } = event;
    setActiveDragItem(null);
    setGhostPlacement(null);

    if (isReadOnly) {
      showNotice('Någon annan har schemat öppet. Ta över det för att kunna ändra.', 'warning');
      return;
    }

    const computed = computeDropTime(event);
    if (!computed) return;

    const type = active.data.current?.type;

    if (type === 'course') {
      const course = active.data.current?.course as PlannerCourse;

      const { blocked, warning } = validatePlacement({
        title: course.title,
        teacher: course.teacher,
        day: computed.targetDay,
        startTime: computed.newStartTime,
        endTime: computed.newEndTime
      });
      if (blocked) {
        showNotice(blocked, 'error');
        return;
      }
      if (warning) {
        showNotice(warning, 'warning');
      }

      const newEntry: ScheduledEntry = {
        ...course,
        instanceId: uuidv4(),
        day: computed.targetDay,
        startTime: computed.newStartTime,
        endTime: computed.newEndTime,
        duration: computed.itemDuration
      };
      commitSchedule(prev => [...prev, newEntry]);
      if (isPlanningMode) {
        showNotice('Posten lades till – töm filtret för att se den.', 'warning');
      }
      return;
    }

    if (type === 'scheduled') {
      const entry = active.data.current?.entry as ScheduledEntry;

      const { blocked, warning } = validatePlacement({
        title: entry.title,
        teacher: entry.teacher,
        day: computed.targetDay,
        startTime: computed.newStartTime,
        endTime: computed.newEndTime,
        instanceId: entry.instanceId
      });
      if (blocked) {
        showNotice(blocked, 'error');
        return;
      }
      if (warning) {
        showNotice(warning, 'warning');
      }

      commitSchedule(prev => prev.map(existing =>
        existing.instanceId === entry.instanceId
          ? { ...existing, day: computed.targetDay, startTime: computed.newStartTime, endTime: computed.newEndTime }
          : existing
      ));
    }
  }, [commitSchedule, computeDropTime, isPlanningMode, isReadOnly, showNotice, validatePlacement]);

  const handleDragCancel = useCallback(() => {
    setActiveDragItem(null);
    setGhostPlacement(null);
  }, []);

  return {
    activeDragItem,
    ghostPlacement,
    sensors,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel
  };
};
