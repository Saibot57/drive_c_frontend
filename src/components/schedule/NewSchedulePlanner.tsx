'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
  Settings,
  Save,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ACTIVE_ARCHIVE_NAME_KEY,
  AUTOSAVE_DELAY_MS,
  DEFAULT_COURSE_COLOR,
  DERIVED_COURSE_PREFIX,
  MANUAL_COURSES_KEY,
  PLANNER_DAYS,
  PLANNER_NOTICE_DISMISS_MS,
  ROOMS_KEY,
  TEACHERS_KEY,
  TITLE_HOLD_OPEN_MS
} from '@/components/schedule/constants';
import { generateBoxColor, importColors } from '@/config/colorManagement';
import { isVectorPdfExportEnabled } from '@/config/featureFlags';
import { PlannerActivity, PlannerCourse, ScheduledEntry, RestrictionRule, PersistedPlannerState } from '@/types/schedule';
import { ContextMenuState, GhostPlacement, PlannerNotice } from '@/types/plannerUI';
import { plannerService } from '@/services/plannerService';
import { 
  START_HOUR, END_HOUR, PIXELS_PER_MINUTE, 
  timeToMinutes, minutesToTime, 
  snapTime, checkOverlap, EVENT_GAP_PX, MIN_HEIGHT_PX
} from '@/utils/scheduleTime';
import { buildDayLayout, DayLayoutEntry } from '@/utils/scheduleLayout';
import { exportElementToVectorPdf } from '@/utils/vectorPdfExport';
import { runLayoutFixtureValidation } from '@/components/schedule/layoutValidation';
import { DraggableSourceCard } from '@/components/schedule/DraggableSourceCard';
import { ScheduledEventCard } from '@/components/schedule/ScheduledEventCard';
import { DayColumn } from '@/components/schedule/DayColumn';
import { CategoryDebugPanel, HiddenSettingsPanel } from '@/components/schedule/DebugPanels';
import { ScheduleModals } from '@/components/schedule/ScheduleModals';

const baseCourses: PlannerCourse[] = [];

// --- Helper: Derived Courses ---
const normalizeCoursePart = (value?: string) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const buildCourseDedupeKey = (course: Pick<PlannerCourse, 'title' | 'teacher' | 'room' | 'duration' | 'color' | 'category'>) => (
  [
    normalizeCoursePart(course.title),
    normalizeCoursePart(course.teacher),
    normalizeCoursePart(course.room),
    course.duration,
    normalizeCoursePart(course.color),
    normalizeCoursePart(course.category)
  ].join('|') // Dedupe key to keep schedule-derived courses stable.
);

const hashStringFnv1a = (value: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

const deriveCoursesFromSchedule = (scheduleEntries: ScheduledEntry[]) => {
  const unique = new Map<string, PlannerCourse>();

  scheduleEntries.forEach(entry => {
    const mappedCourse: PlannerCourse = {
      id: '',
      title: entry.title ?? '',
      teacher: '',
      room: '',
      duration: entry.duration ?? 60,
      color: entry.color ?? generateBoxColor(entry.title ?? ''),
      category: undefined
    };
    const dedupeKey = buildCourseDedupeKey(mappedCourse);
    if (unique.has(dedupeKey)) return;
    // Deterministic ID based on the dedupe key so derived courses stay stable across reloads.
    mappedCourse.id = `${DERIVED_COURSE_PREFIX}${hashStringFnv1a(dedupeKey)}`;
    unique.set(dedupeKey, mappedCourse);
  });

  return Array.from(unique.values()).sort((a, b) => a.title.localeCompare(b.title, 'sv'));
};

const sanitizeManualCourses = (input: unknown): PlannerCourse[] => {
  if (!Array.isArray(input)) return [];
  return input.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Partial<PlannerCourse>;
    if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return [];
    return [{
      id: raw.id,
      title: raw.title,
      teacher: typeof raw.teacher === 'string' ? raw.teacher : '',
      room: typeof raw.room === 'string' ? raw.room : '',
      color: typeof raw.color === 'string' ? raw.color : DEFAULT_COURSE_COLOR,
      duration: typeof raw.duration === 'number' && !Number.isNaN(raw.duration) ? raw.duration : 60,
      category: typeof raw.category === 'string' ? raw.category : undefined
    }];
  });
};

