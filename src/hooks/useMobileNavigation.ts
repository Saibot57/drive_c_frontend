import { useCallback, useMemo, useState } from 'react';
import { PLANNER_DAYS } from '@/components/schedule/constants';
import { PlannerArchiveSummary } from '@/types/schedule';

interface UseMobileNavigationParams {
  activeArchiveId: string | null;
  /** Egna och delade i den ordning listan visar dem. */
  sortedArchives: PlannerArchiveSummary[];
  handleLoadWeek: (archiveId: string) => Promise<void> | void;
}

export function useMobileNavigation({
  activeArchiveId,
  sortedArchives,
  handleLoadWeek
}: UseMobileNavigationParams) {
  const [mobileActiveDayIndex, setMobileActiveDayIndex] = useState(0);

  const mobileActiveArchiveIndex = useMemo(() => {
    if (sortedArchives.length === 0) return -1;
    if (!activeArchiveId) return 0;
    const foundIndex = sortedArchives.findIndex(archive => archive.id === activeArchiveId);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [activeArchiveId, sortedArchives]);

  const mobileSelectedDay = PLANNER_DAYS[mobileActiveDayIndex] ?? PLANNER_DAYS[0];
  const mobileSelectedArchive = sortedArchives[mobileActiveArchiveIndex] ?? null;
  const mobileSelectedArchiveName = mobileSelectedArchive?.name ?? null;
  const isAtFirstMobileArchive = mobileActiveArchiveIndex <= 0;
  const isAtLastMobileArchive = mobileActiveArchiveIndex < 0 || mobileActiveArchiveIndex >= sortedArchives.length - 1;
  const isAtFirstMobileDay = mobileActiveDayIndex <= 0;
  const isAtLastMobileDay = mobileActiveDayIndex >= PLANNER_DAYS.length - 1;

  const handleMobileArchiveStep = useCallback(async (direction: 'prev' | 'next') => {
    if (sortedArchives.length === 0) return;
    const delta = direction === 'next' ? 1 : -1;
    const nextIndex = mobileActiveArchiveIndex + delta;
    if (nextIndex < 0 || nextIndex >= sortedArchives.length) return;
    await handleLoadWeek(sortedArchives[nextIndex].id);
  }, [handleLoadWeek, mobileActiveArchiveIndex, sortedArchives]);

  return {
    mobileActiveDayIndex,
    setMobileActiveDayIndex,
    mobileActiveArchiveIndex,
    mobileSelectedDay,
    mobileSelectedArchive,
    mobileSelectedArchiveName,
    isAtFirstMobileArchive,
    isAtLastMobileArchive,
    isAtFirstMobileDay,
    isAtLastMobileDay,
    handleMobileArchiveStep
  };
}
