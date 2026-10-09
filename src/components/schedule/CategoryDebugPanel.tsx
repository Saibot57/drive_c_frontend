'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type CategoryDebugPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  missingCount: number;
  totalCount: number;
};

export function CategoryDebugPanel({
  open,
  onOpenChange,
  categories,
  missingCount,
  totalCount
}: CategoryDebugPanelProps) {
  const hasCategories = categories.length > 0;
  const hasActivities = totalCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kategorier (debug)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-semibold">Unika kategorier ({categories.length})</p>
            {hasCategories ? (
              <ul className="list-disc pl-5">
                {categories.map(category => (
                  <li key={category}>{category}</li>
                ))}
              </ul>
            ) : (
              <p className="text-ui-muted">Inga kategorier hittades.</p>
            )}
          </div>
          <div>
            <p className="font-semibold">Aktiviteter utan kategori</p>
            <p>{missingCount} av {totalCount}</p>
          </div>
          {!hasActivities && (
            <p className="text-ui-muted">Inga aktiviteter laddade ännu.</p>
          )}
          <p className="text-xs text-ui-muted">
            Öppna via Ctrl + Shift + C.
          </p>
        </div>
        <DialogFooter>
          <Button variant="neutral" onClick={() => onOpenChange(false)} className="border-frame border-ui-line">
            Stäng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
