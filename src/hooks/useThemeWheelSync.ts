'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ThemeArea, ThemeBlock, ThemeWheel, ThemeWheelSummary } from '@/types/themeWheel';
import { themeWheelService } from '@/services/themeWheelService';
import { isoWeekYear } from '@/utils/dateSv';
import { createSaveQueue, type SaveQueue, type SaveQueueEvent } from '@/utils/saveQueue';
import { isTransientSaveError } from '@/utils/saveRetry';
import { AUTOSAVE_DELAY_MS } from '@/config/plannerConstants';
import {
  ACTIVE_THEME_WHEEL_KEY,
  DEFAULT_WEEK_COUNT,
  THEME_WHEEL_DRAFT_KEY,
} from '@/config/themeWheelConstants';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';
export type LoadStatus = 'loading' | 'loaded' | 'error';

/**
 * Jämförbar form av ett block. Servern utelämnar tomma fält och sorterar
 * bågarna på veckonummer, medan klienten håller dem i sin egen ordning och
 * kan ha tomma strängar kvar. Utan den här normaliseringen skulle varje
 * sparning se ut som en ny ändring och autospara i oändlighet.
 */
const canonicalBlock = (block: ThemeBlock) => ({
  instanceId: block.instanceId,
  areaId: block.areaId || undefined,
  parentId: block.parentId || undefined,
  title: block.title.trim(),
  color: block.color,
  comment: block.comment?.trim() || undefined,
  startWeek: Math.min(block.startWeek, block.endWeek),
  endWeek: Math.max(block.startWeek, block.endWeek),
  ring: typeof block.ring === 'number' ? block.ring : undefined,
  milestone: block.milestone
    ? {
      label: block.milestone.label.trim(),
      week: block.milestone.week,
      date: block.milestone.date || undefined,
    }
    : undefined,
});

const snapshotOf = (wheel: ThemeWheel): string => JSON.stringify({
  name: wheel.name.trim(),
  startWeek: wheel.startWeek,
  startYear: wheel.startYear,
  weekCount: wheel.weekCount,
  holidayWeeks: [...wheel.holidayWeeks].sort((a, b) => a - b),
  blocks: wheel.blocks
    .map(canonicalBlock)
    .sort((a, b) => a.instanceId.localeCompare(b.instanceId)),
});

