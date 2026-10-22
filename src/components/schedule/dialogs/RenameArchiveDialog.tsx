'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PlannerArchiveSummary } from '@/types/schedule';
import { checkArchiveRename } from '@/utils/archiveRename';

type RenameArchiveDialogProps = {
  archive: PlannerArchiveSummary | null;
  onClose: () => void;
  /** Ägarens alla scheman, bas och vecka: namnet är unikt bland dem. */
  ownArchives: PlannerArchiveSummary[];
  isSaving: boolean;
  onRename: (archive: PlannerArchiveSummary, name: string) => Promise<boolean>;
};

/** Byt namn på ett eget schema. */
export function RenameArchiveDialog({ archive, onClose, ownArchives, isSaving, onRename }: RenameArchiveDialogProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (archive) setName(archive.name);
  }, [archive]);

  const check = archive ? checkArchiveRename(name, archive, ownArchives) : null;
  const canSubmit = Boolean(check?.name) && !check?.problem && !check?.unchanged && !isSaving;

  const submit = async () => {
    if (!archive || !check || !canSubmit) return;
    if (await onRename(archive, check.name)) onClose();
  };

  return (
    <Dialog open={Boolean(archive)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Byt namn på schemat</DialogTitle>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-3">
          <div>
            <Label htmlFor="archive-rename">Namn</Label>
            <Input
              id="archive-rename"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              autoComplete="off"
            />
            {check?.problem && <p className="mt-1 text-xs text-ui-danger">{check.problem}</p>}
          </div>
          {check?.lostWeek != null && (
            <p className="text-sm text-ui-ink-2">
              Terminsplaneringen föreslår schemat för vecka {check.lostWeek} eftersom namnet säger det.
              Med det nya namnet gör den inte det längre. Veckor där schemat redan är valt påverkas inte.
            </p>
          )}
          {archive && archive.sharedWith.length > 0 && (
            <p className="text-sm text-ui-ink-2">
              Schemat är delat med {archive.sharedWith.join(', ')}. De ser det nya namnet.
            </p>
          )}
          <DialogFooter>
            <Button variant="neutral" type="button" onClick={onClose}>Avbryt</Button>
            <Button type="submit" disabled={!canSubmit}>Spara</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
