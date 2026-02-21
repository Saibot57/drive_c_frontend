'use client';

import { useCallback, useState } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { v4 as uuidv4 } from 'uuid';
import { GhostPlacement } from '@/types/plannerUI';
import { PlannerCourse, RestrictionRule, ScheduledEntry } from '@/types/schedule';
import { checkOverlap, END_HOUR, minutesToTime, PIXELS_PER_MINUTE, snapTime, START_HOUR } from '@/utils/scheduleTime';

type UseDragHandlersParams = {
  schedule: ScheduledEntry[];
  commitSchedule: (
    updater: (prev: ScheduledEntry[]) => ScheduledEntry[],
    options?: { clearHistory?: boolean }
  ) => void;
  restrictions: RestrictionRule[];
  isMobileDragDisabled: boolean;
  showNotice: (message: string, tone: 'success' | 'error' | 'warning') => void;
};

const wildcardMatch = (pattern: string, text: string): boolean => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$', 'i');
  return regex.test(text);
};

const validateRestrictions = (
  nextEntry: { title: string; day: string; startTime: string; endTime: string; instanceId?: string },
  currentSchedule: ScheduledEntry[],
  rules: RestrictionRule[]
): string | null => {
  const conflicts = currentSchedule.filter(entry =>
    entry.day === nextEntry.day
    && entry.instanceId !== nextEntry.instanceId
    && checkOverlap(nextEntry.startTime, nextEntry.endTime, entry.startTime, entry.endTime)
  );

  if (conflicts.length === 0) return null;

  for (const existing of conflicts) {
    for (const rule of rules) {
      const matchA_New = wildcardMatch(rule.subjectA, nextEntry.title);
      const matchB_Exist = wildcardMatch(rule.subjectB, existing.title);
      const matchB_New = wildcardMatch(rule.subjectB, nextEntry.title);
      const matchA_Exist = wildcardMatch(rule.subjectA, existing.title);

      if ((matchA_New && matchB_Exist) || (matchB_New && matchA_Exist)) {
        return `Krock! "${nextEntry.title}" krockar med "${existing.title}" (${existing.startTime}-${existing.endTime}).`;
      }
    }
  }

  return null;
};

type DropTimeResult = {
  targetDay: string;
  newStartTime: string;
  newEndTime: string;
  itemDuration: number;
};

export const useDragHandlers = ({
  schedule,
  commitSchedule,
  restrictions,
  isMobileDragDisabled,
  showNotice
}: UseDragHandlersParams) => {
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const [ghostPlacement, setGhostPlacement] = useState<GhostPlacement | null>(null);

  const desktopSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );
  const mobileSensors = useSensors(useSensor(KeyboardSensor));
  const sensors = isMobileDragDisabled ? mobileSensors : desktopSensors;

  const computeDropTime = useCallback((event: any): DropTimeResult | null => {
    const { active, over } = event;
    if (!over) return null;

    const targetDay = over.id as string;
    const type = active.data.current?.type;
    const overRect = over.rect;
    const activeRect = active.rect.current?.translated;

    if (!activeRect || !overRect) return null;

    const itemDuration = type === 'course'
      ? (active.data.current?.course.duration || 60)
      : active.data.current?.entry.duration;

    const relativeY = activeRect.top - overRect.top;
    let minutesFromStart = relativeY / PIXELS_PER_MINUTE;
    let totalMinutes = (START_HOUR * 60) + minutesFromStart;

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
        color: course.color,
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
        color: entry.color,
        title: entry.title
      });
      return;
    }

    setGhostPlacement(null);
  }, [computeDropTime]);

  const handleDragEnd = useCallback((event: any) => {
    const { active } = event;
    setActiveDragItem(null);
    setGhostPlacement(null);

    const computed = computeDropTime(event);
    if (!computed) return;

    const type = active.data.current?.type;

    if (type === 'course') {
      const course = active.data.current?.course as PlannerCourse;

      const conflict = validateRestrictions(
        {
          title: course.title,
          day: computed.targetDay,
          startTime: computed.newStartTime,
          endTime: computed.newEndTime
        },
        schedule,
        restrictions
      );
      if (conflict) {
        showNotice(conflict, 'error');
        return;
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
      return;
    }

    if (type === 'scheduled') {
      const entry = active.data.current?.entry as ScheduledEntry;

      const conflict = validateRestrictions(
        {
          title: entry.title,
          day: computed.targetDay,
          startTime: computed.newStartTime,
          endTime: computed.newEndTime,
          instanceId: entry.instanceId
        },
        schedule,
        restrictions
      );
      if (conflict) {
        showNotice(conflict, 'error');
        return;
      }

      commitSchedule(prev => prev.map(existing =>
        existing.instanceId === entry.instanceId
          ? { ...existing, day: computed.targetDay, startTime: computed.newStartTime, endTime: computed.newEndTime }
          : existing
      ));
    }
  }, [commitSchedule, computeDropTime, restrictions, schedule, showNotice]);

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
