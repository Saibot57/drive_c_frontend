import { useCallback, useMemo, useState } from 'react';
import { PLANNER_DAYS } from '@/components/schedule/constants';

interface UseMobileNavigationParams {
  activeArchiveName: string | null;
  sortedWeekNames: string[];
  handleLoadWeek: (weekName: string) => Promise<void> | void;
}

export function useMobileNavigation({
  activeArchiveName,
  sortedWeekNames,
  handleLoadWeek
}: UseMobileNavigationParams) {
  const [mobileActiveDayIndex, setMobileActiveDayIndex] = useState(0);

  const mobileActiveArchiveIndex = useMemo(() => {
    if (sortedWeekNames.length === 0) return -1;
    if (!activeArchiveName) return 0;
    const foundIndex = sortedWeekNames.findIndex(name => name === activeArchiveName);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [activeArchiveName, sortedWeekNames]);

  const mobileSelectedDay = PLANNER_DAYS[mobileActiveDayIndex] ?? PLANNER_DAYS[0];
  const mobileSelectedArchiveName = sortedWeekNames[mobileActiveArchiveIndex] ?? null;
  const isAtFirstMobileArchive = mobileActiveArchiveIndex <= 0;
  const isAtLastMobileArchive = mobileActiveArchiveIndex < 0 || mobileActiveArchiveIndex >= sortedWeekNames.length - 1;
  const isAtFirstMobileDay = mobileActiveDayIndex <= 0;
  const isAtLastMobileDay = mobileActiveDayIndex >= PLANNER_DAYS.length - 1;

  const handleMobileArchiveStep = useCallback(async (direction: 'prev' | 'next') => {
    if (sortedWeekNames.length === 0) return;
    const delta = direction === 'next' ? 1 : -1;
    const nextIndex = mobileActiveArchiveIndex + delta;
    if (nextIndex < 0 || nextIndex >= sortedWeekNames.length) return;
    await handleLoadWeek(sortedWeekNames[nextIndex]);
  }, [handleLoadWeek, mobileActiveArchiveIndex, sortedWeekNames]);

  return {
    mobileActiveDayIndex,
    setMobileActiveDayIndex,
    mobileActiveArchiveIndex,
    mobileSelectedDay,
    mobileSelectedArchiveName,
    isAtFirstMobileArchive,
    isAtLastMobileArchive,
    isAtFirstMobileDay,
    isAtLastMobileDay,
    handleMobileArchiveStep
  };
}
