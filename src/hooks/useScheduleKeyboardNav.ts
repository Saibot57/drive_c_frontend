'use client';

import { useCallback, useState } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';
import { PlannerCourse, ScheduledEntry } from '@/types/schedule';
import { PLANNER_DAYS } from '@/components/schedule/constants';
import { timeToMinutes } from '@/utils/scheduleTime';
import { v4 as uuidv4 } from 'uuid';

export type ActiveZone = 'courses' | 'grid' | 'archive';

type UseScheduleKeyboardNavOptions = {
  courses: PlannerCourse[];
  schedule: ScheduledEntry[];
  sortedWeekNames: string[];
  filterQuery: string;
  isSidebarCollapsed: boolean;
  isRightSidebarCollapsed: boolean;
  // Actions
  onEditCourse: (course: PlannerCourse) => void;
  onDeleteCourse: (course: PlannerCourse, isDerived: boolean) => void;
  onNewCourse: () => void;
  onEditEntry: (entry: ScheduledEntry) => void;
  onRemoveEntry: (instanceId: string) => void;
  onDuplicateParallel: (entry: ScheduledEntry) => void;
  onDuplicateAndPlace: (entry: ScheduledEntry) => void;
  onCopyContent: (entry: ScheduledEntry) => void;
  onPasteContent: (entry: ScheduledEntry) => void;
  onOpenContextMenu: (entry: ScheduledEntry) => void;
  onLoadWeek: (name: string) => void;
  onDuplicateWeek: (name: string) => void;
  onDeleteWeek: (name: string) => void;
  // Placement
  onStartPlacement: (course: PlannerCourse) => void;
  hasCopiedContent: boolean;
  // Advanced filter
  advancedFilterMatch: (item: PlannerCourse | ScheduledEntry, query: string) => boolean;
};