const mergeCourses = (manual: PlannerCourse[], derived: PlannerCourse[]) => {
  const merged = new Map<string, PlannerCourse>();
  manual.forEach(course => merged.set(buildCourseDedupeKey(course), course));
  // Manual courses win when keys collide with derived ones.
  derived.forEach(course => {
    const key = buildCourseDedupeKey(course);
    if (!merged.has(key)) merged.set(key, course);
  });
  return Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title, 'sv'));
};

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
  const [manualCourses, setManualCourses] = useState<PlannerCourse[]>(baseCourses);
  const [courses, setCourses] = useState<PlannerCourse[]>([]);
  const [schedule, setSchedule] = useState<ScheduledEntry[]>([]);
  const [restrictions, setRestrictions] = useState<RestrictionRule[]>([]);
  const scheduleHistoryRef = useRef<ScheduledEntry[][]>([]);
  const scheduleFutureRef = useRef<ScheduledEntry[][]>([]);
  
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(true);
  const [savedWeekNames, setSavedWeekNames] = useState<string[]>([]);
  const [weekName, setWeekName] = useState('');
  const [activeArchiveName, setActiveArchiveName] = useState<string | null>(null);
  const [mobileActiveDayIndex, setMobileActiveDayIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadStatus, setLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [showLayoutDebug, setShowLayoutDebug] = useState(false);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const isFirstRenderRef = useRef(true);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [isHiddenSettingsOpen, setIsHiddenSettingsOpen] = useState(false);
  const [isCategoryDebugOpen, setIsCategoryDebugOpen] = useState(false);
  const [isMobileDragDisabled, setIsMobileDragDisabled] = useState(false);
  const [plannerNotice, setPlannerNotice] = useState<PlannerNotice | null>(null);
  const [pendingImportData, setPendingImportData] = useState<{
    courses: PlannerCourse[];
    schedule: ScheduledEntry[];
    restrictions?: RestrictionRule[];
  } | null>(null);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [overwriteWeekName, setOverwriteWeekName] = useState<string | null>(null);
  const [deleteWeekName, setDeleteWeekName] = useState<string | null>(null);
  const titleHoldTimerRef = useRef<number | null>(null);

  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const [ghostPlacement, setGhostPlacement] = useState<GhostPlacement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contract: all schedule mutations must go through this function.
  const commitSchedule = useCallback((
    updater: (prev: ScheduledEntry[]) => ScheduledEntry[],
    options?: { clearHistory?: boolean }
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
  
  const desktopSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );
  const mobileSensors = useSensors(useSensor(KeyboardSensor));

  const sensors = isMobileDragDisabled ? mobileSensors : desktopSensors;

  const mapPlannerActivitiesToSchedule = useCallback((activities: PlannerActivity[]) => (
    sanitizeScheduleImport(
      activities.map(activity => ({
        id: activity.id,
        title: activity.title,
        teacher: activity.teacher ?? '',
        room: activity.room ?? '',
        color: activity.color ?? generateBoxColor(activity.title ?? ''),
        duration: activity.duration ?? 60,
        category: activity.category,
        instanceId: activity.id,
        day: activity.day ?? PLANNER_DAYS[0],
        startTime: activity.startTime ?? '08:00',
        endTime: activity.endTime ?? minutesToTime(timeToMinutes(activity.startTime ?? '08:00') + 60),
        notes: activity.notes ?? undefined
      }))
    )
  ), []);

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
    if (process.env.NODE_ENV !== 'development') return;
    const params = new URLSearchParams(window.location.search);
    const queryEnabled = params.has('debugLayout') && params.get('debugLayout') !== '0';
    const envEnabled = process.env.NEXT_PUBLIC_SCHEDULE_DEBUG_LAYOUT === 'true';
    setShowLayoutDebug(queryEnabled || envEnabled);
  }, []);

  useEffect(() => {
    if (!plannerNotice) return;
    const timeout = window.setTimeout(() => {
      setPlannerNotice(null);
    }, PLANNER_NOTICE_DISMISS_MS);

    return () => window.clearTimeout(timeout);
  }, [plannerNotice]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(MANUAL_COURSES_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const sanitized = sanitizeManualCourses(parsed);
      if (sanitized.length > 0) {
        setManualCourses(sanitized);
      }
    } catch (error) {
      console.warn('Kunde inte läsa manuella byggstenar.', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    runLayoutFixtureValidation();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedTeachers = window.localStorage.getItem(TEACHERS_KEY);
      const storedRooms = window.localStorage.getItem(ROOMS_KEY);
      const parsedTeachers = storedTeachers ? JSON.parse(storedTeachers) : [];
      const parsedRooms = storedRooms ? JSON.parse(storedRooms) : [];
      setTeachers(Array.isArray(parsedTeachers) ? parsedTeachers.filter(item => typeof item === 'string') : []);
      setRooms(Array.isArray(parsedRooms) ? parsedRooms.filter(item => typeof item === 'string') : []);
    } catch (error) {
      console.warn('Kunde inte läsa lärare/salar.', error);
    }
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k') return;
      if (!event.ctrlKey || !event.shiftKey) return;
      event.preventDefault();
      setIsHiddenSettingsOpen(true);
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
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
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(MANUAL_COURSES_KEY, JSON.stringify(manualCourses));
    } catch (error) {
      console.warn('Kunde inte spara manuella byggstenar.', error);
    }
  }, [manualCourses]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (activeArchiveName) {
      window.localStorage.setItem(ACTIVE_ARCHIVE_NAME_KEY, activeArchiveName);
      return;
    }
    window.localStorage.removeItem(ACTIVE_ARCHIVE_NAME_KEY);
  }, [activeArchiveName]);

  useEffect(() => {
    const loadPlannerActivities = async () => {
      try {
        const storedArchiveName = window.localStorage.getItem(ACTIVE_ARCHIVE_NAME_KEY);
        const activities = storedArchiveName
          ? await plannerService.getPlannerArchive(storedArchiveName)
          : await plannerService.getPlannerActivities();
        const mappedSchedule = mapPlannerActivitiesToSchedule(activities);
        commitSchedule(() => mappedSchedule, { clearHistory: true });
        if (storedArchiveName) {
          setActiveArchiveName(storedArchiveName);
        }
        setLoadStatus('loaded');
      } catch (e) {
        console.error('Planner load failed', e);
        window.localStorage.removeItem(ACTIVE_ARCHIVE_NAME_KEY);
        setLoadStatus('error');
      }
    };

    loadPlannerActivities();
  }, [commitSchedule, mapPlannerActivitiesToSchedule]);

  useEffect(() => {
    const loadArchiveNames = async () => {
      try {
        const names = await plannerService.getPlannerArchiveNames();
        setSavedWeekNames(names);
      } catch (error) {
        console.error('Archive names load failed', error);
      }
    };

    loadArchiveNames();
  }, []);

  const handleHiddenSettingsSave = useCallback((nextTeachers: string[], nextRooms: string[]) => {
    setTeachers(nextTeachers);
    setRooms(nextRooms);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TEACHERS_KEY, JSON.stringify(nextTeachers));
      window.localStorage.setItem(ROOMS_KEY, JSON.stringify(nextRooms));
    } catch (error) {
      console.warn('Kunde inte spara lärare/salar.', error);
    }
  }, []);

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

  const recomputeCourses = useCallback((nextSchedule: ScheduledEntry[], nextManual: PlannerCourse[]) => {
    const derived = deriveCoursesFromSchedule(nextSchedule);
    const merged = mergeCourses(nextManual, derived);
    setCourses(merged);
  }, []);

  const manualCourseKeys = useMemo(() => (
    new Set(manualCourses.map(course => buildCourseDedupeKey(course)))
  ), [manualCourses]);

  const derivedCourseKeys = useMemo(() => (
    new Set(deriveCoursesFromSchedule(schedule).map(course => buildCourseDedupeKey(course)))
  ), [schedule]);

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

  useEffect(() => {
    recomputeCourses(schedule, manualCourses);
  }, [manualCourses, recomputeCourses, schedule]);

  // Sync colors
  useEffect(() => {
    const colorMap = courses.map(c => ({ className: c.title, color: c.color }));
    importColors(colorMap);
  }, [courses]);

  // Statistics
  const scheduleStats = useMemo(() => {
    const stats: Record<string, number> = {};
    const visibleSchedule = schedule.filter(entry => advancedFilterMatch(entry, filterQuery));
    visibleSchedule.forEach(entry => {
      if (!stats[entry.title]) stats[entry.title] = 0;
      stats[entry.title] += entry.duration;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [schedule, filterQuery]);

  const sortedWeekNames = useMemo(() => {
    const weekPattern = /^v\.?\s*(\d+)$/i;
    const getWeekNumber = (name: string) => {
      const match = name.match(weekPattern);
      return match ? Number(match[1]) : null;
    };

    return [...savedWeekNames].sort((a, b) => {
      const weekA = getWeekNumber(a);
      const weekB = getWeekNumber(b);

      if (weekA !== null && weekB !== null) {
        return weekA - weekB;
      }

      return a.localeCompare(b, 'sv');
    });
  }, [savedWeekNames]);

  const hoursFormatter = useMemo(() => new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }), []);

  const mobileActiveArchiveIndex = useMemo(() => {
    if (sortedWeekNames.length === 0) return -1;
    if (!activeArchiveName) return 0;
    const foundIndex = sortedWeekNames.findIndex(name => name === activeArchiveName);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [activeArchiveName, sortedWeekNames]);

  const mobileSelectedDay = PLANNER_DAYS[mobileActiveDayIndex] ?? PLANNER_DAYS[0];
  const mobileSelectedArchiveName = sortedWeekNames[mobileActiveArchiveIndex] ?? null;
  const isAtFirstMobileArchive = mobileActiveArchiveIndex <= 0;
  const isAtLastMobileArchive = mobileActiveArchiveIndex < 0 || mobileActiveArchiveIndex >= sortedWeekNames.length - 1;
  const isAtFirstMobileDay = mobileActiveDayIndex <= 0;
  const isAtLastMobileDay = mobileActiveDayIndex >= PLANNER_DAYS.length - 1;

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

  const mapScheduleToPlannerActivities = useCallback((entries: ScheduledEntry[]): PlannerActivity[] => (
    entries.map(entry => ({
      id: entry.instanceId,
      title: entry.title,
      room: entry.room,
      teacher: entry.teacher,
      notes: entry.notes ?? '',
      day: entry.day,
      startTime: entry.startTime,
      endTime: entry.endTime,
      duration: entry.duration,
      color: entry.color,
      category: entry.category
    }))
  ), []);

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
          setPlannerNotice({ message: 'Ogiltig filstruktur.', tone: 'error' });
        }
      } catch (error) {
        setPlannerNotice({ message: 'Kunde inte läsa filen.', tone: 'error' });
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
  }, [commitSchedule, pendingImportData]);

  const saveWeekArchive = useCallback(async (archiveName: string) => {
    try {
      const payload = mapScheduleToPlannerActivities(schedule);
      await plannerService.savePlannerArchive(archiveName, payload);
      setSavedWeekNames(prev => (
        prev.includes(archiveName) ? prev : [...prev, archiveName]
      ));
      setActiveArchiveName(archiveName);
      setWeekName('');
      setPlannerNotice({ message: 'Veckan sparades i arkivet.', tone: 'success' });
    } catch (error) {
      console.error('Archive save failed', error);
      setPlannerNotice({ message: 'Kunde inte spara veckan.', tone: 'error' });
    }
  }, [mapScheduleToPlannerActivities, schedule]);

  const handleSyncToCloud = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const payload = mapScheduleToPlannerActivities(schedule);
      if (activeArchiveName) {
        await plannerService.savePlannerArchive(activeArchiveName, payload);
      } else {
        await plannerService.syncActivities(payload);
      }
      setSaveStatus('saved');
      setPlannerNotice({
        message: activeArchiveName
          ? `"${activeArchiveName}" uppdaterades i arkivet.`
          : 'Schema synkat till molnet.',
        tone: 'success'
      });
    } catch (error) {
      console.error('Cloud sync failed', error);
      setSaveStatus('error');
      setPlannerNotice({ message: 'Kunde inte synka schemat.', tone: 'error' });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [activeArchiveName, mapScheduleToPlannerActivities, schedule]);


  const performAutosave = useCallback(async () => {
    if (loadStatus !== 'loaded') return;
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const payload = mapScheduleToPlannerActivities(schedule);
      if (activeArchiveName) {
        await plannerService.savePlannerArchive(activeArchiveName, payload);
      } else {
        await plannerService.syncActivities(payload);
      }
      setSaveStatus('saved');
    } catch (error) {
      console.error('Autosave failed', error);
      setSaveStatus('error');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        window.setTimeout(() => {
          performAutosave();
        }, 0);
      }
    }
  }, [activeArchiveName, loadStatus, mapScheduleToPlannerActivities, schedule]);

  useEffect(() => {
    if (loadStatus !== 'loaded') return;
    const timeout = window.setTimeout(() => {
      performAutosave();
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [activeArchiveName, loadStatus, performAutosave, schedule]);

  // --- Drag & Drop Logic ---

  const handleDragStart = (event: any) => {
    setActiveDragItem(event.active.data.current);
  };

  const handleSaveWeek = useCallback(async () => {
    const trimmedName = weekName.trim();
    if (!trimmedName) {
      setPlannerNotice({ message: 'Ange ett veckonamn.', tone: 'warning' });
      return;
    }
    if (savedWeekNames.includes(trimmedName)) {
      setOverwriteWeekName(trimmedName);
      return;
    }
    await saveWeekArchive(trimmedName);
  }, [saveWeekArchive, savedWeekNames, weekName]);

  const handleLoadWeek = useCallback(async (name: string) => {
    try {
      const entries = await plannerService.getPlannerArchive(name);
      const mappedSchedule = mapPlannerActivitiesToSchedule(entries);
      commitSchedule(() => mappedSchedule, { clearHistory: true });
      setActiveArchiveName(name);
    } catch (error) {
      console.error('Archive load failed', error);
      setPlannerNotice({ message: 'Kunde inte läsa in veckan.', tone: 'error' });
    }
  }, [commitSchedule, mapPlannerActivitiesToSchedule]);

  const handleDeleteWeek = useCallback(async (name: string) => {
    setDeleteWeekName(name);
  }, []);

  const handleConfirmDeleteWeek = useCallback(async () => {
    if (!deleteWeekName) return;
    try {
      await plannerService.deletePlannerArchive(deleteWeekName);
      setSavedWeekNames(prev => prev.filter(existing => existing !== deleteWeekName));
      setActiveArchiveName(prev => (prev === deleteWeekName ? null : prev));
      setDeleteWeekName(null);
    } catch (error) {
      console.error('Archive delete failed', error);
      setPlannerNotice({ message: 'Kunde inte ta bort veckan.', tone: 'error' });
    }
  }, [deleteWeekName]);

  const handleMobileArchiveStep = useCallback(async (direction: 'prev' | 'next') => {
    if (sortedWeekNames.length === 0) return;
    const delta = direction === 'next' ? 1 : -1;
    const nextIndex = mobileActiveArchiveIndex + delta;
    if (nextIndex < 0 || nextIndex >= sortedWeekNames.length) return;
    await handleLoadWeek(sortedWeekNames[nextIndex]);
  }, [handleLoadWeek, mobileActiveArchiveIndex, sortedWeekNames]);

  const handleDuplicateWeek = useCallback(async (name: string) => {
    const suggestedName = `${name} (kopia)`;
    const duplicateName = window.prompt('Namn på kopian:', suggestedName)?.trim();
    if (!duplicateName) return;
    if (savedWeekNames.includes(duplicateName)) {
      setPlannerNotice({ message: 'Det finns redan en vecka med det namnet.', tone: 'warning' });
      return;
    }

    try {
      const entries = await plannerService.getPlannerArchive(name);
      const duplicatedEntries = entries.map(entry => ({
        ...entry,
        id: uuidv4(),
      }));
      await plannerService.savePlannerArchive(duplicateName, duplicatedEntries);
      setSavedWeekNames(prev => [...prev, duplicateName]);
      setActiveArchiveName(duplicateName);
      setWeekName(duplicateName);
      commitSchedule(() => mapPlannerActivitiesToSchedule(duplicatedEntries), { clearHistory: true });
      setPlannerNotice({ message: `"${name}" duplicerades till "${duplicateName}".`, tone: 'success' });
    } catch (error) {
      console.error('Archive duplication failed', error);
      setPlannerNotice({ message: 'Kunde inte duplicera veckan.', tone: 'error' });
    }
  }, [commitSchedule, mapPlannerActivitiesToSchedule, savedWeekNames]);

  const handleConfirmOverwriteWeek = useCallback(async () => {
    if (!overwriteWeekName) return;
    await saveWeekArchive(overwriteWeekName);
    setOverwriteWeekName(null);
  }, [overwriteWeekName, saveWeekArchive]);

  const handleAddRestrictionRule = useCallback(() => {
    if (!newRule.subjectA || !newRule.subjectB) return;
    setRestrictions(prev => [...prev, { ...newRule, id: uuidv4() }]);
  }, [newRule]);

  const handleRemoveRestrictionRule = useCallback((ruleId: string) => {
    setRestrictions(prev => prev.filter(rule => rule.id !== ruleId));
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

  useEffect(() => {
    if (!contextMenu) return;

    const handleDismiss = () => setContextMenu(null);
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('click', handleDismiss);
    window.addEventListener('contextmenu', handleDismiss);
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('click', handleDismiss);
      window.removeEventListener('contextmenu', handleDismiss);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);
    setGhostPlacement(null);

    if (!over) return;

    const targetDay = over.id as string;
    const type = active.data.current?.type;
    const overRect = over.rect;
    const activeRect = active.rect.current?.translated;

    if (!activeRect || !overRect) return;

    const itemDuration = type === 'course' 
      ? (active.data.current?.course.duration || 60) 
      : active.data.current?.entry.duration;

    const relativeY = activeRect.top - overRect.top;
    let minutesFromStart = relativeY / PIXELS_PER_MINUTE;
    let totalMinutes = (START_HOUR * 60) + minutesFromStart;
    
    // Snap & Constraints
    totalMinutes = snapTime(totalMinutes);
    const minTime = START_HOUR * 60;
    
    // Fix: Dra av duration från maxTime
    const maxTime = (END_HOUR * 60) - itemDuration;
    
    totalMinutes = Math.max(minTime, Math.min(totalMinutes, maxTime));

    const newStartTime = minutesToTime(totalMinutes);
    const endMinutes = totalMinutes + itemDuration;
    const newEndTime = minutesToTime(endMinutes);

    if (type === 'course') {
      const course = active.data.current?.course as PlannerCourse;
      
      const conflict = validateRestrictions(
        { title: course.title, day: targetDay, startTime: newStartTime, endTime: newEndTime },
        schedule,
        restrictions
      );
      if (conflict) { alert(conflict); return; }

      const newEntry: ScheduledEntry = {
        ...course,
        instanceId: uuidv4(),
        day: targetDay,
        startTime: newStartTime,
        endTime: newEndTime,
        duration: itemDuration
      };
      commitSchedule(prev => [...prev, newEntry]);

    } else if (type === 'scheduled') {
      const entry = active.data.current?.entry as ScheduledEntry;

      const conflict = validateRestrictions(
        { title: entry.title, day: targetDay, startTime: newStartTime, endTime: newEndTime, instanceId: entry.instanceId },
        schedule,
        restrictions
      );
      if (conflict) { alert(conflict); return; }

      commitSchedule(prev => prev.map(e => 
        e.instanceId === entry.instanceId 
          ? { ...e, day: targetDay, startTime: newStartTime, endTime: newEndTime } 
          : e
      ));
    }
  };

  const handleDragMove = (event: any) => {
    const { active, over } = event;

    if (!over) {
      setGhostPlacement(null);
      return;
    }

    const targetDay = over.id as string;
    const type = active.data.current?.type;
    const overRect = over.rect;
    const activeRect = active.rect.current?.translated;

    if (!activeRect || !overRect) {
      setGhostPlacement(null);
      return;
    }

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
    const endMinutes = totalMinutes + itemDuration;
    const newEndTime = minutesToTime(endMinutes);

    if (type === 'course') {
      const course = active.data.current?.course as PlannerCourse;
      setGhostPlacement({
        day: targetDay,
        startTime: newStartTime,
        endTime: newEndTime,
        duration: itemDuration,
        color: course.color,
        title: course.title
      });
      return;
    }

    if (type === 'scheduled') {
      const entry = active.data.current?.entry as ScheduledEntry;
      setGhostPlacement({
        day: targetDay,
        startTime: newStartTime,
        endTime: newEndTime,
        duration: itemDuration,
        color: entry.color,
        title: entry.title
      });
    }
  };

  const handleDragCancel = () => {
    setActiveDragItem(null);
    setGhostPlacement(null);
  };

  // --- CRUD Handlers ---

  const handleDeleteCourse = (course: PlannerCourse, isDerived: boolean) => {
     if (isDerived) {
       alert('Automatiska byggstenar kan inte raderas. Redigera för att skapa en manuell kopia.');
       return;
     }
     if(confirm("Ta bort?")) setManualCourses(p => p.filter(c => c.id !== course.id));
  };
  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if(!editingCourse) return;
    setManualCourses(p => {
      const courseKey = buildCourseDedupeKey(editingCourse);
      const isDerived = derivedCourseKeys.has(courseKey) && !manualCourseKeys.has(courseKey);
      const manualId = isDerived ? uuidv4() : editingCourse.id;
      const nextCourse = { ...editingCourse, id: manualId };
      const exists = p.find(c => c.id === manualId);
      return exists ? p.map(c => c.id === manualId ? nextCourse : c) : [...p, nextCourse];
    });
    setIsCourseModalOpen(false);
  };
  
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

  const captureScheduleCanvas = async () => {
    const el = document.getElementById('schedule-canvas');
    if (!el) return null;
    el.classList.add('pdf-export');
    try {
      const maxCanvasSize = 16000;
      const targetWidth = el.scrollWidth;
      const targetHeight = el.scrollHeight;
      const scaleToLimit = Math.min(
        2,
        maxCanvasSize / Math.max(targetWidth, 1),
        maxCanvasSize / Math.max(targetHeight, 1)
      );
      return await html2canvas(el, {
        // Clamp scale to avoid exceeding browser canvas limits on large schedules.
        scale: scaleToLimit,
        width: targetWidth,
        height: targetHeight,
        windowWidth: targetWidth,
        windowHeight: targetHeight
      });
    } finally {
      el.classList.remove('pdf-export');
    }
  };

  const handleExportPDF = async () => {
    const exportElement = document.getElementById('schedule-canvas');
    const maxEndMinutes = schedule.reduce((latestEndMinutes, entry) => {
      const endMinutes = timeToMinutes(entry.endTime);
      return Number.isFinite(endMinutes)
        ? Math.max(latestEndMinutes, endMinutes)
        : latestEndMinutes;
    }, Number.NEGATIVE_INFINITY);

    const clipHeightPx = (() => {
      if (!Number.isFinite(maxEndMinutes)) return undefined;
      const contentHeightPx = (maxEndMinutes - START_HOUR * 60) * PIXELS_PER_MINUTE;
      if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0) return undefined;
      const topOffsetPx = 16; // Mirrors the canvas pt-4 offset.
      const safetyMarginPx = 8;
      return contentHeightPx + topOffsetPx + safetyMarginPx;
    })();

    if (isVectorPdfExportEnabled && exportElement) {
      await exportElementToVectorPdf(exportElement, {
        filename: 'schema.pdf',
        extraClassNames: ['pdf-export'],
        clipHeightPx
      });
      return;
    }
    const canvas = await captureScheduleCanvas();
    if (!canvas) return;
    const pdf = new jsPDF('l', 'pt', 'a4');
    const imageData = canvas.toDataURL('image/png');
    const imgProps = pdf.getImageProperties(imageData);
    const margin = 20;
    const pdfWidth = pdf.internal.pageSize.getWidth() - margin * 2;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    // Fit to the printable width so content cannot clip horizontally in the PDF.
    pdf.addImage(imageData, 'PNG', margin, margin, pdfWidth, pdfHeight);
    pdf.save('schema.pdf');
  };

  const handleExportImage = async (type: 'png' | 'jpeg') => {
    const canvas = await captureScheduleCanvas();
    if (!canvas) return;
    const dataUrl = type === 'png'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.92);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = type === 'png' ? 'schema.png' : 'schema.jpg';
    link.click();
  };

  // --- Render ---

  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={handleDragStart} 
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-6 pb-20">
        
        {/* Toolbar & Filter */}
        <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
           <div>
              <h1
                className="font-monument text-xl select-none"
                onPointerDown={startTitleHold}
                onPointerUp={clearTitleHold}
                onPointerLeave={clearTitleHold}
                onPointerCancel={clearTitleHold}
              >
                FlexSchema <span className="text-xs font-sans font-normal text-gray-500">v5 Timeline</span>
              </h1>
              <p className="text-sm text-gray-600">Dra och släpp på tidslinjen. {saveStatus === 'saving' ? 'Sparar…' : saveStatus === 'saved' ? 'Sparat.' : saveStatus === 'error' ? 'Kunde inte spara (försöker igen vid nästa ändring).' : ''}</p>
           </div>
           
           <div className="flex-1 max-w-md w-full relative">
              <Input 
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter: matte + hanna; -eng..."
                className="border-2 border-black shadow-sm pl-10"
              />
              <div className="absolute left-3 top-2.5 text-gray-400">🔍</div>
           </div>

           <div className="flex gap-2 flex-wrap">
              <Button variant="neutral" onClick={() => setIsRestrictionsModalOpen(true)} className="border-2 border-black bg-amber-100 hover:bg-amber-200"><ShieldAlert size={16} className="mr-2"/> Regler</Button>
              <Button variant="neutral" onClick={handleExportPDF} className="border-2 border-black"><Download size={16} className="mr-2"/> PDF</Button>
              <Button variant="neutral" onClick={() => handleExportImage('png')} className="border-2 border-black">PNG</Button>
              <Button variant="neutral" onClick={() => handleExportImage('jpeg')} className="border-2 border-black">JPG</Button>
              <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportJSON} />
              <Button variant="neutral" onClick={handleExportJSON} className="border-2 border-black bg-blue-100 hover:bg-blue-200"><Download size={16} className="mr-2"/> Spara</Button>
              <Button variant="neutral" onClick={() => fileInputRef.current?.click()} className="border-2 border-black bg-blue-100 hover:bg-blue-200"><Upload size={16} className="mr-2"/> Ladda</Button>
              <Button variant="neutral" onClick={handleSyncToCloud} disabled={isSaving} className="border-2 border-black bg-sky-100 hover:bg-sky-200"><CloudUpload size={16} className="mr-2"/> Synka nu</Button>
              <Button
                variant="neutral"
                onClick={() => {
                  recomputeCourses(schedule, manualCourses);
                  alert('Byggstenar uppdaterade.');
                }}
                className="border-2 border-black bg-emerald-100 hover:bg-emerald-200"
              >
                <RefreshCcw size={16} className="mr-2"/> Uppdatera byggstenar från schema
              </Button>
              <Button variant="neutral" onClick={() => {if(confirm('Rensa?')) commitSchedule(() => [])}} className="border-2 border-black bg-rose-100 text-rose-800"><RefreshCcw size={16} className="mr-2"/> Rensa</Button>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 h-[1100px]">
          
          {/* Sidebar */}
          <div
            className={`flex flex-col gap-4 h-full transition-all duration-300 ${
              isSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[320px]'
            } hidden lg:flex`}
          >
             <div className={`rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] flex-1 overflow-hidden flex flex-col transition-all duration-300 ${
               isSidebarCollapsed ? 'p-2' : 'p-4'
             }`}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className={`font-bold flex items-center gap-2 ${isSidebarCollapsed ? 'sr-only' : ''}`}>
                    <Settings size={18}/> Byggstenar
                  </h2>
                  <div className="flex items-center gap-2">
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
                </div>
                
                {/* Courses List */}
                {!isSidebarCollapsed && (
                  <div className="overflow-y-auto flex-1 pr-2">
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
                )}

                {/* Statistics */}
                {!isSidebarCollapsed && (
                  <div className="mt-4 pt-4 border-t-2 border-gray-100">
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
             <div className="schedule-desktop-header hidden lg:flex pl-[50px] border-b-2 border-black bg-white">
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

             <div className="schedule-mobile-header lg:hidden border-b-2 border-black bg-white">
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

             <div className="flex-1 overflow-y-auto relative" id="schedule-canvas">
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
                   {PLANNER_DAYS.map(day => (
                     <DayColumn key={day} day={day} ghost={ghostPlacement?.day === day ? ghostPlacement : null}>
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
                   </div>

                   <div className="schedule-mobile-grid lg:hidden flex-1 min-w-0">
                     <DayColumn
                       day={mobileSelectedDay}
                       ghost={ghostPlacement?.day === mobileSelectedDay ? ghostPlacement : null}
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
                   </div>
                </div>
             </div>
          </div>

          {/* Archive Sidebar */}
          <div
            className={`flex flex-col gap-4 h-full transition-all duration-300 ${
              isRightSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[320px]'
            } hidden lg:flex`}
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
          className="fixed z-[100] min-w-[140px] rounded border-2 border-black bg-white shadow-lg"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
            onClick={() => {
              setEditingEntry(contextMenu.entry);
              setIsEntryModalOpen(true);
              setContextMenu(null);
            }}
          >
            Redigera
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
            onClick={() => {
              commitSchedule(p => p.filter(e => e.instanceId !== contextMenu.entry.instanceId));
              setContextMenu(null);
            }}
          >
            Radera
          </button>
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
        onSaveCourse={handleSaveCourse}
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
      />

      {plannerNotice && (
        <div className={`fixed bottom-4 right-4 z-[80] rounded-xl border-2 border-black px-4 py-3 text-sm font-semibold shadow-[4px_4px_0px_rgba(0,0,0,1)] ${plannerNotice.tone === 'success' ? 'bg-emerald-100 text-emerald-900' : plannerNotice.tone === 'warning' ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-900'}`}>
          {plannerNotice.message}
        </div>
      )}

    </DndContext>
  );
}
