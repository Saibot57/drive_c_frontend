'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderPlus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArchiveCard } from '@/components/schedule/ArchiveCard';
import { ArchiveFolder } from '@/components/schedule/ArchiveFolder';
import { ConfirmDialog } from '@/components/schedule/dialogs/ConfirmDialog';
import {
  DeleteFolderMessage,
  FolderContentsDialog,
  RenameFolderDialog
} from '@/components/schedule/dialogs/FolderDialogs';
import { RenameArchiveDialog } from '@/components/schedule/dialogs/RenameArchiveDialog';
import type { useScheduleFolders } from '@/hooks/useScheduleFolders';
import type { ActiveZone } from '@/hooks/useScheduleKeyboardNav';
import type { PlannerArchiveSummary, ScheduleKind } from '@/types/schedule';
import { folderNameOf, ownArchivesIn } from '@/utils/scheduleFolders';
import type { FolderGroup } from '@/utils/scheduleFolders';

/** Rubrikerna Basscheman och Veckoscheman i högerpanelen. */
const scheduleSectionLabel = 'block text-2xs font-bold uppercase text-ui-muted kron:font-mono kron:font-medium kron:tracking-[0.08em]';

type ScheduleArchiveListProps = {
  baseArchives: PlannerArchiveSummary[];
  weekArchives: PlannerArchiveSummary[];
  /** Mapparna i sin helhet. */
  folders: ReturnType<typeof useScheduleFolders>;
  activeArchiveId: string | null;
  activeZone: ActiveZone | null;
  selectedArchiveIndex: number | null;
  onLoad: (archiveId: string) => void;
  onDuplicate: (archive: PlannerArchiveSummary) => void;
  onShare: (archive: PlannerArchiveSummary) => void;
  onDelete: (archive: PlannerArchiveSummary) => void;
  onChangeKind: (archive: PlannerArchiveSummary) => void;
  /** Byter namn på ett eget schema. Sant när det gick. */
  onRename: (archive: PlannerArchiveSummary, name: string) => Promise<boolean>;
  isRenaming: boolean;
  onNewSchedule: (kind: ScheduleKind) => void;
  /** En meny eller mappdialog öppnas eller stängs. Tangentnavigeringen pausas då. */
  onOverlayChange: (open: boolean) => void;
};

type ContentsTarget = { kind: 'create'; selectedIds: string[] } | { kind: 'add'; folder: string } | null;

/**
 * Listan i högerpanelen: basscheman, mapparna och lösa veckoscheman, i den
 * ordningen. Korten får sin plats ur `folders.panelArchives`, som
 * tangentnavigeringen räknar på, så ordningen här måste vara densamma.
 */
