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
  /**
   * Stegas när schemat i vyn ersatts med något som kommer från servern —
   * arkivbyte, övertaget lås, duplicering. Signalen behövs för att autosparet
   * inte ska skriva tillbaka det som just hämtats.
   */
  serverSyncToken: number;
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

/**
 * Exakt det som skulle skickas till servern, som en jämförbar sträng.
 *
 * Bygger på samma avbildning som sparningen, så två scheman räknas som lika
 * precis när de skulle ge samma payload — varken mer eller mindre.
 */
const scheduleSignature = (entries: ScheduledEntry[]) => (
  JSON.stringify(mapScheduleToPlannerActivities(entries))
);

export const usePlannerSync = ({
  schedule,
  commitSchedule,
  activeArchiveId,
  initialArchiveId,
  isReadOnly,
  serverSyncToken,
  onLockLost,
  showNotice
}: UsePlannerSyncParams) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadStatus, setLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const hasLoadedRef = useRef(false);
  /**
   * Vad servern senast bekräftat. Utan den skrev autosparet om hela schemat en
   * sekund efter varje sidladdning, trots att ingenting ändrats — vilket både
   * kostade rader i databasen och bytte identitet på posterna.
   */
  const lastSavedSignatureRef = useRef<string | null>(null);

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
        const loaded = mapPlannerActivitiesToSchedule(activities);
        commitSchedule(() => loaded, { clearHistory: true });
        lastSavedSignatureRef.current = scheduleSignature(loaded);
        setLoadStatus('loaded');
      } catch (error) {
        console.error('Planner load failed', error);
        showNotice('Kunde inte ladda schemat. Visar huvudschemat istället.', 'warning');
        try {
          const activities = await plannerService.getPlannerActivities();
          const loaded = mapPlannerActivitiesToSchedule(activities);
          commitSchedule(() => loaded, { clearHistory: true });
          lastSavedSignatureRef.current = scheduleSignature(loaded);
          setLoadStatus('loaded');
        } catch (fallbackError) {
          console.error('Planner fallback load failed', fallbackError);
          setLoadStatus('error');
        }
      }
    };

    loadPlannerActivities();
  }, [commitSchedule, initialArchiveId, showNotice]);

  // Schemat kom just från servern och är därmed redan sparat. Utan det här
  // skulle ett arkivbyte skriva tillbaka den nyss hämtade veckan direkt.
  useEffect(() => {
    lastSavedSignatureRef.current = scheduleSignature(schedule);
    // Bara token i beroendelistan med flit: schemat läses som det ser ut i
    // samma rendering som bytet, vilket är precis det servern gav oss. Att
    // lägga till schedule här skulle göra effekten till en kapplöpning med
    // användarens egna ändringar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSyncToken]);

  /**
   * Skriver hela schemat dit det hör hemma. Kastar ArchiveLockedError när
   * någon annan hunnit ta låset.
   */
  const pushSchedule = useCallback(async () => {
    const payload = mapScheduleToPlannerActivities(schedule);
    const signature = JSON.stringify(payload);
    if (activeArchiveId) {
      await plannerService.saveArchiveActivities(activeArchiveId, payload);
      lastSavedSignatureRef.current = signature;
      // Ingen avstämning för scheman. Posternas id är stabila numera, men
      // klienten har redan exakt det som sparades.
      return;
    }
    const response = await plannerService.syncActivities(payload);
    lastSavedSignatureRef.current = signature;
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
    // Ingen skillnad mot det servern redan har. Den vanligaste träffen är
    // sidladdningen: schemat läses in, autosparet vaknar en sekund senare och
    // skulle annars skriva tillbaka precis det som just lästes.
    if (scheduleSignature(schedule) === lastSavedSignatureRef.current) return;
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
  }, [isReadOnly, loadStatus, onLockLost, pushSchedule, schedule, showNotice]);

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
