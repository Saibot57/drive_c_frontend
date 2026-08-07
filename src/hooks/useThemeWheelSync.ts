'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ThemeArea, ThemeBlock, ThemeWheel, ThemeWheelSummary } from '@/types/themeWheel';
import { themeWheelService } from '@/services/themeWheelService';
import { isoWeekYear } from '@/utils/dateSv';
import { AUTOSAVE_DELAY_MS } from '@/components/schedule/constants';
import {
  ACTIVE_THEME_WHEEL_KEY,
  DEFAULT_WEEK_COUNT,
  THEME_WHEEL_DRAFT_KEY,
} from '@/components/theme-wheel/constants';

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

  // --- Autosparning av hjulet ---

  useEffect(() => {
    if (loadStatus !== 'loaded' || !wheel.id) return;

    const snapshot = snapshotOf(wheel);
    if (snapshot === syncedWheelRef.current) return;

    const timer = window.setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const saved = await themeWheelService.updateWheel(wheel.id, wheel);
        syncedWheelRef.current = snapshotOf(saved);
        setSaveStatus('saved');
        // Servern kan ha justerat namnet för att undvika en krock.
        if (saved.name !== wheel.name) {
          commit(prev => (prev.id === saved.id ? { ...prev, name: saved.name } : prev));
        }
        setWheels(prev => prev.map(item => (
          item.id === saved.id
            ? { ...item, name: saved.name, weekCount: saved.weekCount, startWeek: saved.startWeek }
            : item
        )));
      } catch (error) {
        console.error('Kunde inte spara temakalendern', error);
        setSaveStatus('error');
        showNotice(
          error instanceof Error ? error.message : 'Kunde inte spara hjulet.',
          'error'
        );
      }
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [commit, loadStatus, showNotice, wheel]);

  // --- Autosparning av biblioteket ---

  useEffect(() => {
    if (loadStatus !== 'loaded') return;

    const snapshot = areasSnapshot(manualAreas);
    if (snapshot === syncedAreasRef.current) return;

    const timer = window.setTimeout(async () => {
      try {
        const saved = await themeWheelService.syncAreas(manualAreas);
        syncedAreasRef.current = areasSnapshot(saved);
      } catch (error) {
        console.error('Kunde inte spara biblioteket', error);
        showNotice(
          error instanceof Error ? error.message : 'Kunde inte spara biblioteket.',
          'error'
        );
      }
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [loadStatus, manualAreas, showNotice]);

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
      const full = await themeWheelService.getWheel(id);
      adopt(full);
      return full;
    });
  }, [adopt, wheel.id, withBusy]);

  const createWheel = useCallback(async (name: string, startWeek: number, startYear: number) => {
    await withBusy(async () => {
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
  }, [adopt, refreshWheels, showNotice, withBusy]);

  /** Lägger en inläst JSON-fil som ett nytt hjul, utan att röra det aktiva. */
  const importWheel = useCallback(async (imported: ThemeWheel) => {
    await withBusy(async () => {
      const created = await themeWheelService.createWheel(imported);
      adopt(created);
      await refreshWheels();
      showNotice(`"${created.name}" importerades.`, 'success');
      return created;
    });
  }, [adopt, refreshWheels, showNotice, withBusy]);

  const duplicateWheel = useCallback(async (
    id: string,
    options: { name?: string; startWeek?: number; startYear?: number }
  ) => {
    await withBusy(async () => {
      const copy = await themeWheelService.duplicateWheel(id, options);
      adopt(copy);
      await refreshWheels();
      showNotice(`"${copy.name}" skapades som kopia.`, 'success');
      return copy;
    });
  }, [adopt, refreshWheels, showNotice, withBusy]);

  const deleteWheel = useCallback(async (id: string) => {
    await withBusy(async () => {
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
  }, [adopt, refreshWheels, showNotice, withBusy]);

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
