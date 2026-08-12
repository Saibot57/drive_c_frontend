'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ACTIVE_ARCHIVE_ID_KEY, ACTIVE_ARCHIVE_NAME_KEY } from '@/components/schedule/constants';
import { plannerService } from '@/services/plannerService';
import { PlannerActivity, PlannerArchiveSummary, ScheduledEntry } from '@/types/schedule';

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

const weekPattern = /^v\.?\s*(\d+)$/i;

const sortArchives = (archives: PlannerArchiveSummary[]) => {
  const weekNumber = (name: string) => {
    const match = name.match(weekPattern);
    return match ? Number(match[1]) : null;
  };

  return [...archives].sort((a, b) => {
    const weekA = weekNumber(a.name);
    const weekB = weekNumber(b.name);
    if (weekA !== null && weekB !== null) return weekA - weekB;
    return a.name.localeCompare(b.name, 'sv');
  });
};

/**
 * Vilket schema sidan ska öppna i. Den som redan hade ett aktivt schema när
 * delningen infördes har bara namnet sparat, så det växlas mot ett id.
 *
 * Läser men skriver inte. Att städa bort den gamla nyckeln här vore frestande
 * men fel: mellan raderingen och att det nya id:t sparas finns ett glapp, och
 * avbryts sidan där har användarens aktiva schema tappats utan spår. Nyckeln
 * tas därför bort först när id:t ligger på plats.
 */
const resolveStoredArchiveId = (archives: PlannerArchiveSummary[]): string | null => {
  if (typeof window === 'undefined') return null;

  const storedId = window.localStorage.getItem(ACTIVE_ARCHIVE_ID_KEY);
  if (storedId && archives.some(archive => archive.id === storedId)) {
    return storedId;
  }

  const storedName = window.localStorage.getItem(ACTIVE_ARCHIVE_NAME_KEY);
  if (storedName) {
    // Bara bland de egna: ett delat schema med samma namn är någon annans.
    const match = archives.find(archive => archive.isOwner && archive.name === storedName);
    if (match) return match.id;
  }

  return null;
};

