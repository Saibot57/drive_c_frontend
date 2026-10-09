'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { uiTint } from '@/components/ui/tints';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlannerArchiveSummary } from '@/types/schedule';

type ShareArchiveDialogProps = {
  /** Schemat som delas. `null` betyder att rutan är stängd. */
  archive: PlannerArchiveSummary | null;
  onClose: () => void;
  recipient: string;
  onRecipientChange: (value: string) => void;
  onShare: () => void;
  onRemoveShare: (username: string) => void;
  onLeave: (archive: PlannerArchiveSummary, username: string) => void;
  /** Inloggat användarnamn — behövs för att kunna lämna en delning. */
  currentUsername: string | null;
  isSharing: boolean;
};

/** Dela ett schema med andra, se vilka som har tillgång eller lämna det. */
export function ShareArchiveDialog({
  archive,
  onClose,
  recipient,
  onRecipientChange,
  onShare,
  onRemoveShare,
  onLeave,
  currentUsername,
  isSharing,
}: ShareArchiveDialogProps) {
  return (
    <Dialog open={Boolean(archive)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dela &quot;{archive?.name}&quot;</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <form onSubmit={(e) => { e.preventDefault(); onShare(); }} className="space-y-3">
            <div>
              <Label>Användarnamn</Label>
              <Input
                value={recipient}
                onChange={(e) => onRecipientChange(e.target.value)}
                placeholder="t.ex. hanna"
                autoFocus
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-gray-600 kron:text-ui-muted">
              Ni arbetar i <strong>samma</strong> schema. Ändringar syns för alla nästa gång
              de öppnar det. En i taget — den som har schemat öppet håller det låst.
            </p>
            <Button type="submit" className="w-full" disabled={isSharing || !recipient.trim()}>
              {isSharing ? 'Delar…' : 'Ge tillgång'}
            </Button>
          </form>

          {archive && (
            <div className="space-y-2 border-t-frame border-ui-line pt-3">
              <Label className="text-xs font-bold uppercase text-ui-muted">Har tillgång</Label>
              <p className="text-sm">
                {archive.ownerUsername ?? 'Okänd'}
                <span className="text-ui-muted"> — äger schemat</span>
              </p>
              {archive.sharedWith.length === 0 ? (
                <p className="text-sm italic text-ui-muted">Ingen annan än du ännu.</p>
              ) : (
                archive.sharedWith.map((username) => (
                  <div key={username} className="flex items-center justify-between gap-2">
                    <span className="text-sm">{username}</span>
                    {archive.isOwner && (
                      <Button
                        size="sm"
                        variant="neutral"
                        className={`h-7 ${uiTint.danger}`}
                        disabled={isSharing}
                        onClick={() => onRemoveShare(username)}
                      >
                        Ta bort
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {archive && !archive.isOwner && currentUsername && (
            <div className="border-t-frame border-ui-line pt-3">
              <Button
                type="button"
                variant="neutral"
                className={`w-full ${uiTint.danger}`}
                disabled={isSharing}
                onClick={() => onLeave(archive, currentUsername)}
              >
                Lämna schemat
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="neutral" onClick={onClose}>Stäng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
