'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SCHEDULE_FOLDERS_EXPANDED_KEY } from '@/config/plannerConstants';
import { plannerService } from '@/services/plannerService';
import type { PlannerArchiveSummary } from '@/types/schedule';
import {
  folderNames,
  foldersSupported,
  groupWeekArchives,
  moveNotice,
  panelOrder,
  renameExpandedFolder,
  sanitizeExpandedFolders
} from '@/utils/scheduleFolders';

type UseScheduleFoldersParams = {
  /** Alla scheman, för att se om backend känner till mappar. */
  archives: PlannerArchiveSummary[];
  baseArchives: PlannerArchiveSummary[];
  weekArchives: PlannerArchiveSummary[];
  /** useArchiveManager:s upsertArchives. Mappen finns bara på schemat i arkivlistan. */
  upsertArchives: (archives: PlannerArchiveSummary[]) => void;
  showNotice: (message: string, tone: 'success' | 'error' | 'warning') => void;
};

/**
 * Mapparna i högerpanelen (docs/plans/schemamappar.md). Vilka mappar som
 * finns och vad de innehåller räknas fram ur schemana. Det enda hooken själv
 * håller är vilka som är utfällda, och det sparas per dator. En mapp som inte
 * står i listan är hopfälld, så en ny mapp börjar hopfälld.
 *
 * Flytt och namnbyte väntar på servern i stället för att visas direkt. Bara
 * ägaren får flytta, och servern kan neka.
 */
export const useScheduleFolders = ({
  archives,
  baseArchives,
  weekArchives,
  upsertArchives,
  showNotice
}: UseScheduleFoldersParams) => {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [isSavingFolders, setIsSavingFolders] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(SCHEDULE_FOLDERS_EXPANDED_KEY);
      if (stored) setExpanded(sanitizeExpandedFolders(JSON.parse(stored)));
    } catch (error) {
      console.warn('Kunde inte läsa vilka schemamappar som är utfällda.', error);
    }
  }, []);

  const persistExpanded = useCallback((next: string[]) => {
    setExpanded(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SCHEDULE_FOLDERS_EXPANDED_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('Kunde inte spara vilka schemamappar som är utfällda.', error);
    }
  }, []);

  const supported = useMemo(() => foldersSupported(archives), [archives]);
  const groups = useMemo(() => groupWeekArchives(weekArchives), [weekArchives]);
  const expandedSet = useMemo(() => new Set(expanded), [expanded]);
  const panelArchives = useMemo(
    () => panelOrder(baseArchives, groups, expandedSet),
    [baseArchives, expandedSet, groups]
  );
  const names = useMemo(() => folderNames(groups), [groups]);
  const ownWeekArchives = useMemo(
    () => weekArchives.filter(archive => archive.isOwner),
    [weekArchives]
  );

  const toggleFolder = useCallback((name: string) => {
    persistExpanded(expanded.includes(name)
      ? expanded.filter(existing => existing !== name)
      : [...expanded, name]);
  }, [expanded, persistExpanded]);

  /** Lägger egna scheman i mappen, eller tar ut dem med null. Svarar om det gick. */
  const moveArchives = useCallback(async (
    toMove: PlannerArchiveSummary[],
    folder: string | null
  ): Promise<boolean> => {
    if (toMove.length === 0) return true;
    setIsSavingFolders(true);
    try {
      upsertArchives(await plannerService.moveArchivesToFolder(toMove.map(archive => archive.id), folder));
      showNotice(moveNotice(toMove, folder), 'success');
      return true;
    } catch (error) {
      console.error('Moving schedules failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte flytta schemat.', 'error');
      return false;
    } finally {
      setIsSavingFolders(false);
    }
  }, [showNotice, upsertArchives]);

  /** Byter namn för de egna schemana i mappen. Svarar om det gick. */
  const renameFolder = useCallback(async (from: string, to: string): Promise<boolean> => {
    setIsSavingFolders(true);
    try {
      upsertArchives(await plannerService.renameFolder(from, to));
      persistExpanded(renameExpandedFolder(expanded, from, to));
      return true;
    } catch (error) {
      console.error('Renaming folder failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte byta namn på mappen.', 'error');
      return false;
    } finally {
      setIsSavingFolders(false);
    }
  }, [expanded, persistExpanded, showNotice, upsertArchives]);

  return {
    foldersSupported: supported,
    folderGroups: groups,
    folderNames: names,
    expandedFolders: expandedSet,
    panelArchives,
    ownWeekArchives,
    isSavingFolders,
    toggleFolder,
    moveArchives,
    renameFolder
  };
};
