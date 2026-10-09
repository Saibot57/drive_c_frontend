'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PLANNER_DAYS, AUTOSAVE_DELAY_MS } from '@/config/plannerConstants';
import { generateBoxColor } from '@/config/colorManagement';
import { ArchiveLockedError, plannerService } from '@/services/plannerService';
import { PlannerActivity, ScheduledEntry } from '@/types/schedule';
import { sanitizeScheduleImport } from '@/utils/scheduleImport';
import { minutesToTime, timeToMinutes } from '@/utils/scheduleTime';

/** Så länge Spara nu väntar på en sparning som redan pågår. */
const SAVE_NOW_TIMEOUT_MS = 15000;

type UsePlannerSyncParams = {
  schedule: ScheduledEntry[];
  commitSchedule: (
    updater: (prev: ScheduledEntry[]) => ScheduledEntry[],
    options?: { clearHistory?: boolean }
  ) => void;
  /**
   * Öppet schema, eller null när inget är öppet. Då finns inget att spara —
   * huvudschemat, som förr tog emot ändringarna, används inte längre.
   */
  activeArchiveId: string | null;
  /**
   * undefined tills arkivhanteraren avgjort vilket schema sidan öppnar i.
   * Innan dess laddas ingenting.
   */
  initialArchiveId: string | null | undefined;
  /** Sant när schemat inte får ändras härifrån. Då sparas ingenting. */
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

  // Väntar in arkivhanteraren och laddar sedan en gång. Efter det byter
  // handleLoadWeek schema, så den här ska inte köra om.
  useEffect(() => {
    if (initialArchiveId === undefined) return;
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    // Inget schema öppet: rutnätet är tomt, och det finns inget att hämta.
    if (initialArchiveId === null) {
      lastSavedSignatureRef.current = scheduleSignature([]);
      setLoadStatus('loaded');
      return;
    }

    const loadPlannerActivities = async () => {
      try {
        const { activities } = await plannerService.getArchiveActivities(initialArchiveId);
        const loaded = mapPlannerActivitiesToSchedule(activities);
        commitSchedule(() => loaded, { clearHistory: true });
        lastSavedSignatureRef.current = scheduleSignature(loaded);
        setLoadStatus('loaded');
      } catch (error) {
        // Förr visades huvudschemat i stället. Men activeArchiveId stod kvar på
        // schemat som inte gick att läsa, så nästa ändring skrev över det med
        // huvudschemats poster. Nu blir rutnätet tomt och spärrat, och id:t
        // ligger kvar så att nästa laddning försöker igen.
        console.error('Planner load failed', error);
        showNotice('Kunde inte läsa schemat. Ladda om sidan.', 'error');
        setLoadStatus('error');
      }
    };

    loadPlannerActivities();
  }, [commitSchedule, initialArchiveId, showNotice]);

  // Schemat kom just från servern och är därmed redan sparat. Utan det här
  // skulle ett arkivbyte skriva tillbaka den nyss hämtade veckan direkt.
  useEffect(() => {
    lastSavedSignatureRef.current = scheduleSignature(schedule);
    // Ett schema som lästs in från servern efter ett misslyckat första försök
    // gör att sidan går att arbeta i igen. Vid 0 har inget lästs in än.
    if (serverSyncToken > 0) setLoadStatus('loaded');
    // Bara token i beroendelistan med flit: schemat läses som det ser ut i
    // samma rendering som bytet, vilket är precis det servern gav oss. Att
    // lägga till schedule här skulle göra effekten till en kapplöpning med
    // användarens egna ändringar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSyncToken]);

  /**
   * Skriver hela schemat till det öppna schemat. Kastar ArchiveLockedError när
   * någon annan hunnit ta låset.
   */
  const pushSchedule = useCallback(async () => {
    if (!activeArchiveId) return;
    const payload = mapScheduleToPlannerActivities(schedule);
    await plannerService.saveArchiveActivities(activeArchiveId, payload);
    // Ingen avstämning. Posternas id är stabila, och klienten har redan
    // exakt det som sparades.
    lastSavedSignatureRef.current = JSON.stringify(payload);
  }, [activeArchiveId, schedule]);

  /**
   * Sparar det som inte sparats ännu, direkt i stället för efter autosparets
   * sekund. Anropas före allt som byter schema eller läge: annars försvinner
   * en ändring som görs strax före bytet. Svarar false om sparningen
   * misslyckades.
   */
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (loadStatus !== 'loaded' || isReadOnly || !activeArchiveId) return true;
    // En sparning som redan pågår får gå klart. Taket finns för att ett
    // anrop som aldrig svarar inte ska låsa knappen för alltid.
    const waitUntil = Date.now() + SAVE_NOW_TIMEOUT_MS;
    while (isSavingRef.current) {
      if (Date.now() > waitUntil) return false;
      await new Promise(resolve => window.setTimeout(resolve, 50));
    }
    if (scheduleSignature(schedule) === lastSavedSignatureRef.current) return true;

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      await pushSchedule();
      setSaveStatus('saved');
      return true;
    } catch (error) {
      setSaveStatus('error');
      if (error instanceof ArchiveLockedError) {
        onLockLost(error.holder);
        showNotice(error.message, 'warning');
      } else {
        console.error('Save failed', error);
      }
      return false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [activeArchiveId, isReadOnly, loadStatus, onLockLost, pushSchedule, schedule, showNotice]);

  const performAutosave = useCallback(async () => {
    if (loadStatus !== 'loaded') return;
    if (!activeArchiveId) return;
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
  }, [activeArchiveId, isReadOnly, loadStatus, onLockLost, pushSchedule, schedule, showNotice]);

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
    saveNow
  };
};
