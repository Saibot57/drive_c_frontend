'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  Archive,
  Copy,
  Download,
  RefreshCcw,
  Trash2,
  Plus,
  ShieldAlert,
  Upload,
  BarChart3,
  Hammer,
  Save,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_COURSE_COLOR,
  PLANNER_DAYS,
  TITLE_HOLD_OPEN_MS
} from '@/components/schedule/constants';
import { PlannerCourse, ScheduledEntry, RestrictionRule, PersistedPlannerState } from '@/types/schedule';
import { ContextMenuState, GhostPlacement } from '@/types/plannerUI';
import { 
  START_HOUR, END_HOUR, PIXELS_PER_MINUTE,
  timeToMinutes, minutesToTime, snapTime,
  checkOverlap, EVENT_GAP_PX, MIN_HEIGHT_PX
} from '@/utils/scheduleTime';
import { buildDayLayout, DayLayoutEntry } from '@/utils/scheduleLayout';
import { runLayoutFixtureValidation } from '@/components/schedule/layoutValidation';
import { DraggableSourceCard } from '@/components/schedule/DraggableSourceCard';
import { ScheduledEventCard } from '@/components/schedule/ScheduledEventCard';
import { DayColumn } from '@/components/schedule/DayColumn';
import { CategoryDebugPanel, HiddenSettingsPanel } from '@/components/schedule/DebugPanels';
import { ScheduleModals } from '@/components/schedule/ScheduleModals';
import { usePlannerNotice } from '@/hooks/usePlannerNotice';
import { useScheduleHistory } from '@/hooks/useScheduleHistory';
import { useHiddenSettings } from '@/hooks/useHiddenSettings';
import { useCourseManager } from '@/hooks/useCourseManager';
import { useArchiveManager } from '@/hooks/useArchiveManager';
import { buildCourseDedupeKey, deriveCoursesFromSchedule, sanitizeManualCourses } from '@/components/schedule/courseUtils';
import { mapPlannerActivitiesToSchedule, mapScheduleToPlannerActivities, usePlannerSync } from '@/hooks/usePlannerSync';
import { useDragHandlers } from '@/hooks/useDragHandlers';
import { useScheduleExport } from '@/hooks/useScheduleExport';
import { useMobileNavigation } from '@/hooks/useMobileNavigation';
import { FeatureNavigation } from '@/components/FeatureNavigation';

// --- Helper: Conflict Check & Filtering ---

const wildcardMatch = (pattern: string, text: string): boolean => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$', 'i');
  return regex.test(text);
};

const advancedFilterMatch = (item: PlannerCourse | ScheduledEntry, filterQuery: string): boolean => {
  if (!filterQuery.trim()) return true;
  const searchString = `${item.title} ${item.teacher} ${item.room} ${item.category || ''}`.toLowerCase();
  const blocks = filterQuery.toLowerCase().split(';');
  return blocks.some(block => {
    const parts = block.trim().split('+'); 
    return parts.every(part => {
      const p = part.trim();
      if (!p) return true;
      if (p.startsWith('-')) {
        const term = p.substring(1);
        return !searchString.includes(term);
      } else {
        return searchString.includes(p);
      }
    });
  });
};

const validateRestrictions = (
  newEntry: { title: string, day: string, startTime: string, endTime: string, instanceId?: string },
  currentSchedule: ScheduledEntry[],
  rules: RestrictionRule[]
): string | null => {
  const potentialConflicts = currentSchedule.filter(e => 
    e.day === newEntry.day && 
    e.instanceId !== newEntry.instanceId &&
    checkOverlap(newEntry.startTime, newEntry.endTime, e.startTime, e.endTime)
  );

  if (potentialConflicts.length === 0) return null;

  for (const existing of potentialConflicts) {
    for (const rule of rules) {
      const matchA_New = wildcardMatch(rule.subjectA, newEntry.title);
      const matchB_Exist = wildcardMatch(rule.subjectB, existing.title);
      const matchB_New = wildcardMatch(rule.subjectB, newEntry.title);
      const matchA_Exist = wildcardMatch(rule.subjectA, existing.title);

      if ((matchA_New && matchB_Exist) || (matchB_New && matchA_Exist)) {
        return `Krock! "${newEntry.title}" krockar med "${existing.title}" (${existing.startTime}-${existing.endTime}).`;
      }
    }
  }
  return null;
};

// --- Helper: Data Sanitization ---
const sanitizeScheduleImport = (importedSchedule: any[]): ScheduledEntry[] => {
  if (!Array.isArray(importedSchedule)) return [];
  
  return importedSchedule.map(entry => {
    const start = entry.startTime || "08:00";
    const end = entry.endTime || minutesToTime(timeToMinutes(start) + 60);
    
    let duration = entry.duration;
    if (!duration || isNaN(duration)) {
      duration = timeToMinutes(end) - timeToMinutes(start);
    }

    return {
      ...entry,
      instanceId: entry.instanceId || uuidv4(),
      startTime: start,
      endTime: end,
      duration: duration > 0 ? duration : 60, 
      day: PLANNER_DAYS.includes(entry.day as typeof PLANNER_DAYS[number]) ? entry.day : PLANNER_DAYS[0]
    };
  });
};

// --- Main Component ---

