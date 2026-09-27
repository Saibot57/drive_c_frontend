'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type NewScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (value: string) => void;
  onCreate: () => void;
  /** Namnet används redan av ett eget schema. */
  nameExists: boolean;
};

export function NewScheduleDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  onCreate,
  nameExists,
}: NewScheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skapa nytt schema</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onCreate(); }} className="space-y-3">
          <div>
            <Label>Namn</Label>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="t.ex. v.45 eller Höstlov"
              autoFocus
            />
            {nameExists && (
              <p className="text-xs text-rose-600 mt-1">Det finns redan ett schema med det namnet.</p>
            )}
          </div>
          <p className="text-sm text-gray-700">
            Det aktiva schemat ersätts med ett tomt schema. Spara det aktiva schemat först om du vill behålla det.
          </p>
          <DialogFooter>
            <Button variant="neutral" type="button" onClick={() => onOpenChange(false)}>Avbryt</Button>
            <Button type="submit" disabled={!name.trim() || nameExists}>Skapa</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
