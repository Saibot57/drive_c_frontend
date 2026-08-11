'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PLANNER_DAYS, AUTOSAVE_DELAY_MS } from '@/components/schedule/constants';
import { generateBoxColor } from '@/config/colorManagement';
import { ArchiveLockedError, plannerService } from '@/services/plannerService';
import { PlannerActivity, ScheduledEntry } from '@/types/schedule';
import { minutesToTime, timeToMinutes } from '@/utils/scheduleTime';

type UsePlannerSyncParams = {
  schedule: ScheduledEntry[];
  commitSchedule: (
    updater: (prev: ScheduledEntry[]) => ScheduledEntry[],
    options?: { clearHistory?: boolean }
  ) => void;
  /** Öppet schema, eller null för huvudschemat. */
  activeArchiveId: string | null;
  /**
   * undefined tills arkivhanteraren avgjort vilket schema sidan öppnar i.
   * Innan dess laddas ingenting — annars hämtas huvudschemat i onödan och
   * skriver över det arkiv som var på väg in.
   */
  initialArchiveId: string | null | undefined;
  /** Sant när någon annan har låset. Då sparas ingenting. */
  isReadOnly: boolean;
  /** Anropas när backend nekade en sparning för att låset bytt ägare. */
  onLockLost: (holder: string) => void;
  showNotice: (message: string, tone: 'success' | 'error' | 'warning') => void;
};

const sanitizeScheduleImport = (importedSchedule: any[]): ScheduledEntry[] => {
  if (!Array.isArray(importedSchedule)) return [];

  return importedSchedule.map(entry => {
    const start = entry.startTime || '08:00';
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

export const mapPlannerActivitiesToSchedule = (activities: PlannerActivity[]) => (
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
);

export const mapScheduleToPlannerActivities = (entries: ScheduledEntry[]): PlannerActivity[] => (
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
);

export const usePlannerSync = ({
  schedule,
  commitSchedule,
  activeArchiveId,
  initialArchiveId,
  isReadOnly,
  onLockLost,
  showNotice
}: UsePlannerSyncParams) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadStatus, setLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const areEntriesEquivalent = useCallback((a: ScheduledEntry, b: ScheduledEntry) => (
    a.instanceId === b.instanceId
    && a.title === b.title
    && (a.teacher ?? '') === (b.teacher ?? '')
    && (a.room ?? '') === (b.room ?? '')
    && (a.notes ?? '') === (b.notes ?? '')
    && (a.category ?? '') === (b.category ?? '')
    && a.color === b.color
    && a.day === b.day
    && a.startTime === b.startTime
    && a.endTime === b.endTime
    && a.duration === b.duration
  ), []);

  const reconcileSyncedActivities = useCallback((activities: PlannerActivity[] | null | undefined) => {
    if (!Array.isArray(activities) || activities.length === 0) return;
    const reconciledSchedule = mapPlannerActivitiesToSchedule(activities);
    const isEquivalent = reconciledSchedule.length === schedule.length
      && reconciledSchedule.every((entry, index) => {
        const current = schedule[index];
        return current ? areEntriesEquivalent(entry, current) : false;
      });
    if (isEquivalent) return;
    commitSchedule(() => reconciledSchedule);
  }, [areEntriesEquivalent, commitSchedule, schedule]);

  // Väntar in arkivhanteraren och laddar sedan en gång. Efter det byter
  // handleLoadWeek schema, så den här ska inte köra om.
  useEffect(() => {
    if (initialArchiveId === undefined) return;
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadPlannerActivities = async () => {
      try {
        const activities = initialArchiveId
          ? (await plannerService.getArchiveActivities(initialArchiveId)).activities
          : await plannerService.getPlannerActivities();
        commitSchedule(() => mapPlannerActivitiesToSchedule(activities), { clearHistory: true });
        setLoadStatus('loaded');
      } catch (error) {
        console.error('Planner load failed', error);
        showNotice('Kunde inte ladda schemat. Visar huvudschemat istället.', 'warning');
        try {
          const activities = await plannerService.getPlannerActivities();
          commitSchedule(() => mapPlannerActivitiesToSchedule(activities), { clearHistory: true });
          setLoadStatus('loaded');
        } catch (fallbackError) {
          console.error('Planner fallback load failed', fallbackError);
          setLoadStatus('error');
        }
      }
    };

    loadPlannerActivities();
  }, [commitSchedule, initialArchiveId, showNotice]);

  /**
   * Skriver hela schemat dit det hör hemma. Kastar ArchiveLockedError när
   * någon annan hunnit ta låset.
   */
  const pushSchedule = useCallback(async () => {
    const payload = mapScheduleToPlannerActivities(schedule);
    if (activeArchiveId) {
      await plannerService.saveArchiveActivities(activeArchiveId, payload);
      // Ingen avstämning för scheman: de får nya id vid varje sparning, så en
      // avstämning skulle byta instanceId under händerna på användaren.
      return;
    }
    const response = await plannerService.syncActivities(payload);
    reconcileSyncedActivities(response.activities);
  }, [activeArchiveId, reconcileSyncedActivities, schedule]);

  const handleSyncToCloud = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      await pushSchedule();
      setSaveStatus('saved');
      showNotice(
        activeArchiveId ? 'Schemat uppdaterades.' : 'Schema synkat till molnet.',
        'success'
      );
    } catch (error) {
      if (error instanceof ArchiveLockedError) {
        setSaveStatus('error');
        onLockLost(error.holder);
        showNotice(error.message, 'warning');
        return;
      }
      console.error('Cloud sync failed', error);
      setSaveStatus('error');
      showNotice('Kunde inte synka schemat.', 'error');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [activeArchiveId, onLockLost, pushSchedule, showNotice]);

  const performAutosave = useCallback(async () => {
    if (loadStatus !== 'loaded') return;
    if (schedule.length === 0) return;
    // Läsläge: den andres arbete ska inte skrivas över av en autospar härifrån.
    if (isReadOnly) return;
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveStatus('saving');

    try {
      await pushSchedule();
      setSaveStatus('saved');
    } catch (error) {
      if (error instanceof ArchiveLockedError) {
        // Någon tog över medan sidan stod öppen. Autosparet tystnar och
        // användaren får veta i stället för att fortsätta skriva i blindo.
        setSaveStatus('error');
        onLockLost(error.holder);
        showNotice(error.message, 'warning');
        return;
      }
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
  }, [isReadOnly, loadStatus, onLockLost, pushSchedule, schedule.length, showNotice]);

  useEffect(() => {
    if (loadStatus !== 'loaded') return;
    const timeout = window.setTimeout(() => {
      performAutosave();
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [activeArchiveId, loadStatus, performAutosave, schedule]);

  return {
    isSaving,
    saveStatus,
    loadStatus,
    handleSyncToCloud
  };
};
