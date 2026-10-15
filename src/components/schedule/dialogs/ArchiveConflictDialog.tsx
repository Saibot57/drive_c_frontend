'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ArchiveConflictDialogProps = {
  open: boolean;
  /** Läser in den sparade versionen. Det som gjorts här sedan dess släpps. */
  onReload: () => Promise<unknown>;
  /** Sparar vyn över den sparade versionen. */
  onKeepMine: () => Promise<unknown>;
  /** Laddar ner vyn som JSON, så att inget behöver gå förlorat. */
  onExport: () => void;
};

/**
 * Visas när en sparning nekats för att schemat ändrats någon annanstans: en
 * annan flik, en annan dator eller en kollega som tagit över.
 *
 * Rutan går inte att stänga utan att välja. Autosparet står still tills dess,
 * och det som skrevs under tiden skulle annars se sparat ut men inte vara det.
 */
export function ArchiveConflictDialog({ open, onReload, onKeepMine, onExport }: ArchiveConflictDialogProps) {
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    // onOpenChange ignoreras: Esc och klick utanför ska inte stänga rutan.
    // Krysset, som är DialogContents sista barn, döljs av samma skäl.
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="[&>button:last-child]:hidden">
        <DialogHeader>
          <DialogTitle>Schemat har ändrats någon annanstans</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-gray-700 kron:text-ui-ink-2">
          <p>
            Någon har sparat schemat sedan du öppnade det här, i en annan flik, på en annan dator
            eller en kollega som tagit över. Dina senaste ändringar har inte sparats.
          </p>
          <p>Välj vilken version som ska gälla. Ingenting skrivs över förrän du valt.</p>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="neutral" disabled={busy} onClick={onExport}>
            Exportera mina ändringar
          </Button>
          <Button
            variant="neutral"
            disabled={busy}
            className="bg-[var(--ui-danger-bg)] text-[var(--ui-danger-fg)] hover:bg-[var(--ui-danger-bg-hover)]"
            onClick={() => { void run(onKeepMine); }}
          >
            Behåll min version
          </Button>
          <Button disabled={busy} onClick={() => { void run(onReload); }}>
            Ladda den sparade versionen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
