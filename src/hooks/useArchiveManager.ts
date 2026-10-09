'use client';

import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACTIVE_ARCHIVE_ID_KEY,
  ACTIVE_ARCHIVE_NAME_KEY,
  NEW_SCHEDULE_SOURCE_KEY
} from '@/config/plannerConstants';
import { ArchiveLockedError, plannerService } from '@/services/plannerService';
import { PlannerActivity, PlannerArchiveSummary, ScheduledEntry, ScheduleKind } from '@/types/schedule';
import {
  createScheduleFrom,
  encodeScheduleSource,
  NewScheduleSource,
  resolveWeekSource
} from '@/utils/createSchedule';
import { isBaseSchedule, partitionSchedules, scheduleKindLabel, scheduleKindOf } from '@/utils/scheduleKind';

/**
 * Varför schemat inte går att ändra just nu, eller null när det går.
 * `load-error` räknas fram i planeraren, ur usePlannerSync — se
 * docs/plans/basscheman.md, avsnitt 6.
 */
export type ReadOnlyReason = 'no-schedule' | 'load-error' | 'base' | 'locked' | null;

type UseArchiveManagerParams = {
  commitSchedule: (
    updater: (prev: ScheduledEntry[]) => ScheduledEntry[],
    options?: { clearHistory?: boolean }
  ) => void;
  mapPlannerActivitiesToSchedule: (activities: PlannerActivity[]) => ScheduledEntry[];
  showNotice: (message: string, tone: 'success' | 'error' | 'warning') => void;
  /**
   * usePlannerSync:s saveNow. Sync-hooken behöver det arkivhanteraren räknar
   * fram, så den skapas efteråt och hakas på här genom en ref.
   */
  saveNowRef: MutableRefObject<(() => Promise<boolean>) | null>;
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
  commitSchedule,
  mapPlannerActivitiesToSchedule,
  showNotice,
  saveNowRef
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
  const [deleteArchive, setDeleteArchive] = useState<PlannerArchiveSummary | null>(null);
  /**
   * Sant när det öppna basschemat redigeras. Ett basschema öppnas
   * skrivskyddat och utan lås, och blir det igen så snart ett annat schema
   * öppnas eller sidan laddas om.
   */
  const [isEditingBase, setIsEditingBase] = useState(false);

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

  /** Släpper låset och nollar det i listan. Ett fel stoppar ingenting. */
  const releaseQuietly = useCallback(async (archiveId: string) => {
    try {
      await plannerService.releaseArchiveLock(archiveId);
      setArchives(prev => prev.map(existing => (
        existing.id === archiveId ? { ...existing, lock: null } : existing
      )));
    } catch (error) {
      console.error('Releasing lock failed', error);
    }
  }, []);

  /** Sparar det som inte hunnit sparas. Varnar men stoppar inte om det misslyckas. */
  const saveBeforeSwitching = useCallback(async () => {
    if (!activeArchiveIdRef.current) return;
    const saved = await (saveNowRef.current?.() ?? Promise.resolve(true));
    if (!saved) showNotice('Den senaste ändringen sparades inte.', 'warning');
  }, [saveNowRef, showNotice]);

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
      const resolvedArchive = list.find(archive => archive.id === resolved);
      if (resolvedArchive && isBaseSchedule(resolvedArchive)) {
        // Basen öppnas skrivskyddad och utan lås. Ett eget lås som blivit
        // kvar sedan förra gången skulle annars visa en själv som
        // redigerande för kollegorna.
        if (resolvedArchive.lock?.isMine) await releaseQuietly(resolved);
        return;
      }
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
  /** Varje sort för sig, egna före delade. */
  const { bases: baseArchives, weeks: weekArchives } = useMemo(
    () => partitionSchedules([...ownArchives, ...sharedArchives]),
    [ownArchives, sharedArchives]
  );
  /**
   * I samma ordning som panelen visar dem: basscheman överst. Tangent-
   * navigeringen och korten räknar på platsen i den här listan.
   */
  const sortedArchives = useMemo(
    () => [...baseArchives, ...weekArchives],
    [baseArchives, weekArchives]
  );

  const isActiveBase = Boolean(activeArchive && isBaseSchedule(activeArchive));
  const heldByOther = Boolean(activeArchive?.lock && !activeArchive.lock.isMine);
  const lockHolder = heldByOther ? activeArchive?.lock?.username ?? 'Någon annan' : null;
  /** Ordningen avgör när flera gäller (docs/plans/basscheman.md, avsnitt 6). */
  const readOnlyReason: ReadOnlyReason = activeArchiveId === null
    ? 'no-schedule'
    : isActiveBase && !isEditingBase
      ? 'base'
      : heldByOther
        ? 'locked'
        : null;
  const isReadOnly = readOnlyReason !== null;

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
    return archive;
  }, [commitSchedule, mapPlannerActivitiesToSchedule, upsertArchive]);

  /** Tömmer rutnätet när det öppna schemat försvunnit. Inget sparas någonstans. */
  const closeActiveSchedule = useCallback(() => {
    setActiveArchiveId(null);
    setIsEditingBase(false);
    commitSchedule(() => [], { clearHistory: true });
    setServerSyncToken(token => token + 1);
  }, [commitSchedule]);

  const handleLoadWeek = useCallback(async (archiveId: string) => {
    const previousId = activeArchiveIdRef.current;
    await saveBeforeSwitching();
    try {
      const loaded = await loadArchiveEntries(archiveId);
      setActiveArchiveId(archiveId);
      setIsEditingBase(false);

      if (previousId && previousId !== archiveId) {
        await plannerService.releaseArchiveLock(previousId);
        setArchives(prev => prev.map(existing => (
          existing.id === previousId ? { ...existing, lock: null } : existing
        )));
      }

      // Basen öppnas skrivskyddad och utan lås. Läsningen gav redan låset,
      // så det syns ändå om någon annan redigerar den just nu.
      const target = loaded ?? archives.find(existing => existing.id === archiveId);
      if (target && isBaseSchedule(target)) {
        if (target.lock?.isMine) await releaseQuietly(archiveId);
        return;
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
  }, [archives, loadArchiveEntries, releaseQuietly, saveBeforeSwitching, showNotice, upsertArchive]);

  /**
   * Redigera bas: tar låset och läser om basen, eftersom någon kan ha sparat
   * sedan den öppnades. Har någon annan låset hamnar man i den vanliga
   * låsraden med Ta över.
   */
  const handleEditBase = useCallback(async () => {
    const archiveId = activeArchiveIdRef.current;
    if (!archiveId) return;
    try {
      const result = await plannerService.acquireArchiveLock(archiveId);
      upsertArchive(result.archive);
      if (result.acquired) await loadArchiveEntries(archiveId);
      setIsEditingBase(true);
      if (!result.acquired) {
        showNotice(
          `${result.archive.lock?.username ?? 'Någon annan'} redigerar basschemat. Du kan ta över det.`,
          'warning'
        );
      }
    } catch (error) {
      console.error('Edit base failed', error);
      showNotice('Kunde inte öppna basschemat för redigering.', 'error');
    }
  }, [loadArchiveEntries, showNotice, upsertArchive]);

  /** Klar: sparar, släpper låset och gör basen skrivskyddad igen. */
  const handleFinishEditingBase = useCallback(async () => {
    const archiveId = activeArchiveIdRef.current;
    if (!archiveId) return;
    const saved = await (saveNowRef.current?.() ?? Promise.resolve(true));
    if (!saved) {
      showNotice('Kunde inte spara. Försök igen.', 'error');
      return;
    }
    await releaseQuietly(archiveId);
    setIsEditingBase(false);
  }, [releaseQuietly, saveNowRef, showNotice]);

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

  // --- Skapa, duplicera, radera ---

  const handleDeleteWeek = useCallback((archive: PlannerArchiveSummary) => {
    setDeleteArchive(archive);
  }, []);

  const handleConfirmDeleteWeek = useCallback(async () => {
    if (!deleteArchive) return;
    try {
      await plannerService.deleteArchive(deleteArchive.id);
      setArchives(prev => prev.filter(archive => archive.id !== deleteArchive.id));
      // Förr stod det borttagna schemats poster kvar, och nästa ändring
      // sparades i huvudschemat.
      if (activeArchiveIdRef.current === deleteArchive.id) closeActiveSchedule();
      setDeleteArchive(null);
    } catch (error) {
      console.error('Archive delete failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte ta bort schemat.', 'error');
    }
  }, [closeActiveSchedule, deleteArchive, showNotice]);

  const [newScheduleName, setNewScheduleName] = useState('');
  const [newScheduleSource, setNewScheduleSource] = useState<NewScheduleSource>({ kind: 'empty' });
  /** Sorten på schemat dialogen skapar. */
  const [newScheduleKind, setNewScheduleKind] = useState<ScheduleKind>('week');
  /** Schemat som dupliceras, eller null för Nytt veckoschema och Nytt basschema. */
  const [duplicateOf, setDuplicateOf] = useState<PlannerArchiveSummary | null>(null);
  const [isNewScheduleDialogOpen, setIsNewScheduleDialogOpen] = useState(false);
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  /**
   * Antal poster i det gamla huvudschemat, eller null innan det hämtats.
   * Har det poster kan de göras till ett schema (docs/plans/basscheman.md, 5.2).
   */
  const [legacyMainCount, setLegacyMainCount] = useState<number | null>(null);
  const legacyMainRequestedRef = useRef(false);
  /**
   * Bara Nytt veckoschema minns sitt val. Duplicera förväljer kortet den
   * startades från, och skulle det sparas blev förra veckan förvald nästa gång
   * i stället för basschemat.
   */
  const rememberSourceRef = useRef(false);

  /** Huvudschemat hämtas en gång, första gången en dialog öppnas. */
  const loadLegacyMainCount = useCallback(() => {
    if (legacyMainRequestedRef.current) return;
    legacyMainRequestedRef.current = true;
    plannerService.getPlannerActivities()
      .then(activities => setLegacyMainCount(activities.length))
      .catch(error => {
        console.error('Legacy main schedule load failed', error);
        setLegacyMainCount(0);
      });
  }, []);

  /** Nytt veckoschema förväljer senaste basen, Nytt basschema Tomt schema. */
  const openNewScheduleDialog = useCallback((kind: ScheduleKind = 'week') => {
    if (kind === 'week') {
      const stored = typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(NEW_SCHEDULE_SOURCE_KEY);
      setNewScheduleSource(resolveWeekSource(stored, baseArchives));
    } else {
      setNewScheduleSource({ kind: 'empty' });
    }
    setNewScheduleKind(kind);
    setDuplicateOf(null);
    setNewScheduleName('');
    rememberSourceRef.current = kind === 'week';
    loadLegacyMainCount();
    setIsNewScheduleDialogOpen(true);
  }, [baseArchives, loadLegacyMainCount]);

  /** Duplicera på ett schemakort: samma dialog, med kortet som källa och sort. */
  const handleDuplicateWeek = useCallback((archive: PlannerArchiveSummary) => {
    setNewScheduleSource({ kind: 'archive', id: archive.id });
    setNewScheduleKind(scheduleKindOf(archive));
    setDuplicateOf(archive);
    setNewScheduleName(`${archive.name} (kopia)`);
    rememberSourceRef.current = false;
    setIsNewScheduleDialogOpen(true);
  }, []);

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
    if (isCreatingSchedule) return;

    const source = newScheduleSource;
    const kind = newScheduleKind;
    setIsCreatingSchedule(true);
    try {
      await saveBeforeSwitching();
      // Schemat läggs upp direkt i backend, så namnet finns kvar efter en
      // omladdning även innan den första posten är på plats.
      const result = await createScheduleFrom({
        name: trimmed,
        kind,
        source,
        previousArchiveId: activeArchiveIdRef.current,
        service: plannerService
      });

      upsertArchive(result.archive);
      if (result.releasedArchiveId) {
        setArchives(prev => prev.map(existing => (
          existing.id === result.releasedArchiveId ? { ...existing, lock: null } : existing
        )));
      }
      setActiveArchiveId(result.archive.id);
      // Ett nytt basschema skapas för att fyllas, och låset har man redan
      // (POST /archives tar det). Det öppnas därför i redigeringsläge.
      setIsEditingBase(kind === 'base');
      commitSchedule(() => mapPlannerActivitiesToSchedule(result.activities), { clearHistory: true });
      // Posterna kom från servern och är redan sparade i det nya schemat.
      setServerSyncToken(token => token + 1);

      if (rememberSourceRef.current && source.kind !== 'main' && typeof window !== 'undefined') {
        window.localStorage.setItem(NEW_SCHEDULE_SOURCE_KEY, encodeScheduleSource(source));
      }
      setNewScheduleName('');
      setIsNewScheduleDialogOpen(false);
      showNotice(`Nytt ${scheduleKindLabel(kind)} "${trimmed}" skapat.`, 'success');
    } catch (error) {
      console.error('Archive create failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte skapa schemat.', 'error');
    } finally {
      setIsCreatingSchedule(false);
    }
  }, [
    commitSchedule,
    isCreatingSchedule,
    mapPlannerActivitiesToSchedule,
    newScheduleKind,
    newScheduleName,
    newScheduleSource,
    ownArchiveNames,
    saveBeforeSwitching,
    showNotice,
    upsertArchive
  ]);

  // --- Byta sort ---

  /**
   * Gör om ett schema till basschema eller veckoschema. Är det öppet sparas
   * det först, och öppnas sedan med den nya sortens regler: en ny bas blir
   * skrivskyddad och släpper låset, en ny vecka tar det.
   */
  const handleChangeKind = useCallback(async (archive: PlannerArchiveSummary) => {
    const next: ScheduleKind = isBaseSchedule(archive) ? 'week' : 'base';
    const isOpen = activeArchiveIdRef.current === archive.id;
    if (isOpen) {
      const saved = await (saveNowRef.current?.() ?? Promise.resolve(true));
      if (!saved) {
        showNotice('Kunde inte spara. Försök igen.', 'error');
        return;
      }
    }

    try {
      const updated = await plannerService.setArchiveKind(archive.id, next);
      upsertArchive(updated);
      if (isOpen) {
        setIsEditingBase(false);
        if (next === 'base') {
          if (updated.lock?.isMine) await releaseQuietly(archive.id);
        } else {
          const result = await plannerService.acquireArchiveLock(archive.id);
          upsertArchive(result.archive);
        }
      }
      showNotice(`${archive.name} är nu ett ${scheduleKindLabel(next)}.`, 'success');
    } catch (error) {
      if (error instanceof ArchiveLockedError) {
        showNotice(`${error.holder} har schemat öppet. Sorten går att byta när det är stängt.`, 'warning');
        return;
      }
      console.error('Changing kind failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte byta sort på schemat.', 'error');
    }
  }, [releaseQuietly, saveNowRef, showNotice, upsertArchive]);

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
      if (activeArchiveIdRef.current === archive.id) closeActiveSchedule();
      setShareArchive(null);
      showNotice(`Du lämnade "${archive.name}".`, 'success');
    } catch (error) {
      console.error('Leaving share failed', error);
      showNotice(error instanceof Error ? error.message : 'Kunde inte lämna schemat.', 'error');
    }
  }, [closeActiveSchedule, showNotice]);

  return {
    archives,
    baseArchives,
    weekArchives,
    sortedArchives,
    ownArchiveNames,
    initialArchiveId,
    serverSyncToken,
    activeArchive,
    activeArchiveId,
    activeArchiveName,
    isReadOnly,
    readOnlyReason,
    isEditingBase,
    lockHolder,
    handleEditBase,
    handleFinishEditingBase,
    handleChangeKind,
    handleTakeOverLock,
    markLockLost,
    deleteArchive,
    setDeleteArchive,
    handleLoadWeek,
    handleDeleteWeek,
    handleConfirmDeleteWeek,
    handleDuplicateWeek,
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
    newScheduleSource,
    setNewScheduleSource,
    newScheduleKind,
    duplicateOf,
    legacyMainCount,
    isNewScheduleDialogOpen,
    setIsNewScheduleDialogOpen,
    isCreatingSchedule,
    openNewScheduleDialog,
    handleCreateNewSchedule
  };
};
