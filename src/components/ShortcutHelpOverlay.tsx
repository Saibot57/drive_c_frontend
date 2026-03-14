'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useHotkeys } from '@/hooks/useHotkeys';
import { SHORTCUT_GROUPS } from '@/config/shortcuts';

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border-2 border-t-border bg-t-page-alt font-mono text-xs shadow-neo-sm">
      {children}
    </kbd>
  );
}

export function ShortcutHelpOverlay() {
  const [open, setOpen] = useState(false);

  useHotkeys(
    [
      {
        key: '?',
        shift: true,
        handler: () => setOpen(true),
      },
    ],
    [],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tangentbordsgenvägar</DialogTitle>
          <DialogDescription>
            Alla tillgängliga genvägar. Tryck <Kbd>Esc</Kbd> för att stänga.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="font-monument text-sm tracking-wide uppercase mb-3 border-b-2 border-t-border pb-1">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-gray-700">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-t-text-muted text-xs">+</span>
                          )}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
