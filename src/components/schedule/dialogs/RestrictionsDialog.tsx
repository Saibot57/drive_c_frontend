'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RestrictionRule } from '@/types/schedule';

type RestrictionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newRule: RestrictionRule;
  onNewRuleChange: (rule: RestrictionRule) => void;
  restrictions: RestrictionRule[];
  onAddRule: () => void;
  onRemoveRule: (id: string) => void;
};

/** Ämnen som inte får ligga samtidigt. */
export function RestrictionsDialog({
  open,
  onOpenChange,
  newRule,
  onNewRuleChange,
  restrictions,
  onAddRule,
  onRemoveRule,
}: RestrictionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent><DialogHeader><DialogTitle>Regler</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div className="flex gap-2"><Input placeholder="Matte*" value={newRule.subjectA} onChange={e => onNewRuleChange({ ...newRule, subjectA: e.target.value })} /><Input placeholder="Svenska*" value={newRule.subjectB} onChange={e => onNewRuleChange({ ...newRule, subjectB: e.target.value })} /><Button onClick={onAddRule}>+</Button></div>
          {restrictions.map(r => <div key={r.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded"><span>{r.subjectA} ⚡ {r.subjectB}</span><X size={14} className="cursor-pointer" onClick={() => onRemoveRule(r.id)} /></div>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