function getEntriesForDay(schedule: ScheduledEntry[], day: string): ScheduledEntry[] {
  return schedule
    .filter(e => e.day === day)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export function useScheduleKeyboardNav(options: UseScheduleKeyboardNavOptions) {
  const {
    courses,
    schedule,
    sortedWeekNames,
    filterQuery,
    isSidebarCollapsed,
    isRightSidebarCollapsed,
    onEditCourse,
    onDeleteCourse,
    onNewCourse,
    onEditEntry,
    onRemoveEntry,
    onDuplicateParallel,
    onDuplicateAndPlace,
    onCopyContent,
    onPasteContent,
    onOpenContextMenu,
    onLoadWeek,
    onDuplicateWeek,
    onDeleteWeek,
    onStartPlacement,
    hasCopiedContent,
    advancedFilterMatch,
  } = options;

  const [activeZone, setActiveZone] = useState<ActiveZone | null>(null);
  const [selectedCourseIndex, setSelectedCourseIndex] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedArchiveIndex, setSelectedArchiveIndex] = useState<number | null>(null);
  // Track which day the grid cursor is on
  const [gridDayIndex, setGridDayIndex] = useState(0);

  const visibleCourses = courses.filter(c => advancedFilterMatch(c, filterQuery));

  const getSelectedEntry = useCallback((): ScheduledEntry | null => {
    if (!selectedEventId) return null;
    return schedule.find(e => e.instanceId === selectedEventId) ?? null;
  }, [selectedEventId, schedule]);

  const clearSelection = useCallback(() => {
    setSelectedCourseIndex(null);
    setSelectedEventId(null);
    setSelectedArchiveIndex(null);
  }, []);

  // Tab to switch zones
  useHotkeys(
    [
      {
        key: 'Tab',
        handler: (e) => {
          const zones: ActiveZone[] = [];
          if (!isSidebarCollapsed) zones.push('courses');
          zones.push('grid');
          if (!isRightSidebarCollapsed) zones.push('archive');

          if (zones.length === 0) return;

          const currentIdx = activeZone ? zones.indexOf(activeZone) : -1;
          const nextIdx = e.shiftKey
            ? (currentIdx <= 0 ? zones.length - 1 : currentIdx - 1)
            : (currentIdx + 1) % zones.length;

          const nextZone = zones[nextIdx];
          setActiveZone(nextZone);
          clearSelection();

          // Auto-select first item in new zone
          if (nextZone === 'courses' && visibleCourses.length > 0) {
            setSelectedCourseIndex(0);
          } else if (nextZone === 'grid') {
            const dayEntries = getEntriesForDay(schedule, PLANNER_DAYS[gridDayIndex]);
            if (dayEntries.length > 0) {
              setSelectedEventId(dayEntries[0].instanceId);
            }
          } else if (nextZone === 'archive' && sortedWeekNames.length > 0) {
            setSelectedArchiveIndex(0);
          }
        },
      },
    ],
    [activeZone, isSidebarCollapsed, isRightSidebarCollapsed, visibleCourses, schedule, sortedWeekNames, gridDayIndex],
  );

  // --- Course sidebar navigation ---
  useHotkeys(
    activeZone === 'courses'
      ? [
          {
            key: 'ArrowDown',
            handler: () => {
              setSelectedCourseIndex(prev => {
                if (prev === null) return 0;
                return Math.min(prev + 1, visibleCourses.length - 1);
              });
            },
          },
          {
            key: 'j',
            handler: () => {
              setSelectedCourseIndex(prev => {
                if (prev === null) return 0;
                return Math.min(prev + 1, visibleCourses.length - 1);
              });
            },
          },
          {
            key: 'ArrowUp',
            handler: () => {
              setSelectedCourseIndex(prev => {
                if (prev === null) return 0;
                return Math.max((prev ?? 0) - 1, 0);
              });
            },
          },
          {
            key: 'k',
            handler: () => {
              setSelectedCourseIndex(prev => {
                if (prev === null) return 0;
                return Math.max((prev ?? 0) - 1, 0);
              });
            },
          },
          {
            key: 'Enter',
            handler: () => {
              if (selectedCourseIndex !== null && visibleCourses[selectedCourseIndex]) {
                onStartPlacement(visibleCourses[selectedCourseIndex]);
              }
            },
          },
          {
            key: 'e',
            handler: () => {
              if (selectedCourseIndex !== null && visibleCourses[selectedCourseIndex]) {
                onEditCourse(visibleCourses[selectedCourseIndex]);
              }
            },
          },
          {
            key: 'Delete',
            handler: () => {
              if (selectedCourseIndex !== null && visibleCourses[selectedCourseIndex]) {
                onDeleteCourse(visibleCourses[selectedCourseIndex], false);
              }
            },
          },
          {
            key: 'Backspace',
            handler: () => {
              if (selectedCourseIndex !== null && visibleCourses[selectedCourseIndex]) {
                onDeleteCourse(visibleCourses[selectedCourseIndex], false);
              }
            },
          },
          {
            key: 'n',
            handler: () => onNewCourse(),
          },
          {
            key: 'Escape',
            handler: () => {
              clearSelection();
              setActiveZone(null);
            },
          },
        ]
      : [],
    [activeZone, selectedCourseIndex, visibleCourses, onEditCourse, onDeleteCourse, onNewCourse, onStartPlacement],
  );

  // --- Grid navigation ---
  useHotkeys(
    activeZone === 'grid'
      ? [
          // Down / j - next entry in current day
          {
            key: 'ArrowDown',
            handler: () => {
              const dayEntries = getEntriesForDay(schedule, PLANNER_DAYS[gridDayIndex]);
              if (dayEntries.length === 0) return;
              const curIdx = selectedEventId ? dayEntries.findIndex(e => e.instanceId === selectedEventId) : -1;
              const nextIdx = Math.min(curIdx + 1, dayEntries.length - 1);
              setSelectedEventId(dayEntries[nextIdx].instanceId);
            },
          },
          {
            key: 'j',
            handler: () => {
              const dayEntries = getEntriesForDay(schedule, PLANNER_DAYS[gridDayIndex]);
              if (dayEntries.length === 0) return;
              const curIdx = selectedEventId ? dayEntries.findIndex(e => e.instanceId === selectedEventId) : -1;
              const nextIdx = Math.min(curIdx + 1, dayEntries.length - 1);
              setSelectedEventId(dayEntries[nextIdx].instanceId);
            },
          },
          // Up / k - previous entry in current day
          {
            key: 'ArrowUp',
            handler: () => {
              const dayEntries = getEntriesForDay(schedule, PLANNER_DAYS[gridDayIndex]);
              if (dayEntries.length === 0) return;
              const curIdx = selectedEventId ? dayEntries.findIndex(e => e.instanceId === selectedEventId) : -1;
              const nextIdx = Math.max((curIdx === -1 ? 0 : curIdx) - 1, 0);
              setSelectedEventId(dayEntries[nextIdx].instanceId);
            },
          },
          {
            key: 'k',
            handler: () => {
              const dayEntries = getEntriesForDay(schedule, PLANNER_DAYS[gridDayIndex]);
              if (dayEntries.length === 0) return;
              const curIdx = selectedEventId ? dayEntries.findIndex(e => e.instanceId === selectedEventId) : -1;
              const nextIdx = Math.max((curIdx === -1 ? 0 : curIdx) - 1, 0);
              setSelectedEventId(dayEntries[nextIdx].instanceId);
            },
          },
          // Right / l - next day
          {
            key: 'ArrowRight',
            handler: () => {
              const nextDay = Math.min(gridDayIndex + 1, PLANNER_DAYS.length - 1);
              setGridDayIndex(nextDay);
              // Select closest entry by time in new day
              const currentEntry = getSelectedEntry();
              const newDayEntries = getEntriesForDay(schedule, PLANNER_DAYS[nextDay]);
              if (newDayEntries.length === 0) {
                setSelectedEventId(null);
                return;
              }
              if (currentEntry) {
                const curMin = timeToMinutes(currentEntry.startTime);
                let closest = newDayEntries[0];
                let closestDiff = Math.abs(timeToMinutes(closest.startTime) - curMin);
                for (const e of newDayEntries) {
                  const diff = Math.abs(timeToMinutes(e.startTime) - curMin);
                  if (diff < closestDiff) {
                    closest = e;
                    closestDiff = diff;
                  }
                }
                setSelectedEventId(closest.instanceId);
              } else {
                setSelectedEventId(newDayEntries[0].instanceId);
              }
            },
          },
          {
            key: 'l',
            handler: () => {
              const nextDay = Math.min(gridDayIndex + 1, PLANNER_DAYS.length - 1);
              setGridDayIndex(nextDay);
              const currentEntry = getSelectedEntry();
              const newDayEntries = getEntriesForDay(schedule, PLANNER_DAYS[nextDay]);
              if (newDayEntries.length === 0) { setSelectedEventId(null); return; }
              if (currentEntry) {
                const curMin = timeToMinutes(currentEntry.startTime);
                let closest = newDayEntries[0];
                let closestDiff = Math.abs(timeToMinutes(closest.startTime) - curMin);
                for (const e of newDayEntries) {
                  const diff = Math.abs(timeToMinutes(e.startTime) - curMin);
                  if (diff < closestDiff) { closest = e; closestDiff = diff; }
                }
                setSelectedEventId(closest.instanceId);
              } else {
                setSelectedEventId(newDayEntries[0].instanceId);
              }
            },
          },
          // Left / h - previous day
          {
            key: 'ArrowLeft',
            handler: () => {
              const prevDay = Math.max(gridDayIndex - 1, 0);
              setGridDayIndex(prevDay);
              const currentEntry = getSelectedEntry();
              const newDayEntries = getEntriesForDay(schedule, PLANNER_DAYS[prevDay]);
              if (newDayEntries.length === 0) { setSelectedEventId(null); return; }
              if (currentEntry) {
                const curMin = timeToMinutes(currentEntry.startTime);
                let closest = newDayEntries[0];
                let closestDiff = Math.abs(timeToMinutes(closest.startTime) - curMin);
                for (const e of newDayEntries) {
                  const diff = Math.abs(timeToMinutes(e.startTime) - curMin);
                  if (diff < closestDiff) { closest = e; closestDiff = diff; }
                }
                setSelectedEventId(closest.instanceId);
              } else {
                setSelectedEventId(newDayEntries[0].instanceId);
              }
            },
          },
          {
            key: 'h',
            handler: () => {
              const prevDay = Math.max(gridDayIndex - 1, 0);
              setGridDayIndex(prevDay);
              const currentEntry = getSelectedEntry();
              const newDayEntries = getEntriesForDay(schedule, PLANNER_DAYS[prevDay]);
              if (newDayEntries.length === 0) { setSelectedEventId(null); return; }
              if (currentEntry) {
                const curMin = timeToMinutes(currentEntry.startTime);
                let closest = newDayEntries[0];
                let closestDiff = Math.abs(timeToMinutes(closest.startTime) - curMin);
                for (const e of newDayEntries) {
                  const diff = Math.abs(timeToMinutes(e.startTime) - curMin);
                  if (diff < closestDiff) { closest = e; closestDiff = diff; }
                }
                setSelectedEventId(closest.instanceId);
              } else {
                setSelectedEventId(newDayEntries[0].instanceId);
              }
            },
          },
          // Enter / e - edit selected entry
          {
            key: 'Enter',
            handler: () => {
              const entry = getSelectedEntry();
              if (entry) onEditEntry(entry);
            },
          },
          {
            key: 'e',
            handler: () => {
              const entry = getSelectedEntry();
              if (entry) onEditEntry(entry);
            },
          },
          // Delete / Backspace - remove entry
          {
            key: 'Delete',
            handler: () => {
              if (selectedEventId) onRemoveEntry(selectedEventId);
            },
          },
          {
            key: 'Backspace',
            handler: () => {
              if (selectedEventId) onRemoveEntry(selectedEventId);
            },
          },
          // d - duplicate parallel
          {
            key: 'd',
            handler: () => {
              const entry = getSelectedEntry();
              if (entry) onDuplicateParallel(entry);
            },
          },
          // Shift+D - duplicate and place
          {
            key: 'D',
            shift: true,
            handler: () => {
              const entry = getSelectedEntry();
              if (entry) onDuplicateAndPlace(entry);
            },
          },
          // c - copy content
          {
            key: 'c',
            handler: () => {
              const entry = getSelectedEntry();
              if (entry) onCopyContent(entry);
            },
          },
          // v - paste content
          {
            key: 'v',
            handler: () => {
              const entry = getSelectedEntry();
              if (entry && hasCopiedContent) onPasteContent(entry);
            },
          },
          // m - open context menu
          {
            key: 'm',
            handler: () => {
              const entry = getSelectedEntry();
              if (entry) onOpenContextMenu(entry);
            },
          },
          {
            key: 'F10',
            shift: true,
            handler: () => {
              const entry = getSelectedEntry();
              if (entry) onOpenContextMenu(entry);
            },
          },
          // Escape - deselect
          {
            key: 'Escape',
            handler: () => {
              clearSelection();
              setActiveZone(null);
            },
          },
        ]
      : [],
    [activeZone, selectedEventId, gridDayIndex, schedule, getSelectedEntry, hasCopiedContent, onEditEntry, onRemoveEntry, onDuplicateParallel, onDuplicateAndPlace, onCopyContent, onPasteContent, onOpenContextMenu],
  );

  // --- Archive sidebar navigation ---
  useHotkeys(
    activeZone === 'archive'
      ? [
          {
            key: 'ArrowDown',
            handler: () => {
              setSelectedArchiveIndex(prev => {
                if (prev === null) return 0;
                return Math.min(prev + 1, sortedWeekNames.length - 1);
              });
            },
          },
          {
            key: 'j',
            handler: () => {
              setSelectedArchiveIndex(prev => {
                if (prev === null) return 0;
                return Math.min(prev + 1, sortedWeekNames.length - 1);
              });
            },
          },
          {
            key: 'ArrowUp',
            handler: () => {
              setSelectedArchiveIndex(prev => {
                if (prev === null) return 0;
                return Math.max((prev ?? 0) - 1, 0);
              });
            },
          },
          {
            key: 'k',
            handler: () => {
              setSelectedArchiveIndex(prev => {
                if (prev === null) return 0;
                return Math.max((prev ?? 0) - 1, 0);
              });
            },
          },
          {
            key: 'Enter',
            handler: () => {
              if (selectedArchiveIndex !== null && sortedWeekNames[selectedArchiveIndex]) {
                onLoadWeek(sortedWeekNames[selectedArchiveIndex]);
              }
            },
          },
          {
            key: 'd',
            handler: () => {
              if (selectedArchiveIndex !== null && sortedWeekNames[selectedArchiveIndex]) {
                onDuplicateWeek(sortedWeekNames[selectedArchiveIndex]);
              }
            },
          },
          {
            key: 'Delete',
            handler: () => {
              if (selectedArchiveIndex !== null && sortedWeekNames[selectedArchiveIndex]) {
                onDeleteWeek(sortedWeekNames[selectedArchiveIndex]);
              }
            },
          },
          {
            key: 'Escape',
            handler: () => {
              clearSelection();
              setActiveZone(null);
            },
          },
        ]
      : [],
    [activeZone, selectedArchiveIndex, sortedWeekNames, onLoadWeek, onDuplicateWeek, onDeleteWeek],
  );

  return {
    activeZone,
    selectedCourseIndex,
    selectedEventId,
    selectedArchiveIndex,
    gridDayIndex,
    clearSelection,
    setActiveZone,
  };
}
