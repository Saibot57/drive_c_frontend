'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ACTIVE_ARCHIVE_NAME_KEY } from '@/components/schedule/constants';
import { plannerService } from '@/services/plannerService';
import { PlannerActivity, ScheduledEntry } from '@/types/schedule';

type UseArchiveManagerParams = {
  schedule: ScheduledEntry[];
  commitSchedule: (
    updater: (prev: ScheduledEntry[]) => ScheduledEntry[],
    options?: { clearHistory?: boolean }
  ) => void;
  mapPlannerActivitiesToSchedule: (activities: PlannerActivity[]) => ScheduledEntry[];
  mapScheduleToPlannerActivities: (entries: ScheduledEntry[]) => PlannerActivity[];
  showNotice: (message: string, tone: 'success' | 'error' | 'warning') => void;
};

export const useArchiveManager = ({
  schedule,
  commitSchedule,
  mapPlannerActivitiesToSchedule,
  mapScheduleToPlannerActivities,
  showNotice
}: UseArchiveManagerParams) => {
  const [savedWeekNames, setSavedWeekNames] = useState<string[]>([]);
  const [weekName, setWeekName] = useState('');
  const [activeArchiveName, setActiveArchiveName] = useState<string | null>(null);
  const [overwriteWeekName, setOverwriteWeekName] = useState<string | null>(null);
  const [deleteWeekName, setDeleteWeekName] = useState<string | null>(null);
  const isFirstRenderRef = useRef(true);

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

  const saveWeekArchive = useCallback(async (archiveName: string) => {
    try {
      const payload = mapScheduleToPlannerActivities(schedule);
      await plannerService.savePlannerArchive(archiveName, payload);
      setSavedWeekNames(prev => (
        prev.includes(archiveName) ? prev : [...prev, archiveName]
      ));
      setActiveArchiveName(archiveName);
      setWeekName('');
      showNotice('Veckan sparades i arkivet.', 'success');
    } catch (error) {
      console.error('Archive save failed', error);
      showNotice('Kunde inte spara veckan.', 'error');
    }
  }, [mapScheduleToPlannerActivities, schedule, showNotice]);

  const handleSaveWeek = useCallback(async () => {
    const trimmedName = weekName.trim();
    if (!trimmedName) {
      showNotice('Ange ett veckonamn.', 'warning');
      return;
    }
    if (savedWeekNames.includes(trimmedName)) {
      setOverwriteWeekName(trimmedName);
      return;
    }
    await saveWeekArchive(trimmedName);
  }, [saveWeekArchive, savedWeekNames, showNotice, weekName]);

  const handleLoadWeek = useCallback(async (name: string) => {
    try {
      const entries = await plannerService.getPlannerArchive(name);
      const mappedSchedule = mapPlannerActivitiesToSchedule(entries);
      commitSchedule(() => mappedSchedule, { clearHistory: true });
      setActiveArchiveName(name);
    } catch (error) {
      console.error('Archive load failed', error);
      showNotice('Kunde inte läsa in veckan.', 'error');
    }
  }, [commitSchedule, mapPlannerActivitiesToSchedule, showNotice]);

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
      showNotice('Kunde inte ta bort veckan.', 'error');
    }
  }, [deleteWeekName, showNotice]);

  const handleDuplicateWeek = useCallback(async (name: string) => {
    const suggestedName = `${name} (kopia)`;
    const duplicateName = window.prompt('Namn på kopian:', suggestedName)?.trim();
    if (!duplicateName) return;
    if (savedWeekNames.includes(duplicateName)) {
      showNotice('Det finns redan en vecka med det namnet.', 'warning');
      return;
    }

    try {
      const entries = await plannerService.getPlannerArchive(name);
      const duplicatedEntries = entries.map(entry => ({
        ...entry,
        id: uuidv4()
      }));
      await plannerService.savePlannerArchive(duplicateName, duplicatedEntries);
      setSavedWeekNames(prev => [...prev, duplicateName]);
      setActiveArchiveName(duplicateName);
      setWeekName(duplicateName);
      commitSchedule(() => mapPlannerActivitiesToSchedule(duplicatedEntries), { clearHistory: true });
      showNotice(`"${name}" duplicerades till "${duplicateName}".`, 'success');
    } catch (error) {
      console.error('Archive duplication failed', error);
      showNotice('Kunde inte duplicera veckan.', 'error');
    }
  }, [commitSchedule, mapPlannerActivitiesToSchedule, savedWeekNames, showNotice]);

  const handleConfirmOverwriteWeek = useCallback(async () => {
    if (!overwriteWeekName) return;
    await saveWeekArchive(overwriteWeekName);
    setOverwriteWeekName(null);
  }, [overwriteWeekName, saveWeekArchive]);

  return {
    savedWeekNames,
    sortedWeekNames,
    weekName,
    setWeekName,
    activeArchiveName,
    setActiveArchiveName,
    overwriteWeekName,
    setOverwriteWeekName,
    deleteWeekName,
    setDeleteWeekName,
    saveWeekArchive,
    handleSaveWeek,
    handleLoadWeek,
    handleDeleteWeek,
    handleConfirmDeleteWeek,
    handleDuplicateWeek,
    handleConfirmOverwriteWeek
  };
};