export const useArchiveManager = ({
  schedule,
  commitSchedule,
  mapPlannerActivitiesToSchedule,
  mapScheduleToPlannerActivities,
  showNotice
}: UseArchiveManagerParams) => {
  const [archives, setArchives] = useState<PlannerArchiveSummary[]>([]);
  const [activeArchiveId, setActiveArchiveId] = useState<string | null>(null);
  /** undefined tills vi vet vilket schema sidan ska visa. */
  const [initialArchiveId, setInitialArchiveId] = useState<string | null | undefined>(undefined);
  /** Sant när arkivlistan inte gick att hämta. Då lämnas localStorage ifred. */
  const [archiveContextFailed, setArchiveContextFailed] = useState(false);
  /**
   * Räknare som stegas varje gång schemat ersatts med något som kommer från
   * servern. Autosparet lyssnar på den för att veta att det som nu ligger i
   * vyn redan är sparat, och därför inte behöver skrivas tillbaka.
   */
  const [serverSyncToken, setServerSyncToken] = useState(0);
  const [weekName, setWeekName] = useState('');
  const [overwriteArchive, setOverwriteArchive] = useState<PlannerArchiveSummary | null>(null);
  const [deleteArchive, setDeleteArchive] = useState<PlannerArchiveSummary | null>(null);

  // Låset behöver släppas när fliken stängs, och då finns ingen render kvar.
  const activeArchiveIdRef = useRef<string | null>(null);
  activeArchiveIdRef.current = activeArchiveId;

  const upsertArchive = useCallback((archive: PlannerArchiveSummary | undefined) => {
    if (!archive) return;
    setArchives(prev => {
      const index = prev.findIndex(existing => existing.id === archive.id);
      if (index === -1) return [...prev, archive];
      const next = [...prev];
      next[index] = archive;
      return next;
    });
  }, []);

  const refreshArchives = useCallback(async () => {
    try {
      setArchives(await plannerService.listArchives());
    } catch (error) {
      console.error('Archive list load failed', error);
    }
  }, []);

  // --- Uppstart ---

  useEffect(() => {
    const start = async () => {
      let list: PlannerArchiveSummary[] = [];
      try {
        list = await plannerService.listArchives();
        setArchives(list);
      } catch (error) {
        console.error('Archive list load failed', error);
        setArchiveContextFailed(true);
        setInitialArchiveId(null);
        return;
      }

      const resolved = resolveStoredArchiveId(list);
      setActiveArchiveId(resolved);
      setInitialArchiveId(resolved);

      if (!resolved) return;
      try {
        const result = await plannerService.acquireArchiveLock(resolved);
        upsertArchive(result.archive);
        if (!result.acquired) {
          showNotice(
            `${result.archive.lock?.username ?? 'Någon annan'} har schemat öppet. Du kan titta men inte ändra.`,
            'warning'
          );
        }
      } catch (error) {
        console.error('Archive lock failed', error);
      }
    };

    start();
    // Ska bara köras vid montering — resten av flödet styrs av handleLoadWeek.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initialArchiveId === undefined) return;
    // Kunde vi inte hämta listan vet vi inte vad som gäller. Då rörs inte
    // lagringen alls, så nästa laddning får chansen igen.
    if (archiveContextFailed) return;

    if (activeArchiveId) {
      window.localStorage.setItem(ACTIVE_ARCHIVE_ID_KEY, activeArchiveId);
    } else {
      window.localStorage.removeItem(ACTIVE_ARCHIVE_ID_KEY);
    }
    // Först nu har det gamla namnet gjort sitt.
    window.localStorage.removeItem(ACTIVE_ARCHIVE_NAME_KEY);
  }, [activeArchiveId, archiveContextFailed, initialArchiveId]);

  // Stängd flik ska inte lämna schemat låst för arbetslaget.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const release = () => {
      const openArchiveId = activeArchiveIdRef.current;
      if (openArchiveId) {
        plannerService.releaseArchiveLockOnUnload(openArchiveId);
      }
    };
    window.addEventListener('pagehide', release);
    return () => {
      window.removeEventListener('pagehide', release);
      release();
    };
  }, []);

  // --- Härledd vy ---

  const activeArchive = useMemo(
    () => archives.find(archive => archive.id === activeArchiveId) ?? null,
    [activeArchiveId, archives]
  );
  const activeArchiveName = activeArchive?.name ?? null;

  const ownArchives = useMemo(
    () => sortArchives(archives.filter(archive => archive.isOwner)),
    [archives]
  );
  const sharedArchives = useMemo(
    () => sortArchives(archives.filter(archive => !archive.isOwner)),
    [archives]
  );
  const sortedArchives = useMemo(
    () => [...ownArchives, ...sharedArchives],
    [ownArchives, sharedArchives]
  );

  /** Sant när någon annan sitter i schemat. Då går planeraren i läsläge. */
  const isReadOnly = Boolean(activeArchive?.lock && !activeArchive.lock.isMine);
  const lockHolder = isReadOnly ? activeArchive?.lock?.username ?? 'Någon annan' : null;

  const ownArchiveNames = useMemo(
    () => ownArchives.map(archive => archive.name),
    [ownArchives]
  );

  // --- Öppna, låsa, lämna ---

  const loadArchiveEntries = useCallback(async (archiveId: string) => {
    const { archive, activities } = await plannerService.getArchiveActivities(archiveId);
    commitSchedule(() => mapPlannerActivitiesToSchedule(activities), { clearHistory: true });
    setServerSyncToken(token => token + 1);
    upsertArchive(archive);
  }, [commitSchedule, mapPlannerActivitiesToSchedule, upsertArchive]);

  const handleLoadWeek = useCallback(async (archiveId: string) => {
    const previousId = activeArchiveIdRef.current;
    try {
      await loadArchiveEntries(archiveId);
      setActiveArchiveId(archiveId);

      if (previousId && previousId !== archiveId) {
        await plannerService.releaseArchiveLock(previousId);
        setArchives(prev => prev.map(existing => (
          existing.id === previousId ? { ...existing, lock: null } : existing
        )));
      }

      const result = await plannerService.acquireArchiveLock(archiveId);
      upsertArchive(result.archive);
      if (!result.acquired) {
        showNotice(
          `${result.archive.lock?.username ?? 'Någon annan'} har schemat öppet. Du kan titta men inte ändra.`,
          'warning'
        );
      }
    } catch (error) {
      console.error('Archive load failed', error);
      showNotice('Kunde inte läsa in schemat.', 'error');
    }
  }, [loadArchiveEntries, showNotice, upsertArchive]);

  /**
   * Tar över låset från någon annan. Schemat läses om först — den andre kan ha
   * sparat sedan sidan laddades, och då är det hens version som gäller.
   */
  const handleTakeOverLock = useCallback(async () => {
    if (!activeArchiveId) return;
    try {
      const result = await plannerService.acquireArchiveLock(activeArchiveId, { force: true });
      await loadArchiveEntries(activeArchiveId);
      upsertArchive(result.archive);
      showNotice('Du har tagit över schemat och kan ändra igen.', 'success');
    } catch (error) {
      console.error('Lock takeover failed', error);
      showNotice('Kunde inte ta över schemat.', 'error');
    }
  }, [activeArchiveId, loadArchiveEntries, showNotice, upsertArchive]);

  /** Speglar att backend nekade en sparning, så vyn hamnar i läsläge direkt. */
  const markLockLost = useCallback((holder: string) => {
    setArchives(prev => prev.map(archive => (
      archive.id === activeArchiveIdRef.current
        ? { ...archive, lock: { userId: '', username: holder, acquiredAt: null, isMine: false } }
        : archive
    )));
  }, []);

  // --- Spara, skapa, duplicera, radera ---

  const saveIntoArchive = useCallback(async (archive: PlannerArchiveSummary) => {
    const payload = mapScheduleToPlannerActivities(schedule);
    const result = await plannerService.saveArchiveActivities(archive.id, payload);
    upsertArchive(result.archive);
    setActiveArchiveId(archive.id);
    setWeekName('');
    showNotice('Veckan sparades.', 'success');
  }, [mapScheduleToPlannerActivities, schedule, showNotice, upsertArchive]);

  const handleSaveWeek = useCallback(async () => {
    const trimmedName = weekName.trim();
    if (!trimmedName) {
      showNotice('Ange ett veckonamn.', 'warning');
      return;
    }

    const existing = ownArchives.find(archive => archive.name === trimmedName);
    if (existing) {
      setOverwriteArchive(existing);
      return;
    }

    try {
      const created = await plannerService.createArchive(trimmedName);
      upsertArchive(created);
      await saveIntoArchive(created);
    } catch (error) {
      console.error('Archive save failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte spara veckan.', 'error');
    }
  }, [ownArchives, saveIntoArchive, showNotice, upsertArchive, weekName]);

  const handleConfirmOverwriteWeek = useCallback(async () => {
    if (!overwriteArchive) return;
    try {
      await saveIntoArchive(overwriteArchive);
    } catch (error) {
      console.error('Archive overwrite failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte spara veckan.', 'error');
    } finally {
      setOverwriteArchive(null);
    }
  }, [overwriteArchive, saveIntoArchive, showNotice]);

  const handleDeleteWeek = useCallback((archive: PlannerArchiveSummary) => {
    setDeleteArchive(archive);
  }, []);

  const handleConfirmDeleteWeek = useCallback(async () => {
    if (!deleteArchive) return;
    try {
      await plannerService.deleteArchive(deleteArchive.id);
      setArchives(prev => prev.filter(archive => archive.id !== deleteArchive.id));
      setActiveArchiveId(prev => (prev === deleteArchive.id ? null : prev));
      setDeleteArchive(null);
    } catch (error) {
      console.error('Archive delete failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte ta bort veckan.', 'error');
    }
  }, [deleteArchive, showNotice]);

  const handleDuplicateWeek = useCallback(async (archive: PlannerArchiveSummary) => {
    const suggestedName = `${archive.name} (kopia)`;
    const duplicateName = window.prompt('Namn på kopian:', suggestedName)?.trim();
    if (!duplicateName) return;
    if (ownArchiveNames.includes(duplicateName)) {
      showNotice('Det finns redan ett schema med det namnet.', 'warning');
      return;
    }

    try {
      const { activities } = await plannerService.getArchiveActivities(archive.id);
      const duplicatedEntries = activities.map(entry => ({ ...entry, id: uuidv4() }));
      const created = await plannerService.createArchive(duplicateName);
      const result = await plannerService.saveArchiveActivities(created.id, duplicatedEntries);

      upsertArchive(result.archive);
      setActiveArchiveId(created.id);
      setWeekName(duplicateName);
      commitSchedule(() => mapPlannerActivitiesToSchedule(duplicatedEntries), { clearHistory: true });
      setServerSyncToken(token => token + 1);
      showNotice(`"${archive.name}" duplicerades till "${duplicateName}".`, 'success');
    } catch (error) {
      console.error('Archive duplication failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte duplicera veckan.', 'error');
    }
  }, [
    commitSchedule,
    mapPlannerActivitiesToSchedule,
    ownArchiveNames,
    showNotice,
    upsertArchive
  ]);

  const [newScheduleName, setNewScheduleName] = useState('');
  const [isNewScheduleDialogOpen, setIsNewScheduleDialogOpen] = useState(false);

  const handleCreateNewSchedule = useCallback(async () => {
    const trimmed = newScheduleName.trim();
    if (!trimmed) {
      showNotice('Ange ett namn för det nya schemat.', 'warning');
      return;
    }
    if (ownArchiveNames.includes(trimmed)) {
      showNotice('Det finns redan ett schema med det namnet.', 'warning');
      return;
    }

    try {
      // Schemat läggs upp direkt i backend, så namnet finns kvar efter en
      // omladdning även innan den första posten är på plats.
      const created = await plannerService.createArchive(trimmed);
      upsertArchive(created);
      commitSchedule(() => [], { clearHistory: true });
      setActiveArchiveId(created.id);
      setNewScheduleName('');
      setIsNewScheduleDialogOpen(false);
      showNotice(`Nytt schema "${trimmed}" skapat.`, 'success');
    } catch (error) {
      console.error('Archive create failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte skapa schemat.', 'error');
    }
  }, [commitSchedule, newScheduleName, ownArchiveNames, showNotice, upsertArchive]);

  // --- Delning ---

  const [shareArchive, setShareArchive] = useState<PlannerArchiveSummary | null>(null);
  const [shareRecipient, setShareRecipient] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  // Modalens innehåll ska följa med när delningslistan ändras.
  const shareArchiveLive = useMemo(
    () => (shareArchive ? archives.find(a => a.id === shareArchive.id) ?? shareArchive : null),
    [archives, shareArchive]
  );

  const handleShareWeek = useCallback((archive: PlannerArchiveSummary) => {
    setShareRecipient('');
    setShareArchive(archive);
  }, []);

  const handleConfirmShareWeek = useCallback(async () => {
    if (!shareArchiveLive) return;
    const recipient = shareRecipient.trim();
    if (!recipient) {
      showNotice('Ange vem du vill dela med.', 'warning');
      return;
    }

    setIsSharing(true);
    try {
      const updated = await plannerService.addArchiveShare(shareArchiveLive.id, recipient);
      upsertArchive(updated);
      setShareRecipient('');
      showNotice(`${recipient} kan nu arbeta i "${shareArchiveLive.name}".`, 'success');
    } catch (error) {
      console.error('Archive share failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte dela schemat.', 'error');
    } finally {
      setIsSharing(false);
    }
  }, [shareArchiveLive, shareRecipient, showNotice, upsertArchive]);

  const handleRemoveShare = useCallback(async (username: string) => {
    if (!shareArchiveLive) return;
    setIsSharing(true);
    try {
      await plannerService.removeArchiveShare(shareArchiveLive.id, username);
      await refreshArchives();
      showNotice(`${username} har inte längre tillgång.`, 'success');
    } catch (error) {
      console.error('Share removal failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte ta bort delningen.', 'error');
    } finally {
      setIsSharing(false);
    }
  }, [refreshArchives, shareArchiveLive, showNotice]);

  /** Lämnar ett schema någon annan äger. */
  const handleLeaveShare = useCallback(async (archive: PlannerArchiveSummary, username: string) => {
    try {
      await plannerService.removeArchiveShare(archive.id, username);
      setArchives(prev => prev.filter(existing => existing.id !== archive.id));
      setActiveArchiveId(prev => (prev === archive.id ? null : prev));
      setShareArchive(null);
      showNotice(`Du lämnade "${archive.name}".`, 'success');
    } catch (error) {
      console.error('Leaving share failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte lämna schemat.', 'error');
    }
  }, [showNotice]);

  return {
    archives,
    ownArchives,
    sharedArchives,
    sortedArchives,
    ownArchiveNames,
    initialArchiveId,
    serverSyncToken,
    activeArchive,
    activeArchiveId,
    activeArchiveName,
    isReadOnly,
    lockHolder,
    handleTakeOverLock,
    markLockLost,
    weekName,
    setWeekName,
    overwriteArchive,
    setOverwriteArchive,
    deleteArchive,
    setDeleteArchive,
    handleSaveWeek,
    handleLoadWeek,
    handleDeleteWeek,
    handleConfirmDeleteWeek,
    handleDuplicateWeek,
    handleConfirmOverwriteWeek,
    shareArchive: shareArchiveLive,
    setShareArchive,
    shareRecipient,
    setShareRecipient,
    isSharing,
    handleShareWeek,
    handleConfirmShareWeek,
    handleRemoveShare,
    handleLeaveShare,
    newScheduleName,
    setNewScheduleName,
    isNewScheduleDialogOpen,
    setIsNewScheduleDialogOpen,
    handleCreateNewSchedule
  };
};