export default function NewSchedulePlanner() {
  const { plannerNotice, showNotice } = usePlannerNotice();
  const { schedule, commitSchedule } = useScheduleHistory();
  const {
    manualCourses,
    setManualCourses,
    courses,
    recomputeCourses,
    manualCourseKeys,
    derivedCourseKeys,
    deleteCourseName,
    setDeleteCourseId,
    handleDeleteCourse,
    handleConfirmDeleteCourse,
    handleSaveCourse
  } = useCourseManager({ schedule, showNotice });
  const [restrictions, setRestrictions] = useState<RestrictionRule[]>([]);
  
  // UI State
  const [filterQuery, setFilterQuery] = useState("");
  const [manualColor, setManualColor] = useState(false);
  
  // Modals
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<PlannerCourse | null>(null);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduledEntry | null>(null);
  const [isRestrictionsModalOpen, setIsRestrictionsModalOpen] = useState(false);
  const [newRule, setNewRule] = useState<RestrictionRule>({ id: '', subjectA: '', subjectB: '' });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<ScheduledEntry | null>(null);
  const [placementGhost, setPlacementGhost] = useState<GhostPlacement | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showLayoutDebug, setShowLayoutDebug] = useState(false);
  const { teachers, rooms, isHiddenSettingsOpen, setIsHiddenSettingsOpen, handleHiddenSettingsSave } = useHiddenSettings();
  const [isCategoryDebugOpen, setIsCategoryDebugOpen] = useState(false);
  const [isMobileDragDisabled, setIsMobileDragDisabled] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<{
    courses: PlannerCourse[];
    schedule: ScheduledEntry[];
    restrictions?: RestrictionRule[];
  } | null>(null);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [isClearScheduleConfirmOpen, setIsClearScheduleConfirmOpen] = useState(false);
  const [isImageExportMenuOpen, setIsImageExportMenuOpen] = useState(false);
  const [isJsonMenuOpen, setIsJsonMenuOpen] = useState(false);
  const titleHoldTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageExportMenuRef = useRef<HTMLDivElement>(null);
  const jsonMenuRef = useRef<HTMLDivElement>(null);

  const {
    sortedWeekNames,
    weekName,
    setWeekName,
    activeArchiveName,
    setActiveArchiveName,
    overwriteWeekName,
    setOverwriteWeekName,
    deleteWeekName,
    setDeleteWeekName,
    handleSaveWeek,
    handleLoadWeek,
    handleDeleteWeek,
    handleConfirmDeleteWeek,
    handleDuplicateWeek,
    handleConfirmOverwriteWeek
  } = useArchiveManager({
    schedule,
    commitSchedule,
    mapPlannerActivitiesToSchedule,
    mapScheduleToPlannerActivities,
    showNotice
  });

  const { loadedArchiveName } = usePlannerSync({
    schedule,
    commitSchedule,
    activeArchiveName,
    showNotice
  });

  const {
    setMobileActiveDayIndex,
    mobileSelectedDay,
    mobileSelectedArchiveName,
    isAtFirstMobileArchive,
    isAtLastMobileArchive,
    isAtFirstMobileDay,
    isAtLastMobileDay,
    handleMobileArchiveStep
  } = useMobileNavigation({
    activeArchiveName,
    sortedWeekNames,
    handleLoadWeek
  });

  const {
    activeDragItem,
    ghostPlacement,
    sensors,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel
  } = useDragHandlers({
    schedule,
    commitSchedule,
    restrictions,
    isMobileDragDisabled,
    showNotice
  });

  const { handleExportPDF, handleExportImage } = useScheduleExport({ schedule });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(pointer: coarse), (max-width: 1023px)');
    const updateDragSupport = () => setIsMobileDragDisabled(mediaQuery.matches);

    updateDragSupport();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateDragSupport);
      return () => mediaQuery.removeEventListener('change', updateDragSupport);
    }

    if (mediaQuery.addListener) {
      mediaQuery.addListener(updateDragSupport);
      return () => mediaQuery.removeListener(updateDragSupport);
    }

    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 1023px)');
    setIsMobileView(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'development') return;
    const params = new URLSearchParams(window.location.search);
    const queryEnabled = params.has('debugLayout') && params.get('debugLayout') !== '0';
    const envEnabled = process.env.NEXT_PUBLIC_SCHEDULE_DEBUG_LAYOUT === 'true';
    setShowLayoutDebug(queryEnabled || envEnabled);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    runLayoutFixtureValidation();
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'c') return;
      if (!event.ctrlKey || !event.shiftKey) return;
      event.preventDefault();
      setIsCategoryDebugOpen(true);
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  useEffect(() => {
    if (!loadedArchiveName) return;
    setActiveArchiveName(loadedArchiveName);
  }, [loadedArchiveName, setActiveArchiveName]);

  useEffect(() => {
    if (!isImageExportMenuOpen && !isJsonMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (imageExportMenuRef.current && !imageExportMenuRef.current.contains(target)) {
        setIsImageExportMenuOpen(false);
      }
      if (jsonMenuRef.current && !jsonMenuRef.current.contains(target)) {
        setIsJsonMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isImageExportMenuOpen, isJsonMenuOpen]);

  const startTitleHold = () => {
    if (titleHoldTimerRef.current) {
      window.clearTimeout(titleHoldTimerRef.current);
    }
    titleHoldTimerRef.current = window.setTimeout(() => {
      setIsHiddenSettingsOpen(true);
      titleHoldTimerRef.current = null;
    }, TITLE_HOLD_OPEN_MS);
  };

  const clearTitleHold = () => {
    if (!titleHoldTimerRef.current) return;
    window.clearTimeout(titleHoldTimerRef.current);
    titleHoldTimerRef.current = null;
  };

  const categoryStats = useMemo(() => {
    const normalized = schedule.map(entry => (
      typeof entry.category === 'string' ? entry.category.trim() : ''
    ));
    const unique = Array.from(new Set(normalized.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'sv'));
    const missingCount = normalized.filter(value => !value).length;
    return {
      unique,
      missingCount,
      totalCount: schedule.length
    };
  }, [schedule]);

  // Statistics
  const scheduleStats = useMemo(() => {
    const visibleSchedule = schedule.filter(entry => advancedFilterMatch(entry, filterQuery));
    const intervalsByDayAndTitle: Record<string, Record<string, { start: number; end: number }[]>> = {};

    visibleSchedule.forEach(entry => {
      if (!intervalsByDayAndTitle[entry.day]) intervalsByDayAndTitle[entry.day] = {};
      if (!intervalsByDayAndTitle[entry.day][entry.title]) intervalsByDayAndTitle[entry.day][entry.title] = [];
      
      intervalsByDayAndTitle[entry.day][entry.title].push({
        start: timeToMinutes(entry.startTime),
        end: timeToMinutes(entry.endTime),
      });
    });

    const stats: Record<string, number> = {};

    Object.entries(intervalsByDayAndTitle).forEach(([day, subjects]) => {
      Object.entries(subjects).forEach(([title, intervals]) => {
        if (intervals.length === 0) return;
        
        const sorted = [...intervals].sort((a, b) => a.start - b.start);
        let totalForDay = 0;
        let currentStart = sorted[0].start;
        let currentEnd = sorted[0].end;

        sorted.slice(1).forEach(interval => {
          if (interval.start <= currentEnd) {
            currentEnd = Math.max(currentEnd, interval.end);
          } else {
            totalForDay += currentEnd - currentStart;
            currentStart = interval.start;
            currentEnd = interval.end;
          }
        });
        totalForDay += currentEnd - currentStart;

        if (!stats[title]) stats[title] = 0;
        stats[title] += totalForDay;
      });
    });

    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [schedule, filterQuery]);

  const hoursFormatter = useMemo(() => new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }), []);

  const hasMissingScheduleBlocks = useMemo(() => {
    if (schedule.length === 0) return false;
    const currentCourseKeys = new Set(courses.map(course => buildCourseDedupeKey(course)));
    const derivedScheduleCourses = deriveCoursesFromSchedule(schedule);
    return derivedScheduleCourses.some(course => !currentCourseKeys.has(buildCourseDedupeKey(course)));
  }, [courses, schedule]);

  const layoutByDay = useMemo(() => {
    const layout: Record<string, Map<string, DayLayoutEntry>> = {};
    PLANNER_DAYS.forEach(day => {
      const entries = schedule.filter(entry => entry.day === day);
      layout[day] = buildDayLayout(entries);
    });
    return layout;
  }, [schedule]);

  const daySubjectTotals = useMemo(() => {
    const totals: Record<string, Record<string, number>> = {};
    const intervalsByDay: Record<string, Record<string, { start: number; end: number }[]>> = {};
    PLANNER_DAYS.forEach(day => {
      totals[day] = {};
      intervalsByDay[day] = {};
    });
    schedule.forEach(entry => {
      if (!intervalsByDay[entry.day]) {
        intervalsByDay[entry.day] = {};
      }
      if (!intervalsByDay[entry.day][entry.title]) {
        intervalsByDay[entry.day][entry.title] = [];
      }
      intervalsByDay[entry.day][entry.title].push({
        start: timeToMinutes(entry.startTime),
        end: timeToMinutes(entry.endTime),
      });
    });
    Object.entries(intervalsByDay).forEach(([day, subjects]) => {
      Object.entries(subjects).forEach(([title, intervals]) => {
        if (intervals.length === 0) return;
        const sorted = [...intervals].sort((a, b) => a.start - b.start);
        let total = 0;
        let currentStart = sorted[0].start;
        let currentEnd = sorted[0].end;
        sorted.slice(1).forEach(interval => {
          if (interval.start < currentEnd && interval.end > currentStart) {
            currentEnd = Math.max(currentEnd, interval.end);
          } else {
            total += currentEnd - currentStart;
            currentStart = interval.start;
            currentEnd = interval.end;
          }
        });
        total += currentEnd - currentStart;
        totals[day][title] = total;
      });
    });
    return totals;
  }, [schedule]);

  const formatDuration = useCallback((minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours}h + ${remaining} min`;
  }, []);

  const dayHeaderTooltips = useMemo(() => {
    const tooltips: Record<string, string> = {};
    PLANNER_DAYS.forEach(day => {
      const entries = Object.entries(daySubjectTotals[day] ?? {});
      if (entries.length === 0) {
        tooltips[day] = 'Inget schemalagt';
        return;
      }
      const totalMinutes = entries.reduce((sum, [, minutes]) => sum + minutes, 0);
      const lines = entries
        .sort((a, b) => b[1] - a[1])
        .map(([title, minutes]) => `${title}: ${formatDuration(minutes)}`);
      tooltips[day] = [`Totalt: ${formatDuration(totalMinutes)}`, ...lines].join('\n');
    });
    return tooltips;
  }, [daySubjectTotals, formatDuration]);

  // --- JSON Import/Export Handlers ---

  const handleExportJSON = () => {
    const dataToSave: PersistedPlannerState = {
      version: 5,
      timestamp: new Date().toISOString(),
      courses,
      schedule,
      restrictions
    };
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schema-backup-v5-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.courses && parsed.schedule) {
          setPendingImportData({
            courses: sanitizeManualCourses(parsed.courses),
            schedule: sanitizeScheduleImport(parsed.schedule),
            restrictions: parsed.restrictions
          });
          setIsImportConfirmOpen(true);
        } else {
          showNotice('Ogiltig filstruktur.', 'error');
        }
      } catch (error) {
        showNotice('Kunde inte läsa filen.', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleConfirmImport = useCallback(() => {
    if (!pendingImportData) return;
    setManualCourses(pendingImportData.courses);
    commitSchedule(() => pendingImportData.schedule, { clearHistory: true });
    if (pendingImportData.restrictions) {
      setRestrictions(pendingImportData.restrictions);
    }
    setIsImportConfirmOpen(false);
    setPendingImportData(null);
  }, [commitSchedule, pendingImportData, setManualCourses]);

  const handleAddRestrictionRule = useCallback(() => {
    if (!newRule.subjectA || !newRule.subjectB) return;
    setRestrictions(prev => [...prev, { ...newRule, id: uuidv4() }]);
  }, [newRule]);

  const handleRemoveRestrictionRule = useCallback((ruleId: string) => {
    setRestrictions(prev => prev.filter(rule => rule.id !== ruleId));
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    const handleDismiss = () => setContextMenu(null);
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('click', handleDismiss);
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('click', handleDismiss);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

  // --- CRUD Handlers ---

  const handleSaveCourseSubmit = useCallback((event: React.FormEvent) => {
    handleSaveCourse(event, editingCourse, () => {
      setIsCourseModalOpen(false);
    });
  }, [editingCourse, handleSaveCourse]);
  
  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if(!editingEntry) return;

    const startMin = timeToMinutes(editingEntry.startTime);
    const endMin = timeToMinutes(editingEntry.endTime);
    
    if (endMin <= startMin) {
        alert("Sluttid måste vara efter starttid!");
        return;
    }

    const newDuration = endMin - startMin;

    const conflict = validateRestrictions(
        { 
            title: editingEntry.title, 
            day: editingEntry.day, 
            startTime: editingEntry.startTime, 
            endTime: editingEntry.endTime, 
            instanceId: editingEntry.instanceId 
        },
        schedule,
        restrictions
    );

    if (conflict) {
        alert(conflict);
        return;
    }
    
    commitSchedule(p => p.map(entry => entry.instanceId === editingEntry.instanceId ? {...editingEntry, duration: newDuration} : entry));
    setIsEntryModalOpen(false);
  };

  // --- Duplicate / Placement Handlers ---

  const handleDuplicateParallel = useCallback((entry: ScheduledEntry) => {
    const newEntry: ScheduledEntry = { ...entry, instanceId: uuidv4() };
    commitSchedule(prev => [...prev, newEntry]);
    setContextMenu(null);
    showNotice('Post duplicerad parallellt', 'success');
  }, [commitSchedule, showNotice]);

  const handleDuplicateAndPlace = useCallback((entry: ScheduledEntry) => {
    setPendingPlacement({ ...entry, instanceId: uuidv4() });
    setContextMenu(null);
  }, []);

  const handlePlacementMouseMove = useCallback((day: string, relativeY: number) => {
    if (!pendingPlacement) return;
    const rawMin = relativeY / PIXELS_PER_MINUTE + START_HOUR * 60;
    const snapped = snapTime(Math.max(START_HOUR * 60, Math.min((END_HOUR * 60) - pendingPlacement.duration, rawMin)));
    setPlacementGhost({
      day,
      startTime: minutesToTime(snapped),
      endTime: minutesToTime(snapped + pendingPlacement.duration),
      duration: pendingPlacement.duration,
      color: pendingPlacement.color,
      title: pendingPlacement.title,
    });
  }, [pendingPlacement]);

  const handlePlacementClick = useCallback((day: string, relativeY: number) => {
    if (!pendingPlacement) return;
    const rawMin = relativeY / PIXELS_PER_MINUTE + START_HOUR * 60;
    const snapped = snapTime(Math.max(START_HOUR * 60, Math.min((END_HOUR * 60) - pendingPlacement.duration, rawMin)));
    const startTime = minutesToTime(snapped);
    const endTime = minutesToTime(snapped + pendingPlacement.duration);
    commitSchedule(prev => [...prev, { ...pendingPlacement, day, startTime, endTime }]);
    setPendingPlacement(null);
    setPlacementGhost(null);
    showNotice('Post placerad', 'success');
  }, [pendingPlacement, commitSchedule, showNotice]);

  // Escape to cancel placement mode
  useEffect(() => {
    if (!pendingPlacement) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingPlacement(null);
        setPlacementGhost(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [pendingPlacement]);

  // --- Render ---

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div>
        {/* Background image */}
        <div className="fixed inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bakgrund59.png"
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="pb-20 relative z-10">
        <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-6">

        {/* Toolbar & Filter */}
        <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col lg:flex-row gap-6 items-start lg:items-center">
           {/* Mobile title */}
           <div className="lg:hidden">
             <FeatureNavigation />
           </div>
           {/* Desktop title wrapper – matches left sidebar width */}
           <div className={`flex-shrink-0 transition-all duration-300 hidden lg:flex items-center overflow-hidden lg:-ml-4 ${isSidebarCollapsed ? 'w-auto pl-[122px] justify-start' : 'w-[360px] justify-center'}`}>
              <FeatureNavigation />
           </div>
           
           <div className="flex-1 max-w-md w-full relative mr-auto">
              <Input 
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter: 'Lärare'+'ämne'; -Ämne"
                className="border-2 border-black shadow-sm pl-10"
              />
              <div
                className="absolute left-3 top-2.5 text-gray-400 cursor-help"
                title={"Sökguide:\n+ = Kräver båda (ex: matte+hanna)\n; = ELLER-sökning (ex: idrott;musik)\n- = Exkludera (ex: -engelska)"}
              >
                🔍
              </div>
           </div>

           <div className="flex gap-2 flex-wrap">
              <Button variant="neutral" onClick={handleExportPDF} className="border-2 border-black"><Download size={16} className="mr-2"/> PDF</Button>
              <div className="relative" ref={imageExportMenuRef}>
                <Button
                  variant="neutral"
                  onClick={() => setIsImageExportMenuOpen(open => !open)}
                  className="h-10 w-10 p-0 border-2 border-black"
                  aria-label="Bildexport meny"
                >
                  <MoreVertical size={16} />
                </Button>
                {isImageExportMenuOpen && (
                  <div className="absolute right-0 z-20 z-[100] mt-2 w-36 rounded-lg border-2 border-black bg-white p-1 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                    <button
                      type="button"
                      className="w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                      onClick={() => {
                        handleExportImage('png');
                        setIsImageExportMenuOpen(false);
                      }}
                    >
                      Exportera PNG
                    </button>
                    <button
                      type="button"
                      className="w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                      onClick={() => {
                        handleExportImage('jpeg');
                        setIsImageExportMenuOpen(false);
                      }}
                    >
                      Exportera JPG
                    </button>
                  </div>
                )}
              </div>
              <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportJSON} />
              <Button variant="neutral" onClick={() => setIsClearScheduleConfirmOpen(true)} className="border-2 border-black bg-rose-100 text-rose-800"><RefreshCcw size={16} className="mr-2"/> Rensa</Button>
              <div className="relative ml-auto" ref={jsonMenuRef}>
                <Button
                  variant="neutral"
                  onClick={() => setIsJsonMenuOpen(open => !open)}
                  className="h-10 w-10 p-0 border-2 border-black"
                  aria-label="JSON meny"
                >
                  <MoreVertical size={16} />
                </Button>
                {isJsonMenuOpen && (
                  <div className="absolute right-0 z-20 z-[100] mt-2 w-36 rounded-lg border-2 border-black bg-white p-1 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                      onClick={() => {
                        handleExportJSON();
                        setIsJsonMenuOpen(false);
                      }}
                    >
                      <Download size={14} />
                      Spara
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                      onClick={() => {
                        fileInputRef.current?.click();
                        setIsJsonMenuOpen(false);
                      }}
                    >
                      <Upload size={14} />
                      Ladda
                    </button>
                  </div>
                )}
              </div>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 h-[1100px]">
          
          {/* Sidebar */}
          <div
            className={`flex flex-col gap-4 h-full transition-all duration-300 ${
              isSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[360px]'
            } hidden lg:flex`}
          >
             <div className={`rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] flex-1 overflow-hidden flex flex-col transition-all duration-300 ${
               isSidebarCollapsed ? 'p-2' : 'p-4'
             }`}>
                <div className={`flex items-center gap-3 mb-4 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                  <h2 className={`font-bold flex items-center gap-2 ${isSidebarCollapsed ? 'sr-only' : ''}`}>
                    <Hammer size={18}/> Byggstenar
                  </h2>
                  {!isSidebarCollapsed && (
                    <Button
                      size="sm"
                      variant="neutral"
                      onClick={() => setIsRestrictionsModalOpen(true)}
                      className="h-8 border-2 border-black bg-amber-100 hover:bg-amber-200 text-xs"
                    >
                      <ShieldAlert size={14} className="mr-1" /> Regler
                    </Button>
                  )}
                  {!isSidebarCollapsed && (
                    <Button size="sm" onClick={() => {
                      setManualColor(false);
                      setEditingCourse({ id: uuidv4(), title: '', teacher: '', room: '', color: DEFAULT_COURSE_COLOR, duration: 60 });
                      setIsCourseModalOpen(true);
                    }} className="h-8 w-8 p-0 rounded-full border-2 border-black bg-[#aee8fe]"><Plus size={16}/></Button>
                  )}
                  <Button
                    size="sm"
                    variant="neutral"
                    onClick={() => setIsSidebarCollapsed(prev => !prev)}
                    className="h-8 w-8 p-0 border-2 border-black"
                    aria-label={isSidebarCollapsed ? 'Visa byggstenar' : 'Dölj byggstenar'}
                  >
                    {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                  </Button>
                </div>

                {isSidebarCollapsed && (
                  <div className="flex justify-center">
                    <Hammer size={18} />
                  </div>
                )}

                {/* Courses List */}
                {!isSidebarCollapsed && (
                  <>
                    {hasMissingScheduleBlocks && (
                      <Button
                        variant="neutral"
                        onClick={() => {
                          recomputeCourses(schedule, manualCourses);
                          showNotice('Byggstenar uppdaterade.', 'success');
                        }}
                        className="mb-3 border-2 border-black bg-emerald-100 hover:bg-emerald-200"
                      >
                        <RefreshCcw size={16} className="mr-2"/> Uppdatera byggstenar från schema
                      </Button>
                    )}
                  <div className="overflow-y-auto pr-2 min-h-0">
                     {courses.map(c => (
                       <DraggableSourceCard 
                         key={c.id}
                         course={c}
                         onEdit={(c) => { setManualColor(true); setEditingCourse(c); setIsCourseModalOpen(true); }}
                         onDelete={handleDeleteCourse}
                         isDerived={derivedCourseKeys.has(buildCourseDedupeKey(c)) && !manualCourseKeys.has(buildCourseDedupeKey(c))}
                         dragDisabled={isMobileDragDisabled}
                         hidden={!advancedFilterMatch(c, filterQuery)}
                       />
                     ))}
                  </div>
                  </>
                )}

                {/* Statistics */}
                {!isSidebarCollapsed && (
                  <div className="mt-4 pt-4 border-t-2 border-gray-100 mb-auto">
                    <div className="flex items-center gap-2 mb-2 text-gray-500">
                      <BarChart3 size={14} /> 
                      <span className="text-xs font-bold uppercase">Tid (Filtrerat)</span>
                    </div>
                    <div className="space-y-1 text-xs max-h-[100px] overflow-y-auto">
                      {scheduleStats.length === 0 ? <span className="text-gray-400 italic">Inget schemalagt</span> : 
                        scheduleStats.slice(0, 10).map(([title, minutes]) => {
                          const hours = minutes / 60;
                          return (
                            <div key={title} className="flex justify-between">
                              <span>{title}</span>
                              <span className="font-mono font-bold">{hoursFormatter.format(hours)} h</span>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                )}

             </div>
          </div>

          {/* Main Schedule Area */}
          <div className="flex-1 rounded-xl border-2 border-black bg-gray-50 overflow-hidden shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col h-full">
             <div className="flex-1 overflow-y-auto relative" id="schedule-canvas">
                <div className="schedule-desktop-header hidden lg:flex sticky top-0 z-[60] pl-[50px] border-b-2 border-black bg-white">
                   {PLANNER_DAYS.map(day => (
                     <div
                       key={day}
                       className="flex-1 py-2 text-center font-bold text-sm border-r border-gray-200 last:border-0 cursor-help"
                       title={dayHeaderTooltips[day]}
                     >
                       {day}
                     </div>
                   ))}
                </div>

                <div className="schedule-mobile-header lg:hidden sticky top-0 z-[60] border-b-2 border-black bg-white">
                  <div className="flex items-center justify-between gap-2 px-2 py-1">
                    <Button
                      size="sm"
                      variant="neutral"
                      className="h-8 w-8 p-0 border-2 border-black"
                      aria-label="Föregående schema"
                      onClick={() => { void handleMobileArchiveStep('prev'); }}
                      disabled={isAtFirstMobileArchive}
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <span className="truncate px-2 text-sm font-bold text-center">
                      {mobileSelectedArchiveName ?? activeArchiveName ?? 'Aktivt schema'}
                    </span>
                    <Button
                      size="sm"
                      variant="neutral"
                      className="h-8 w-8 p-0 border-2 border-black"
                      aria-label="Nästa schema"
                      onClick={() => { void handleMobileArchiveStep('next'); }}
                      disabled={isAtLastMobileArchive}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-2 py-1">
                    <Button
                      size="sm"
                      variant="neutral"
                      className="h-8 w-8 p-0 border-2 border-black"
                      aria-label="Föregående dag"
                      onClick={() => setMobileActiveDayIndex(prev => Math.max(0, prev - 1))}
                      disabled={isAtFirstMobileDay}
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <span className="text-sm font-bold">{mobileSelectedDay}</span>
                    <Button
                      size="sm"
                      variant="neutral"
                      className="h-8 w-8 p-0 border-2 border-black"
                      aria-label="Nästa dag"
                      onClick={() => setMobileActiveDayIndex(prev => Math.min(PLANNER_DAYS.length - 1, prev + 1))}
                      disabled={isAtLastMobileDay}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>

                {/* VIKTIGT: pt-4 HÄR gör att 08:00 texten syns! */}
                <div className="flex min-h-full pt-4">
                   <div className="w-[50px] flex-shrink-0 bg-gray-100 relative">
                      <div className="absolute -top-4 left-0 right-0 h-4 bg-gray-100" />
                      {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i).map(h => (
                        <div key={h} className="absolute w-full text-right pr-1 text-xs font-bold text-gray-500 -mt-2"
                             style={{ top: `${(h - START_HOUR) * 60 * PIXELS_PER_MINUTE}px` }}>
                           {h}:00
                        </div>
                      ))}
                   </div>

                   <div className="schedule-desktop-grid hidden lg:contents">
                   {(!isMobileView) && (
                     <>
                       {PLANNER_DAYS.map(day => (
                         <DayColumn
                           key={day} day={day}
                           ghost={ghostPlacement?.day === day ? ghostPlacement : null}
                           placementGhost={placementGhost?.day === day ? placementGhost : null}
                           isPlacementMode={!!pendingPlacement}
                           onPlacementMouseMove={pendingPlacement ? (relY) => handlePlacementMouseMove(day, relY) : undefined}
                           onPlacementClick={pendingPlacement ? (relY) => handlePlacementClick(day, relY) : undefined}
                         >
                            {(() => {
                              const dayEntries = schedule.filter(e => e.day === day);
                              const lastEndTime = dayEntries.reduce((latest, entry) => {
                                const endMinutes = timeToMinutes(entry.endTime);
                                return Math.max(latest, endMinutes);
                              }, -Infinity);

                              return dayEntries.map(entry => {
                              const layout = layoutByDay[day]?.get(entry.instanceId);
                              const columnIndex = layout?.column ?? 0;
                              const columnCount = layout?.columns ?? 1;
                              return (
                               <ScheduledEventCard
                                 key={entry.instanceId}
                                 entry={entry}
                                 onEdit={(e) => { setEditingEntry(e); setIsEntryModalOpen(true); }}
                                 onRemove={(id) => commitSchedule(p => p.filter(e => e.instanceId !== id))}
                                 onContextMenu={(event, selectedEntry) => {
                                   event.preventDefault();
                                   setContextMenu({
                                     x: event.clientX,
                                     y: event.clientY,
                                     entry: selectedEntry
                                   });
                                 }}
                                 hidden={!advancedFilterMatch(entry, filterQuery)}
                                  dragDisabled={isMobileDragDisabled}
                                  columnIndex={columnIndex}
                                  columnCount={columnCount}
                                  isLastOfDay={timeToMinutes(entry.endTime) === lastEndTime}
                                  showLayoutDebug={showLayoutDebug}
                               />
                              );
                              });
                            })()}
                         </DayColumn>
                       ))}
                     </>
                   )}
                   </div>

                   <div className="schedule-mobile-grid lg:hidden flex-1 min-w-0">
                     {(isMobileView) && (
                       <DayColumn
                         day={mobileSelectedDay}
                         ghost={ghostPlacement?.day === mobileSelectedDay ? ghostPlacement : null}
                         placementGhost={placementGhost?.day === mobileSelectedDay ? placementGhost : null}
                         isPlacementMode={!!pendingPlacement}
                         onPlacementMouseMove={pendingPlacement ? (relY) => handlePlacementMouseMove(mobileSelectedDay, relY) : undefined}
                         onPlacementClick={pendingPlacement ? (relY) => handlePlacementClick(mobileSelectedDay, relY) : undefined}
                         className="min-w-0"
                       >
                         {(() => {
                           const dayEntries = schedule.filter(e => e.day === mobileSelectedDay);
                           const lastEndTime = dayEntries.reduce((latest, entry) => {
                             const endMinutes = timeToMinutes(entry.endTime);
                             return Math.max(latest, endMinutes);
                           }, -Infinity);

                           return dayEntries.map(entry => {
                             const layout = layoutByDay[mobileSelectedDay]?.get(entry.instanceId);
                             const columnIndex = layout?.column ?? 0;
                             const columnCount = layout?.columns ?? 1;
                             return (
                               <ScheduledEventCard
                                 key={entry.instanceId}
                                 entry={entry}
                                 onEdit={(e) => { setEditingEntry(e); setIsEntryModalOpen(true); }}
                                 onRemove={(id) => commitSchedule(p => p.filter(e => e.instanceId !== id))}
                                 onContextMenu={(event, selectedEntry) => {
                                   event.preventDefault();
                                   setContextMenu({
                                     x: event.clientX,
                                     y: event.clientY,
                                     entry: selectedEntry
                                   });
                                 }}
                                 hidden={!advancedFilterMatch(entry, filterQuery)}
                                 dragDisabled={isMobileDragDisabled}
                                 columnIndex={columnIndex}
                                 columnCount={columnCount}
                                 isLastOfDay={timeToMinutes(entry.endTime) === lastEndTime}
                                 showLayoutDebug={showLayoutDebug}
                               />
                             );
                           });
                         })()}
                       </DayColumn>
                     )}
                   </div>
                </div>
             </div>
          </div>

        </div>
        </div>

        {/* Archive Sidebar – sibling of left column, spans full height */}
        <div
          className={`hidden lg:flex flex-col gap-4 transition-all duration-300 ${
            isRightSidebarCollapsed ? 'w-[72px]' : 'w-[320px]'
          }`}
        >
           <div className={`rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] flex-1 overflow-hidden flex flex-col transition-all duration-300 ${
             isRightSidebarCollapsed ? 'p-2' : 'p-4'
           }`}>
              <div className={`flex ${isRightSidebarCollapsed ? 'flex-col items-center gap-3' : 'justify-between items-center mb-4'}`}>
                <h2 className={`font-bold flex items-center gap-2 ${isRightSidebarCollapsed ? 'sr-only' : ''}`}>
                  <Archive size={18}/> Sparade Veckor
                </h2>
                <Button
                  size="sm"
                  variant="neutral"
                  onClick={() => setIsRightSidebarCollapsed(prev => !prev)}
                  className="h-8 w-8 p-0 border-2 border-black"
                  aria-label={isRightSidebarCollapsed ? 'Visa arkiv' : 'Dölj arkiv'}
                >
                  {isRightSidebarCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </Button>
                {isRightSidebarCollapsed && (
                  <div className="flex flex-col items-center gap-2 text-xs font-bold text-gray-600">
                    <Archive size={18}/>
                  </div>
                )}
              </div>

              {!isRightSidebarCollapsed && (
                <div className="flex flex-col gap-4 flex-1">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-gray-500">Spara vecka</Label>
                    <div className="flex gap-2">
                      <Input
                        value={weekName}
                        onChange={(e) => setWeekName(e.target.value)}
                        placeholder="Vecka 42 eller Höstlov"
                        className="border-2 border-black shadow-sm"
                      />
                      <Button
                        variant="neutral"
                        onClick={handleSaveWeek}
                        disabled={!weekName.trim()}
                        className="border-2 border-black bg-amber-100 hover:bg-amber-200"
                      >
                        <Save size={14} className="mr-2"/> Spara
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                    {sortedWeekNames.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">Inga sparade veckor ännu.</p>
                    ) : (
                      sortedWeekNames.map(name => (
                        <div
                          key={name}
                          className="rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_rgba(0,0,0,1)] p-3 flex items-center gap-2"
                        >
                          <Button
                            type="button"
                            variant="noShadow"
                            onClick={() => handleLoadWeek(name)}
                            className="h-auto flex-1 min-w-0 justify-start whitespace-normal border-0 bg-transparent p-0 text-left shadow-none hover:translate-x-0 hover:translate-y-0 hover:bg-transparent"
                          >
                            <span className="font-bold text-sm break-words leading-tight">{name}{activeArchiveName === name ? ' • aktiv' : ''}</span>
                          </Button>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              size="sm"
                              variant="neutral"
                              onClick={() => handleDuplicateWeek(name)}
                              className="h-8 w-8 p-0 border-2 border-black bg-indigo-100 hover:bg-indigo-200"
                              aria-label={`Duplicera ${name}`}
                              title={`Duplicera ${name}`}
                            >
                              <Copy size={14}/>
                            </Button>
                            <Button
                              size="sm"
                              variant="neutral"
                              onClick={() => handleDeleteWeek(name)}
                              className="h-8 w-8 p-0 border-2 border-black bg-rose-100 hover:bg-rose-200 text-rose-800"
                              aria-label={`Ta bort ${name}`}
                              title={`Ta bort ${name}`}
                            >
                              <Trash2 size={14}/>
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
           </div>
        </div>
        </div>
        </div>
      </div>

      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
        {activeDragItem?.type === 'course' && (
          <div className="w-[120px] h-[60px] bg-white border-2 border-black p-2 rounded shadow-xl opacity-80" style={{backgroundColor: activeDragItem.course.color}}>
             {activeDragItem.course.title}
          </div>
        )}
        {activeDragItem?.type === 'scheduled' && (
           <div className="w-[120px] bg-white border-2 border-black p-1 rounded shadow-xl opacity-80" 
             style={{ height: `${Math.max(activeDragItem.entry.duration * PIXELS_PER_MINUTE - EVENT_GAP_PX, MIN_HEIGHT_PX)}px`, backgroundColor: activeDragItem.entry.color }}>
              {activeDragItem.entry.title}
           </div>
        )}
      </DragOverlay>

      {contextMenu && (
        <div
          className="fixed z-[100] w-max rounded border-2 border-black bg-white shadow-lg"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="w-full px-1.5 py-2 text-left text-sm hover:bg-gray-100"
            onClick={() => {
              setEditingEntry(contextMenu.entry);
              setIsEntryModalOpen(true);
              setContextMenu(null);
            }}
          >
            Redigera
          </button>
          <button
            className="w-full px-1.5 py-2 text-left text-sm hover:bg-gray-100"
            onClick={() => handleDuplicateParallel(contextMenu.entry)}
          >
            Duplicera och lägg parallellt
          </button>
          <button
            className="w-full px-1.5 py-2 text-left text-sm hover:bg-gray-100"
            onClick={() => handleDuplicateAndPlace(contextMenu.entry)}
          >
            Duplicera och placera
          </button>
          <button
            className="w-full px-1.5 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
            onClick={() => {
              commitSchedule(p => p.filter(e => e.instanceId !== contextMenu.entry.instanceId));
              setContextMenu(null);
            }}
          >
            Radera
          </button>
        </div>
      )}

      {pendingPlacement && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[150] pointer-events-none bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg">
          Klicka i schemat för att placera <strong>&quot;{pendingPlacement.title}&quot;</strong> · Esc avbryter
        </div>
      )}

      {/* Modals */}
      <HiddenSettingsPanel
        open={isHiddenSettingsOpen}
        onOpenChange={setIsHiddenSettingsOpen}
        teachers={teachers}
        rooms={rooms}
        onSave={handleHiddenSettingsSave}
      />
      <CategoryDebugPanel
        open={isCategoryDebugOpen}
        onOpenChange={setIsCategoryDebugOpen}
        categories={categoryStats.unique}
        missingCount={categoryStats.missingCount}
        totalCount={categoryStats.totalCount}
      />
      <ScheduleModals
        isCourseModalOpen={isCourseModalOpen}
        onCourseModalOpenChange={setIsCourseModalOpen}
        editingCourse={editingCourse}
        setEditingCourse={setEditingCourse}
        manualColor={manualColor}
        setManualColor={setManualColor}
        onSaveCourse={handleSaveCourseSubmit}
        teachers={teachers}
        rooms={rooms}
        isEntryModalOpen={isEntryModalOpen}
        onEntryModalOpenChange={setIsEntryModalOpen}
        editingEntry={editingEntry}
        setEditingEntry={setEditingEntry}
        onSaveEntry={handleSaveEntry}
        isRestrictionsModalOpen={isRestrictionsModalOpen}
        onRestrictionsModalOpenChange={setIsRestrictionsModalOpen}
        newRule={newRule}
        setNewRule={setNewRule}
        restrictions={restrictions}
        onAddRule={handleAddRestrictionRule}
        onRemoveRule={handleRemoveRestrictionRule}
        isImportConfirmOpen={isImportConfirmOpen}
        onImportConfirmOpenChange={(open) => {
          setIsImportConfirmOpen(open);
          if (!open) setPendingImportData(null);
        }}
        onCancelImport={() => setIsImportConfirmOpen(false)}
        onConfirmImport={handleConfirmImport}
        overwriteWeekName={overwriteWeekName}
        onOverwriteWeekNameChange={setOverwriteWeekName}
        onConfirmOverwriteWeek={handleConfirmOverwriteWeek}
        deleteWeekName={deleteWeekName}
        onDeleteWeekNameChange={setDeleteWeekName}
        onConfirmDeleteWeek={handleConfirmDeleteWeek}
        deleteCourseName={deleteCourseName}
        onDeleteCourseNameChange={(_value) => { setDeleteCourseId(null); }}
        onConfirmDeleteCourse={handleConfirmDeleteCourse}
        isClearScheduleConfirmOpen={isClearScheduleConfirmOpen}
        onClearScheduleConfirmOpenChange={setIsClearScheduleConfirmOpen}
        onConfirmClearSchedule={() => {
          commitSchedule(() => []);
          setIsClearScheduleConfirmOpen(false);
        }}
      />

      {plannerNotice && (
        <div className={`fixed bottom-4 right-4 z-[80] rounded-xl border-2 border-black px-4 py-3 text-sm font-semibold shadow-[4px_4px_0px_rgba(0,0,0,1)] ${plannerNotice.tone === 'success' ? 'bg-emerald-100 text-emerald-900' : plannerNotice.tone === 'warning' ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-900'}`}>
          {plannerNotice.message}
        </div>
      )}

    </DndContext>
  );
}
