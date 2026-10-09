'use client';

import React from 'react';
import type { useArchiveManager } from '@/hooks/useArchiveManager';
import { ConfirmDialog } from './ConfirmDialog';
import { NewScheduleDialog } from './NewScheduleDialog';
import { ShareArchiveDialog } from './ShareArchiveDialog';

type ArchiveDialogsProps = {
  /** Arkivhanteraren i sin helhet. Dialogerna läser det de behöver själva. */
  archive: ReturnType<typeof useArchiveManager>;
  /** Inloggat användarnamn — behövs för att kunna lämna en delning. */
  currentUsername: string | null;
  /** Autosparningen står på fel, så det öppna schemat på servern är inaktuellt. */
  saveFailed: boolean;
};

/** Dialogerna för sparade scheman: ta bort, dela och skapa nytt. */
export function ArchiveDialogs({ archive, currentUsername, saveFailed }: ArchiveDialogsProps) {
  const { deleteArchive, newScheduleSource, activeArchiveId } = archive;
  const sourceIsOpenSchedule = newScheduleSource.kind === 'archive'
    ? newScheduleSource.id === activeArchiveId
    : newScheduleSource.kind === 'main' && activeArchiveId === null;

  return (
    <>
      <ConfirmDialog
        open={Boolean(deleteArchive)}
        onOpenChange={(open) => { if (!open) archive.setDeleteArchive(null); }}
        title="Ta bort schema?"
        confirmLabel="Ta bort"
        destructive
        onConfirm={archive.handleConfirmDeleteWeek}
      >
        <p className="text-sm text-gray-700">Ta bort schemat &quot;{deleteArchive?.name}&quot;?</p>
        {/* Radering av ett delat schema drabbar fler än en. */}
        {deleteArchive && deleteArchive.sharedWith.length > 0 && (
          <p className="text-sm font-bold text-rose-800">
            Schemat är delat med {deleteArchive.sharedWith.join(', ')}. Det försvinner för dem också.
          </p>
        )}
      </ConfirmDialog>

      <ShareArchiveDialog
        archive={archive.shareArchive}
        onClose={() => archive.setShareArchive(null)}
        recipient={archive.shareRecipient}
        onRecipientChange={archive.setShareRecipient}
        onShare={archive.handleConfirmShareWeek}
        onRemoveShare={archive.handleRemoveShare}
        onLeave={archive.handleLeaveShare}
        currentUsername={currentUsername}
        isSharing={archive.isSharing}
      />

      <NewScheduleDialog
        open={archive.isNewScheduleDialogOpen}
        onOpenChange={archive.setIsNewScheduleDialogOpen}
        name={archive.newScheduleName}
        onNameChange={archive.setNewScheduleName}
        source={newScheduleSource}
        onSourceChange={archive.setNewScheduleSource}
        ownArchives={archive.ownArchives}
        sharedArchives={archive.sharedArchives}
        canUseMainSchedule={activeArchiveId === null}
        sourceHasUnsavedChanges={saveFailed && sourceIsOpenSchedule}
        onCreate={archive.handleCreateNewSchedule}
        isCreating={archive.isCreatingSchedule}
        nameExists={archive.ownArchiveNames.includes(archive.newScheduleName.trim())}
      />
    </>
  );
}
