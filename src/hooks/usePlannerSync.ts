'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PLANNER_DAYS, AUTOSAVE_DELAY_MS, ACTIVE_ARCHIVE_NAME_KEY } from '@/components/schedule/constants';
import { generateBoxColor } from '@/config/colorManagement';
import { plannerService } from '@/services/plannerService';
import { PlannerActivity, ScheduledEntry } from '@/types/schedule';
import { minutesToTime, timeToMinutes } from '@/utils/scheduleTime';

type UsePlannerSyncParams = {
  schedule: ScheduledEntry[];
  commitSchedule: (
    updater: (prev: ScheduledEntry[]) => ScheduledEntry[],
    options?: { clearHistory?: boolean }
  ) => void;
  activeArchiveName: string | null;
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
  activeArchiveName,
  showNotice
}: UsePlannerSyncParams) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadStatus, setLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [loadedArchiveName, setLoadedArchiveName] = useState<string | null>(null);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);

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
          setLoadedArchiveName(storedArchiveName);
        }
        setLoadStatus('loaded');
      } catch (error) {
        console.error('Planner load failed', error);
        window.localStorage.removeItem(ACTIVE_ARCHIVE_NAME_KEY);
        setLoadStatus('error');
      }
    };

    loadPlannerActivities();
  }, [commitSchedule]);

  const handleSyncToCloud = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const payload = mapScheduleToPlannerActivities(schedule);
      let syncedActivities: PlannerActivity[] = [];
      if (activeArchiveName) {
        syncedActivities = await plannerService.savePlannerArchive(activeArchiveName, payload);
      } else {
        const response = await plannerService.syncActivities(payload);
        syncedActivities = response.activities;
      }
      reconcileSyncedActivities(syncedActivities);
      setSaveStatus('saved');
      showNotice(
        activeArchiveName
          ? `"${activeArchiveName}" uppdaterades i arkivet.`
          : 'Schema synkat till molnet.',
        'success'
      );
    } catch (error) {
      console.error('Cloud sync failed', error);
      setSaveStatus('error');
      showNotice('Kunde inte synka schemat.', 'error');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [activeArchiveName, reconcileSyncedActivities, schedule, showNotice]);

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
      let syncedActivities: PlannerActivity[] = [];
      if (activeArchiveName) {
        syncedActivities = await plannerService.savePlannerArchive(activeArchiveName, payload);
      } else {
        const response = await plannerService.syncActivities(payload);
        syncedActivities = response.activities;
      }
      reconcileSyncedActivities(syncedActivities);
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
  }, [activeArchiveName, loadStatus, reconcileSyncedActivities, schedule]);

  useEffect(() => {
    if (loadStatus !== 'loaded') return;
    const timeout = window.setTimeout(() => {
      performAutosave();
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [activeArchiveName, loadStatus, performAutosave, schedule]);

  return {
    isSaving,
    saveStatus,
    loadStatus,
    loadedArchiveName,
    handleSyncToCloud
  };
};
