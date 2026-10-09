'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PlannerArchiveSummary } from '@/types/schedule';
import { decodeScheduleSource, encodeScheduleSource, NewScheduleSource } from '@/utils/createSchedule';

type NewScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (value: string) => void;
  source: NewScheduleSource;
  onSourceChange: (value: NewScheduleSource) => void;
  ownArchives: PlannerArchiveSummary[];
  sharedArchives: PlannerArchiveSummary[];
  /** Inget schema är öppet. Då går huvudschemat att utgå från. */
  canUseMainSchedule: boolean;
  /** Källan är schemat som är öppet, och dess senaste sparning misslyckades. */
  sourceHasUnsavedChanges: boolean;
  onCreate: () => void;
  isCreating: boolean;
  /** Namnet används redan av ett eget schema. */
  nameExists: boolean;
};

export function NewScheduleDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  source,
  onSourceChange,
  ownArchives,
  sharedArchives,
  canUseMainSchedule,
  sourceHasUnsavedChanges,
  onCreate,
  isCreating,
  nameExists,
}: NewScheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nytt schema</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onCreate(); }} className="space-y-3">
          <div>
            <Label htmlFor="new-schedule-name">Namn</Label>
            <Input
              id="new-schedule-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="t.ex. v.45 eller Höstlov"
              autoFocus
            />
            {nameExists && (
              <p className="text-xs text-rose-600 kron:text-ui-danger mt-1">Det finns redan ett schema med det namnet.</p>
            )}
          </div>
          <div>
            <Label htmlFor="new-schedule-source">Utgå från</Label>
            <select
              id="new-schedule-source"
              value={encodeScheduleSource(source)}
              onChange={(e) => onSourceChange(decodeScheduleSource(e.target.value))}
              className="sp-input h-10 w-full rounded-base border-frame border-ui-line bg-ui-paper px-2 text-sm"
            >
              <option value="empty">Tomt schema</option>
              {canUseMainSchedule && <option value="main">Huvudschemat</option>}
              {ownArchives.length > 0 && (
                <optgroup label="Mina scheman">
                  {ownArchives.map(archive => (
                    <option key={archive.id} value={encodeScheduleSource({ kind: 'archive', id: archive.id })}>
                      {archive.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {sharedArchives.length > 0 && (
                <optgroup label="Delade med mig">
                  {sharedArchives.map(archive => (
                    <option key={archive.id} value={encodeScheduleSource({ kind: 'archive', id: archive.id })}>
                      {archive.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="mt-1 text-xs text-gray-600 kron:text-ui-muted">
              {source.kind === 'empty'
                ? 'Schemat börjar tomt.'
                : 'Posterna kopieras till det nya schemat, som öppnas direkt. Källan ändras inte.'}
            </p>
            {sourceHasUnsavedChanges && (
              <p className="mt-1 text-xs font-bold text-rose-700 kron:text-ui-danger">
                Den senaste ändringen i det öppna schemat sparades inte och kommer inte med i kopian. Vänta tills sparningen gått igenom.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="neutral" type="button" onClick={() => onOpenChange(false)}>Avbryt</Button>
            <Button type="submit" disabled={!name.trim() || nameExists || isCreating}>Skapa</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
