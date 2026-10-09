'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Frågan och det användaren behöver veta innan hen bekräftar. */
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  /** Rosa knapp, för det som inte går att ta tillbaka. */
  destructive?: boolean;
  /** Vad Avbryt gör. Utelämnad stänger den bara rutan. */
  onCancel?: () => void;
};

/** "Är du säker?" – samma ruta för alla bekräftelser i planeraren. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  onConfirm,
  destructive = false,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="neutral" onClick={onCancel ?? (() => onOpenChange(false))}>Avbryt</Button>
          <Button className={destructive ? 'bg-[var(--ui-danger-bg)] text-[var(--ui-danger-fg)] hover:bg-[var(--ui-danger-bg-hover)]' : undefined} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
