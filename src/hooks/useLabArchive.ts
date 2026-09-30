'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { plannerService } from '@/services/plannerService';
import type { PlannerActivity, PlannerArchiveSummary } from '@/types/schedule';
import type { LabState } from '@/types/lessonLab';
import { busyFromArchive, FixedHours, fixedHoursByTeacher, unknownTeacherNames } from '@/utils/lessonLabArchive';
import { withRetry } from '@/utils/withRetry';

/**
 * Schemaplanerarens arkiv för Arbetslag: listan att välja ur, och passen i
 * det valda arkivet. Passen läses om varje gång sidan öppnas, så att en
 * ändrad mattelektion syns direkt i timräknaren.
 */

export type ArchiveStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useLabArchive(state: LabState, loaded: boolean) {
  const archiveId = state.archiveId ?? null;
  const [archives, setArchives] = useState<PlannerArchiveSummary[] | null>(null);
  const [activities, setActivities] = useState<PlannerActivity[] | null>(null);
  const [status, setStatus] = useState<ArchiveStatus>('idle');
  // Arkivet vars pass ligger i `activities`, så att ett nyss valt arkiv inte hämtas två gånger.
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    withRetry(() => plannerService.listArchives())
      .then(setArchives)
      .catch(error => {
        console.error('Arbetslag: kunde inte hämta arkiven', error);
        setArchives([]);
      });
  }, []);

  /** Hämtar ett arkivs pass. Används både vid val av arkiv och vid "Läs om". */
  const fetchActivities = useCallback(async (id: string) => {
    setStatus('loading');
    try {
      const result = await withRetry(() => plannerService.getArchiveActivities(id));
      fetchedFor.current = id;
      setActivities(result.activities);
      setStatus('ready');
      return result.activities;
    } catch (error) {
      console.error('Arbetslag: kunde inte hämta arkivet', error);
      setStatus('error');
      return null;
    }
  }, []);

  // Det sparade arkivet läses när labbets läge har lästs in.
  useEffect(() => {
    if (!loaded) return;
    if (!archiveId) {
      fetchedFor.current = null;
      setActivities(null);
      setStatus('idle');
      return;
    }
    if (fetchedFor.current === archiveId) return;
    void fetchActivities(archiveId);
  }, [loaded, archiveId, fetchActivities]);

  const fixed = useMemo(
    () => (activities ? fixedHoursByTeacher(activities, state.teachers, state.classes) : new Map<string, FixedHours>()),
    [activities, state.teachers, state.classes]
  );
  const busy = useMemo(
    () => (activities ? busyFromArchive(activities, state.teachers, state.classes) : undefined),
    [activities, state.teachers, state.classes]
  );
  const unknownNames = useMemo(
    () => (activities ? unknownTeacherNames(activities, state.teachers) : []),
    [activities, state.teachers]
  );
  const archiveName = archives?.find(a => a.id === archiveId)?.name ?? null;

  return { archives, archiveName, activities, status, fetchActivities, fixed, busy, unknownNames };
}