const areasSnapshot = (areas: ThemeArea[]): string => JSON.stringify(
  [...areas]
    .map(area => ({
      id: area.id,
      title: area.title.trim(),
      color: area.color,
      comment: area.comment?.trim() || undefined,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
);

const emptyWheel = (): ThemeWheel => {
  const { week, year } = isoWeekYear(new Date());
  return {
    id: '',
    name: 'Nytt tema',
    startWeek: week,
    startYear: year,
    weekCount: DEFAULT_WEEK_COUNT,
    holidayWeeks: [],
    blocks: [],
  };
};

const readLocalDraft = (): ThemeWheel | null => {
  try {
    const raw = window.localStorage.getItem(THEME_WHEEL_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ThemeWheel;
    return parsed && Array.isArray(parsed.blocks) ? parsed : null;
  } catch {
    return null;
  }
};

/** Biblioteket är en enda resurs och har en enda nyckel i sin kö. */
const AREAS_KEY = 'areas';

type UseThemeWheelSyncParams = {
  wheel: ThemeWheel;
  commit: (updater: (prev: ThemeWheel) => ThemeWheel, options?: { clearHistory?: boolean }) => void;
  manualAreas: ThemeArea[];
  setManualAreas: (areas: ThemeArea[]) => void;
  showNotice: (message: string, tone: 'success' | 'error' | 'warning') => void;
};

export const useThemeWheelSync = ({
  wheel,
  commit,
  manualAreas,
  setManualAreas,
  showNotice,
}: UseThemeWheelSyncParams) => {
  const [wheels, setWheels] = useState<ThemeWheelSummary[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [saveStatus, setSaveStatus] = useState<SyncStatus>('idle');
  const [isBusy, setIsBusy] = useState(false);

  // Vad servern senast bekräftat. Autosparningen jämför mot detta i stället
  // för mot föregående render, så att ett inläst hjul inte sparas tillbaka.
  const syncedWheelRef = useRef<string | null>(null);
  const syncedAreasRef = useRef<string | null>(null);
  const activeIdRef = useRef<string>('');
  const wheelRef = useRef(wheel);
  wheelRef.current = wheel;
  // React StrictMode kör effekter två gånger i utvecklingsläge. Utan den här
  // spärren kan båda körningarna se ett tomt konto och skapa var sitt hjul.
  const bootstrapStartedRef = useRef(false);

  const rememberActive = useCallback((id: string) => {
    activeIdRef.current = id;
    try {
      if (id) window.localStorage.setItem(ACTIVE_THEME_WHEEL_KEY, id);
      else window.localStorage.removeItem(ACTIVE_THEME_WHEEL_KEY);
    } catch {
      // Utan lagring får man börja om på förstahjulet nästa gång. Inte kritiskt.
    }
  }, []);

  const adopt = useCallback((next: ThemeWheel) => {
    syncedWheelRef.current = snapshotOf(next);
    rememberActive(next.id);
    commit(() => next, { clearHistory: true });
  }, [commit, rememberActive]);

  const refreshWheels = useCallback(async () => {
    const list = await themeWheelService.listWheels();
    setWheels(list);
    return list;
  }, []);

  // --- Första inläsningen ---

  useEffect(() => {
    if (bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;

    const load = async () => {
      try {
        const [list, areas] = await Promise.all([
          themeWheelService.listWheels(),
          themeWheelService.listAreas(),
        ]);

        setWheels(list);
        setManualAreas(areas);
        syncedAreasRef.current = areasSnapshot(areas);

        if (list.length > 0) {
          const storedId = window.localStorage.getItem(ACTIVE_THEME_WHEEL_KEY);
          const target = list.find(item => item.id === storedId) ?? list[0];
          const full = await themeWheelService.getWheel(target.id);
          adopt(full);
          setLoadStatus('loaded');
          return;
        }

        // Inget i molnet ännu. Ett lokalt utkast från innan synken fanns
        // flyttas upp en gång, annars börjar vi på ett tomt hjul.
        const draft = readLocalDraft();
        const created = await themeWheelService.createWheel(draft ?? emptyWheel());
        if (draft) {
          window.localStorage.removeItem(THEME_WHEEL_DRAFT_KEY);
          showNotice('Ditt lokala hjul flyttades till molnet.', 'success');
        }
        adopt(created);
        setWheels(await themeWheelService.listWheels());
        setLoadStatus('loaded');
      } catch (error) {
        console.error('Kunde inte läsa temakalendern', error);
        showNotice(
          error instanceof Error ? error.message : 'Kunde inte läsa temakalendern.',
          'error'
        );
        setLoadStatus('error');
      }
    };

    load();
    // Körs en gång; adopt och setManualAreas är stabila.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Autosparning ---
  //
  // Hjulen och biblioteket sparas genom var sin kö (utils/saveQueue.ts). Kön
  // håller det senaste värdet och har högst ett anrop i flykt per hjul. Förr
  // var autosparet en timer i effekten nedan, och effektens cleanup kastade
  // ändringen vid hjulbyte och när sidan lämnades (dataintegritet F8). Två
  // sparningar av samma hjul kunde dessutom vara i flykt samtidigt, och den
  // som landade sist på servern vann (F12).

  // Köernas händelser behöver det senaste av commit och showNotice.
  const onWheelEventRef = useRef<(event: SaveQueueEvent<ThemeWheel>) => void>(() => undefined);
  const onAreasEventRef = useRef<(event: SaveQueueEvent<ThemeArea[]>) => void>(() => undefined);

  const wheelQueueRef = useRef<SaveQueue<ThemeWheel, ThemeWheel>>();
  wheelQueueRef.current ??= createSaveQueue<ThemeWheel, ThemeWheel>({
    delayMs: AUTOSAVE_DELAY_MS,
    save: (id, next, { keepalive }) => themeWheelService.updateWheel(id, next, { keepalive }),
    onEvent: event => onWheelEventRef.current(event),
  });
  const wheelQueue = wheelQueueRef.current;

  const areaQueueRef = useRef<SaveQueue<ThemeArea[], ThemeArea[]>>();
  areaQueueRef.current ??= createSaveQueue<ThemeArea[], ThemeArea[]>({
    delayMs: AUTOSAVE_DELAY_MS,
    save: (_key, areas, { keepalive }) => themeWheelService.syncAreas(areas, { keepalive }),
    onEvent: event => onAreasEventRef.current(event),
  });
  const areaQueue = areaQueueRef.current;

  onWheelEventRef.current = ({ key, status, error, saved }) => {
    if (status === 'saving') {
      setSaveStatus('saving');
      return;
    }
    if (status === 'error') {
      console.error('Kunde inte spara temakalendern', error);
      setSaveStatus('error');
      showNotice(error instanceof Error ? error.message : 'Kunde inte spara hjulet.', 'error');
      return;
    }
    if (!saved) return;
    setWheels(prev => prev.map(item => (
      item.id === saved.id
        ? { ...item, name: saved.name, weekCount: saved.weekCount, startWeek: saved.startWeek }
        : item
    )));
    // Väntar något nyare för hjulet är svaret redan inaktuellt. Och är ett
    // annat hjul öppet nu gäller jämförelsen det hjulet, inte det här.
    if (status !== 'saved' || key !== activeIdRef.current) return;
    syncedWheelRef.current = snapshotOf(saved);
    // Servern kan ha justerat namnet för att undvika en krock.
    if (saved.name !== wheelRef.current.name) {
      commit(prev => (prev.id === saved.id ? { ...prev, name: saved.name } : prev));
    }
    if (!wheelQueue.hasUnsaved()) setSaveStatus('saved');
  };

  onAreasEventRef.current = ({ status, error, saved }) => {
    if (status === 'error') {
      console.error('Kunde inte spara biblioteket', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte spara biblioteket.', 'error');
      return;
    }
    if (status === 'saved' && saved) syncedAreasRef.current = areasSnapshot(saved);
  };

  useEffect(() => {
    if (loadStatus !== 'loaded' || !wheel.id) return;
    // Väntar något eller är något i flykt får kön alltid det senaste, även
    // när det är lika med det som senast sparades: en ångring tillbaka medan
    // en sparning är i flykt måste också skickas.
    if (wheelQueue.isIdle(wheel.id) && snapshotOf(wheel) === syncedWheelRef.current) return;
    wheelQueue.schedule(wheel.id, wheel);
  }, [loadStatus, wheel, wheelQueue]);

  useEffect(() => {
    if (loadStatus !== 'loaded') return;
    if (areaQueue.isIdle(AREAS_KEY) && areasSnapshot(manualAreas) === syncedAreasRef.current) return;
    areaQueue.schedule(AREAS_KEY, manualAreas);
  }, [areaQueue, loadStatus, manualAreas]);

  // Det som väntar skickas när sidan lämnas. Vid sidbyte inom appen
  // avmonteras hooken. På iPad och mobiler kommer pagehide ofta inte alls när
  // fliken stängs eller appen byts, så en dold flik sparar också.
  useEffect(() => {
    const flushAll = (options: { keepalive: boolean; immediate?: boolean }) => {
      void wheelQueue.flushAll(options);
      void areaQueue.flushAll(options);
    };
    const onPageHide = () => flushAll({ keepalive: true, immediate: true });
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushAll({ keepalive: true });
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (wheelQueue.hasUnsaved() || areaQueue.hasUnsaved()) event.preventDefault();
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      flushAll({ keepalive: true });
      wheelQueue.dispose();
      areaQueue.dispose();
    };
  }, [areaQueue, wheelQueue]);

  /**
   * Sparar det öppna hjulet innan ett annat öppnas. Svarar false när bytet
   * ska stoppas: ett nätfel eller 5xx kan gå över, och ett byte skulle kasta
   * ändringen. Ett fel som inte går över (400, 409) får inte låsa fast
   * användaren i hjulet. Notisen har redan visats, och ändringen släpps.
   */
  const saveBeforeSwitching = useCallback(async (): Promise<boolean> => {
    const id = activeIdRef.current;
    if (!id) return true;
    const result = await wheelQueue.flush(id);
    if (result.ok) return true;
    if (isTransientSaveError(result.error)) {
      showNotice('Ändringen i hjulet kunde inte sparas, så hjulet byttes inte. Försök igen.', 'error');
      return false;
    }
    wheelQueue.forget(id);
    setSaveStatus('idle');
    return true;
  }, [showNotice, wheelQueue]);

  // --- Åtgärder ---

  const withBusy = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    setIsBusy(true);
    try {
      return await action();
    } catch (error) {
      console.error(error);
      showNotice(error instanceof Error ? error.message : 'Något gick fel.', 'error');
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [showNotice]);

  const selectWheel = useCallback(async (id: string) => {
    if (id === wheel.id) return;
    await withBusy(async () => {
      if (!(await saveBeforeSwitching())) return null;
      const full = await themeWheelService.getWheel(id);
      adopt(full);
      return full;
    });
  }, [adopt, saveBeforeSwitching, wheel.id, withBusy]);

  const createWheel = useCallback(async (name: string, startWeek: number, startYear: number) => {
    await withBusy(async () => {
      if (!(await saveBeforeSwitching())) return null;
      const created = await themeWheelService.createWheel({
        ...emptyWheel(),
        name,
        startWeek,
        startYear,
      });
      adopt(created);
      await refreshWheels();
      showNotice(`"${created.name}" skapades.`, 'success');
      return created;
    });
  }, [adopt, refreshWheels, saveBeforeSwitching, showNotice, withBusy]);

  /** Lägger en inläst JSON-fil som ett nytt hjul, utan att röra det aktiva. */
  const importWheel = useCallback(async (imported: ThemeWheel) => {
    await withBusy(async () => {
      if (!(await saveBeforeSwitching())) return null;
      const created = await themeWheelService.createWheel(imported);
      adopt(created);
      await refreshWheels();
      showNotice(`"${created.name}" importerades.`, 'success');
      return created;
    });
  }, [adopt, refreshWheels, saveBeforeSwitching, showNotice, withBusy]);

  const duplicateWheel = useCallback(async (
    id: string,
    options: { name?: string; startWeek?: number; startYear?: number }
  ) => {
    await withBusy(async () => {
      // Kopian görs på servern, så en ändring som väntar måste dit först.
      if (!(await saveBeforeSwitching())) return null;
      const copy = await themeWheelService.duplicateWheel(id, options);
      adopt(copy);
      await refreshWheels();
      showNotice(`"${copy.name}" skapades som kopia.`, 'success');
      return copy;
    });
  }, [adopt, refreshWheels, saveBeforeSwitching, showNotice, withBusy]);

  const deleteWheel = useCallback(async (id: string) => {
    await withBusy(async () => {
      // Det som väntar för hjulet skulle annars skickas till ett id som inte finns.
      wheelQueue.forget(id);
      await themeWheelService.deleteWheel(id);
      const list = await refreshWheels();
      // Raderades det aktiva hjulet måste något annat väljas, annars sparar
      // autosparningen mot ett id som inte längre finns.
      if (id === activeIdRef.current) {
        if (list.length > 0) {
          adopt(await themeWheelService.getWheel(list[0].id));
        } else {
          const created = await themeWheelService.createWheel(emptyWheel());
          adopt(created);
          await refreshWheels();
        }
      }
      showNotice('Hjulet togs bort.', 'success');
      return true;
    });
  }, [adopt, refreshWheels, showNotice, wheelQueue, withBusy]);

  const shareWheel = useCallback(async (id: string, toUsername: string) => {
    const result = await withBusy(() => themeWheelService.shareWheel(id, toUsername));
    if (result) {
      showNotice(`"${result.name}" delades med ${result.recipient}.`, 'success');
    }
    return Boolean(result);
  }, [showNotice, withBusy]);

  return {
    wheels,
    loadStatus,
    saveStatus,
    isBusy,
    selectWheel,
    createWheel,
    importWheel,
    duplicateWheel,
    deleteWheel,
    shareWheel,
    refreshWheels,
  };
};
