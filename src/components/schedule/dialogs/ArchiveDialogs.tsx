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
};

/** Dialogerna för sparade scheman: skriv över, radera, dela och skapa nytt. */
export function ArchiveDialogs({ archive, currentUsername }: ArchiveDialogsProps) {
  const { overwriteArchive, deleteArchive } = archive;

  return (
    <>
      <ConfirmDialog
        open={Boolean(overwriteArchive)}
        onOpenChange={(open) => { if (!open) archive.setOverwriteArchive(null); }}
        title="Ersätta befintlig vecka?"
        confirmLabel="Skriv över"
        onConfirm={archive.handleConfirmOverwriteWeek}
      >
        <p className="text-sm text-gray-700">Vecka &quot;{overwriteArchive?.name}&quot; finns redan. Vill du skriva över den?</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deleteArchive)}
        onOpenChange={(open) => { if (!open) archive.setDeleteArchive(null); }}
        title="Radera vecka?"
        confirmLabel="Radera"
        destructive
        onConfirm={archive.handleConfirmDeleteWeek}
      >
        <p className="text-sm text-gray-700">Radera vecka &quot;{deleteArchive?.name}&quot;?</p>
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
        onCreate={archive.handleCreateNewSchedule}
        nameExists={archive.ownArchiveNames.includes(archive.newScheduleName.trim())}
      />
    </>
  );
}