export function ScheduleArchiveList({
  baseArchives,
  weekArchives,
  folders,
  activeArchiveId,
  activeZone,
  selectedArchiveIndex,
  onLoad,
  onDuplicate,
  onShare,
  onDelete,
  onChangeKind,
  onRename,
  isRenaming,
  onNewSchedule,
  onOverlayChange
}: ScheduleArchiveListProps) {
  const {
    foldersSupported,
    folderGroups,
    folderNames,
    expandedFolders,
    panelArchives,
    ownWeekArchives,
    isSavingFolders,
    toggleFolder,
    moveArchives,
    renameFolder
  } = folders;

  const [contentsTarget, setContentsTarget] = useState<ContentsTarget>(null);
  const [renameGroup, setRenameGroup] = useState<FolderGroup | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<FolderGroup | null>(null);
  const [renameArchive, setRenameArchive] = useState<PlannerArchiveSummary | null>(null);
  /** Namnet är unikt bland ägarens alla scheman, bas och vecka. */
  const ownArchives = useMemo(
    () => [...baseArchives, ...weekArchives].filter(archive => archive.isOwner),
    [baseArchives, weekArchives]
  );
  const [openMenus, setOpenMenus] = useState(0);

  const handleMenuOpenChange = useCallback((open: boolean) => {
    setOpenMenus(count => Math.max(0, count + (open ? 1 : -1)));
  }, []);

  const overlayOpen = openMenus > 0
    || contentsTarget !== null
    || renameGroup !== null
    || deleteGroup !== null
    || renameArchive !== null;
  useEffect(() => {
    onOverlayChange(overlayOpen);
  }, [onOverlayChange, overlayOpen]);
  // Fälls panelen ihop med en dialog öppen ska navigeringen inte förbli pausad.
  useEffect(() => () => onOverlayChange(false), [onOverlayChange]);

  const handleMoveToFolder = useCallback((archive: PlannerArchiveSummary, folder: string | null) => {
    void moveArchives([archive], folder);
  }, [moveArchives]);

  const handleNewFolderWith = useCallback((archive: PlannerArchiveSummary) => {
    setContentsTarget({ kind: 'create', selectedIds: [archive.id] });
  }, []);

  const handleConfirmDeleteFolder = async () => {
    if (!deleteGroup) return;
    if (await moveArchives(ownArchivesIn(deleteGroup), null)) setDeleteGroup(null);
  };

  const renderCard = (archive: PlannerArchiveSummary) => (
    <ArchiveCard
      key={archive.id}
      archive={archive}
      index={panelArchives.indexOf(archive)}
      isActive={activeArchiveId === archive.id}
      activeZone={activeZone}
      selectedArchiveIndex={selectedArchiveIndex}
      onLoad={onLoad}
      onDuplicate={onDuplicate}
      onShare={onShare}
      onDelete={onDelete}
      onChangeKind={onChangeKind}
      onRename={setRenameArchive}
      folderNames={foldersSupported ? folderNames : null}
      onMoveToFolder={handleMoveToFolder}
      onNewFolderWith={handleNewFolderWith}
      onMenuOpenChange={handleMenuOpenChange}
    />
  );

  return (
    <div className="flex-1 overflow-y-auto pr-1 space-y-2">
      {/* Basscheman överst: de är få och ändras sällan, och under en termins
          veckor skulle de försvinna. */}
      <div className="flex items-center justify-between">
        <Label className={scheduleSectionLabel}>Basscheman</Label>
        <Button
          size="sm"
          variant="neutral"
          onClick={() => onNewSchedule('base')}
          className="h-7 w-7 p-0 sp-btn"
          aria-label="Nytt basschema"
          title="Nytt basschema"
        >
          <Plus size={14} />
        </Button>
      </div>
      {baseArchives.length === 0 ? (
        <p className="text-xs text-ui-muted">
          Inga basscheman ännu. Gör om ett schema med Gör till basschema, eller skapa ett med +.
        </p>
      ) : (
        baseArchives.map(renderCard)
      )}

      <div className="flex items-center justify-between pt-3">
        <Label className={scheduleSectionLabel}>Veckoscheman</Label>
        {foldersSupported && ownWeekArchives.length > 0 && (
          <Button
            size="sm"
            variant="neutral"
            onClick={() => setContentsTarget({ kind: 'create', selectedIds: [] })}
            className="h-7 w-7 p-0 sp-btn"
            aria-label="Ny mapp"
            title="Ny mapp"
          >
            <FolderPlus size={14} />
          </Button>
        )}
      </div>
      {weekArchives.length === 0 ? (
        <p className="text-sm text-ui-muted italic">Inga veckoscheman ännu.</p>
      ) : (
        <>
          {/* Mapparna före de lösa schemana, i namnordning. */}
          {folderGroups.folders.map(group => {
            const ownInGroup = ownArchivesIn(group).length;
            return (
              <ArchiveFolder
                key={group.name}
                group={group}
                isExpanded={expandedFolders.has(group.name)}
                containsActive={group.archives.some(archive => archive.id === activeArchiveId)}
                onToggle={() => toggleFolder(group.name)}
                canAdd={ownWeekArchives.some(archive => folderNameOf(archive) !== group.name)}
                canEdit={ownInGroup > 0}
                onAdd={() => setContentsTarget({ kind: 'add', folder: group.name })}
                onRename={() => setRenameGroup(group)}
                onDelete={() => setDeleteGroup(group)}
                onMenuOpenChange={handleMenuOpenChange}
              >
                {group.archives.map(renderCard)}
              </ArchiveFolder>
            );
          })}
          {folderGroups.loose.map(renderCard)}
        </>
      )}

      <FolderContentsDialog
        target={contentsTarget}
        onClose={() => setContentsTarget(null)}
        ownWeekArchives={ownWeekArchives}
        existingNames={folderNames}
        isSaving={isSavingFolders}
        onSubmit={(folder, archives) => moveArchives(archives, folder)}
      />
      <RenameFolderDialog
        group={renameGroup}
        onClose={() => setRenameGroup(null)}
        existingNames={folderNames}
        isSaving={isSavingFolders}
        onRename={renameFolder}
      />
      <RenameArchiveDialog
        archive={renameArchive}
        onClose={() => setRenameArchive(null)}
        ownArchives={ownArchives}
        isSaving={isRenaming}
        onRename={onRename}
      />
      <ConfirmDialog
        open={deleteGroup !== null}
        onOpenChange={open => { if (!open) setDeleteGroup(null); }}
        title="Ta bort mapp?"
        confirmLabel="Ta bort mapp"
        onConfirm={() => { void handleConfirmDeleteFolder(); }}
      >
        {deleteGroup && <DeleteFolderMessage group={deleteGroup} />}
      </ConfirmDialog>
    </div>
  );
}
