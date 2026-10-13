'use client';

import { useCallback, useState } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { v4 as uuidv4 } from 'uuid';
import { GhostPlacement } from '@/types/plannerUI';
import { PlannerCourse, ScheduledEntry } from '@/types/schedule';
import { moveInLane, resolveLaneDrop } from '@/utils/scheduleLayout';
import { PlacementCandidate, PlacementVerdict, reportPlacementVerdict } from '@/utils/scheduleRules';
import { END_HOUR, minutesToTime, PIXELS_PER_MINUTE, SNAP_MINUTES, snapTime, START_HOUR, timeToMinutes } from '@/utils/scheduleTime';

type UseDragHandlersParams = {
  /** Behövs för att förhandsvisa en platsbyte bland samtidiga poster. */
  schedule: ScheduledEntry[];
  commitSchedule: (
    updater: (prev: ScheduledEntry[]) => ScheduledEntry[],
    options?: { clearHistory?: boolean }
  ) => void;
  validatePlacement: (candidate: PlacementCandidate) => PlacementVerdict;
  /** Ger förhandsvisningen samma färg som den placerade posten kommer att få. */
  resolveColor: (title: string, fallbackColor: string) => string;
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

/**
 * Så långt i höjdled ett drag får gå och ändå räknas som ett platsbyte i sidled.
 * Halva magnetsteget, alltså precis så långt som tiden ändå skulle ha avrundats
 * tillbaka till samma kvart.
 */
const LANE_DRAG_MAX_DY = (SNAP_MINUTES * PIXELS_PER_MINUTE) / 2;

/** Var i sidled pekaren är, som andel av dagskolumnens bredd (0–1). */
const pointerFraction = (event: any): number | null => {
  const overRect = event.over?.rect;
  if (!overRect || overRect.width <= 0) return null;
  const start = event.activatorEvent;
  if (start && typeof start.clientX === 'number') {
    return (start.clientX + event.delta.x - overRect.left) / overRect.width;
  }
  // Tangentbordsdrag har ingen pekare; kortets mitt får stå för den.
  const rect = event.active.rect.current?.translated;
  if (!rect) return null;
  return (rect.left + rect.width / 2 - overRect.left) / overRect.width;
};

/**
 * Ett kort som dras i sidled inom sin dag, utan att tiden ändras, byter plats
 * bland posterna som börjar samtidigt i stället för att flyttas. Ger `null` när
 * dragningen är en vanlig flytt.
 */
const resolveLaneFraction = (event: any): { entry: ScheduledEntry; fraction: number } | null => {
  if (event.active.data.current?.type !== 'scheduled') return null;
  const entry = event.active.data.current?.entry as ScheduledEntry | undefined;
  if (!entry || event.over?.id !== entry.day) return null;
  if (Math.abs(event.delta.y) >= LANE_DRAG_MAX_DY) return null;
  const fraction = pointerFraction(event);
  return fraction === null ? null : { entry, fraction };
};

export const useDragHandlers = ({
  schedule,
  commitSchedule,
  validatePlacement,
  resolveColor,
  showNotice,
  isPlanningMode = false,
  isReadOnly = false
}: UseDragHandlersParams) => {
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const [ghostPlacement, setGhostPlacement] = useState<GhostPlacement | null>(null);

  // Sensoruppsättningen är avsiktligt konstant. dnd-kit skickar listan vidare
  // som beroendelista till en useEffect, och en lista som byter längd mellan
  // renderingar ger både React-varning och lyssnare som aldrig kopplas om —
  // dragandet slutar helt enkelt fungera tills sidan laddas om.
  //
  // Både läsläget och mobilspärren stängs i stället av där de hör hemma: korten
  // får `dragDisabled`, som blir `disabled` på useDraggable. Ett avstängt kort
  // startar aldrig ett drag, oavsett vilka sensorer som lyssnar.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

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
    const laneMove = resolveLaneFraction(event);
    const lane = laneMove ? resolveLaneDrop(schedule, laneMove.entry.instanceId, laneMove.fraction) : null;
    if (laneMove && lane) {
      const { entry } = laneMove;
      setGhostPlacement({
        day: entry.day,
        startTime: entry.startTime,
        endTime: entry.endTime,
        duration: entry.duration,
        color: resolveColor(entry.title, entry.color),
        title: entry.title,
        lane: { column: lane.column, columns: lane.columns }
      });
      return;
    }

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
  }, [computeDropTime, resolveColor, schedule]);

  const handleDragEnd = useCallback((event: any) => {
    const { active } = event;
    setActiveDragItem(null);
    setGhostPlacement(null);

    if (isReadOnly) {
      showNotice('Någon annan har schemat öppet. Ta över det för att kunna ändra.', 'warning');
      return;
    }

    const laneMove = resolveLaneFraction(event);
    if (laneMove && resolveLaneDrop(schedule, laneMove.entry.instanceId, laneMove.fraction)) {
      const { entry, fraction } = laneMove;
      commitSchedule(prev => {
        const lane = resolveLaneDrop(prev, entry.instanceId, fraction);
        return lane ? moveInLane(prev, entry.instanceId, lane.index) : prev;
      });
      return;
    }

    const computed = computeDropTime(event);
    if (!computed) return;

    const type = active.data.current?.type;

    if (type === 'course') {
      const course = active.data.current?.course as PlannerCourse;

      const verdict = validatePlacement({
        title: course.title,
        teacher: course.teacher,
        day: computed.targetDay,
        startTime: computed.newStartTime,
        endTime: computed.newEndTime
      });
      if (!reportPlacementVerdict(verdict, showNotice)) return;

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

      const verdict = validatePlacement({
        title: entry.title,
        teacher: entry.teacher,
        day: computed.targetDay,
        startTime: computed.newStartTime,
        endTime: computed.newEndTime,
        instanceId: entry.instanceId
      });
      if (!reportPlacementVerdict(verdict, showNotice)) return;

      const moved = computed.targetDay !== entry.day || computed.newStartTime !== entry.startTime;
      commitSchedule(prev => prev.map(existing =>
        existing.instanceId === entry.instanceId
          ? {
              ...existing,
              day: computed.targetDay,
              startTime: computed.newStartTime,
              endTime: computed.newEndTime,
              // Platsen gällde bland de gamla grannarna.
              laneOrder: moved ? undefined : existing.laneOrder
            }
          : existing
      ));
    }
  }, [commitSchedule, computeDropTime, isPlanningMode, isReadOnly, schedule, showNotice, validatePlacement]);

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
