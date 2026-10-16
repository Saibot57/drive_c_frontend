'use client';

import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { PLANNER_DAYS, AUTOSAVE_DELAY_MS } from '@/config/plannerConstants';
import { generateBoxColor } from '@/config/colorManagement';
import { ArchiveConflictError, ArchiveLockedError, plannerService } from '@/services/plannerService';
import { PlannerActivity, ScheduledEntry } from '@/types/schedule';
import { sanitizeScheduleImport } from '@/utils/scheduleImport';
import { minutesToTime, timeToMinutes } from '@/utils/scheduleTime';

/** Så länge Spara nu väntar på en sparning som redan pågår. */
const SAVE_NOW_TIMEOUT_MS = 15000;

/**
 * Versionen av det öppna schemat som vyn bygger på: den som lästes in, eller
 * den som den här fliken senast sparade. Bara de två får sätta den. En version
 * från något annat svar, som låset eller listan, skulle låta en inaktuell vy
 * spara över det som ändrats sedan den lästes in.
 *
 * Delas med arkivhanteraren, som läser in scheman när de byts.
 */
export type ArchiveBase = { archiveId: string; version: number | null };

/** En sparning nekades för att schemat sparats någon annanstans. */
export type ArchiveConflict = {
  archiveId: string;
  /** Versionen som är sparad nu. */
  serverVersion: number | null;
  message: string;
};

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
  /** Se ArchiveBase. Samma ref som arkivhanteraren skriver i. */
  archiveBaseRef: MutableRefObject<ArchiveBase | null>;
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
      notes: activity.notes ?? undefined,
      laneOrder: activity.laneOrder ?? undefined
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
    category: entry.category,
    laneOrder: entry.laneOrder
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
  archiveBaseRef,
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
  /**
   * Satt när en sparning nekats för att schemat ändrats någon annanstans.
   * Då sparas ingenting förrän användaren valt: ladda om eller skriva över.
   */
  const [conflict, setConflict] = useState<ArchiveConflict | null>(null);
  const conflictRef = useRef<ArchiveConflict | null>(null);

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
        const { archive, activities } = await plannerService.getArchiveActivities(initialArchiveId);
        const loaded = mapPlannerActivitiesToSchedule(activities);
        archiveBaseRef.current = { archiveId: initialArchiveId, version: archive?.version ?? null };
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
  }, [archiveBaseRef, commitSchedule, initialArchiveId, showNotice]);

  // Schemat kom just från servern och är därmed redan sparat. Utan det här
  // skulle ett arkivbyte skriva tillbaka den nyss hämtade veckan direkt.
  useEffect(() => {
    lastSavedSignatureRef.current = scheduleSignature(schedule);
    // Det som lästs in är det som är sparat, så en konflikt är därmed löst.
    conflictRef.current = null;
    setConflict(null);
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
    const base = archiveBaseRef.current;
    // Utan en version för just det här schemat skickas null, och backend
    // nekar hellre än gissar.
    const baseVersion = base?.archiveId === activeArchiveId ? base.version : null;
    const result = await plannerService.saveArchiveActivities(activeArchiveId, payload, baseVersion);
    // Har ett annat schema hunnit läsas in medan sparningen pågick hör
    // versionen inte längre till det som visas, och får inte ersätta dess.
    if (!archiveBaseRef.current || archiveBaseRef.current.archiveId === activeArchiveId) {
      archiveBaseRef.current = { archiveId: activeArchiveId, version: result.archive?.version ?? null };
    }
    // Ingen avstämning. Posternas id är stabila, och klienten har redan
    // exakt det som sparades.
    lastSavedSignatureRef.current = JSON.stringify(payload);
  }, [activeArchiveId, archiveBaseRef, schedule]);

  /** Autosparet tystnar och användaren får välja i dialogen. */
  const enterConflict = useCallback((error: ArchiveConflictError) => {
    if (!activeArchiveId) return;
    const next: ArchiveConflict = {
      archiveId: activeArchiveId,
      serverVersion: error.version,
      message: error.message,
    };
    conflictRef.current = next;
    setConflict(next);
    setSaveStatus('error');
  }, [activeArchiveId]);

  /**
   * Sparar det som inte sparats ännu, direkt i stället för efter autosparets
   * sekund. Anropas före allt som byter schema eller läge: annars försvinner
   * en ändring som görs strax före bytet. Svarar false om sparningen
   * misslyckades.
   */
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (loadStatus !== 'loaded' || isReadOnly || !activeArchiveId) return true;
    // Det som inte får sparas är inte sparat.
    if (conflictRef.current) return false;
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
      if (error instanceof ArchiveConflictError) {
        enterConflict(error);
      } else if (error instanceof ArchiveLockedError) {
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
  }, [activeArchiveId, enterConflict, isReadOnly, loadStatus, onLockLost, pushSchedule, schedule, showNotice]);

  /**
   * Den senaste performAutosave. En sparning som köats medan en annan pågick
   * körs genom den här, så att den ser schemat som det ser ut nu och inte som
   * det såg ut när den första sparningen startade (granskningens F1).
   */
  const performAutosaveRef = useRef<() => Promise<void>>(async () => undefined);

  const performAutosave = useCallback(async () => {
    if (loadStatus !== 'loaded') return;
    if (!activeArchiveId) return;
    if (schedule.length === 0) return;
    // Läsläge: den andres arbete ska inte skrivas över av en autospar härifrån.
    if (isReadOnly) return;
    // Användaren har inte valt än. Det som skrivs under tiden ligger kvar i vyn.
    if (conflictRef.current) return;
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
      if (error instanceof ArchiveConflictError) {
        enterConflict(error);
        return;
      }
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
          void performAutosaveRef.current();
        }, 0);
      }
    }
  }, [activeArchiveId, enterConflict, isReadOnly, loadStatus, onLockLost, pushSchedule, schedule, showNotice]);
  performAutosaveRef.current = performAutosave;

  /**
   * Behåll min version: skriver vyn över det som är sparat. Bygger på den
   * version servern angav i konflikten, så en ännu nyare sparning någon
   * annanstans ger en ny konflikt i stället för att skrivas över.
   */
  const keepMine = useCallback(async (): Promise<boolean> => {
    const current = conflictRef.current;
    if (!current || current.archiveId !== activeArchiveId) return false;
    archiveBaseRef.current = { archiveId: current.archiveId, version: current.serverVersion };
    conflictRef.current = null;
    setConflict(null);
    // Det som är sparat är inte längre det vyn senast sparade, så jämförelsen
    // i saveNow får inte hoppa över sparningen.
    lastSavedSignatureRef.current = null;
    return saveNow();
  }, [activeArchiveId, archiveBaseRef, saveNow]);

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
    saveNow,
    conflict,
    keepMine
  };
};
