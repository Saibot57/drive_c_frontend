'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, FolderOpen, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MAX_TEMPLATE_NAME_LENGTH, cleanTemplateName, templateSize, type GroupTemplate } from '@/utils/narvaroTemplates';

type MenuProps = {
  /** Senast ändrad först. */
  templates: readonly GroupTemplate[];
  /** Falskt i exemplet: dess elever finns inte i indelningarna. */
  canApply: boolean;
  onApply: (id: string) => void;
  onManage: () => void;
};

/** "Lägg på indelning": de sparade indelningarna, och sist Hantera indelningar. */
export function NarvaroTemplateMenu({ templates, canApply, onApply, onManage }: MenuProps) {
  return (
    // Inte modal: en dialog som öppnas från menyn (Ersätta grupperna?) lämnar
    // annars `pointer-events: none` kvar på sidan när den stängs.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="neutral" className="sp-btn"><FolderOpen /> Lägg på indelning <ChevronDown /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-ui-muted">
          {!canApply ? 'Indelningar läggs inte på i exemplet' : templates.length ? 'Sparade indelningar' : 'Inga sparade indelningar än'}
        </DropdownMenuLabel>
        {templates.map(t => (
          <DropdownMenuItem key={t.id} disabled={!canApply} onSelect={() => onApply(t.id)} className="justify-between">
            <span className="min-w-0 truncate font-semibold">{t.name}</span>
            <span className="shrink-0 font-mono text-xs text-ui-muted">{t.groups.length} gr · {templateSize(t)} st</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onManage}>Hantera indelningar…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type BarProps = {
  /** Indelningen passets grupper kom från, om den finns kvar. */
  from: GroupTemplate | null;
  onUpdate: () => void;
  onSaveAs: () => void;
};

/** Raden över passets grupper: varifrån de kom, Uppdatera och Spara som indelning. */
export function NarvaroTemplateBar({ from, onUpdate, onSaveAs }: BarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {from && <span className="text-ui-muted">Från: <b className="text-ui-ink">{from.name}</b></span>}
      {from && <Button variant="neutral" size="sm" className="sp-btn" onClick={onUpdate}><RefreshCw /> Uppdatera indelningen</Button>}
      <Button variant="neutral" size="sm" className="sp-btn" onClick={onSaveAs}><Save /> Spara som indelning…</Button>
    </div>
  );
}

/** Det sidan frågar om innan en indelning ändras eller ersätter passets grupper. */
export type TemplateAsk =
  | { kind: 'replace'; id: string; name: string }
  | { kind: 'saveAs'; absent: number }
  | { kind: 'update'; template: GroupTemplate; moved: number; removed: number; added: number; dropped: number };

type AskProps = {
  ask: TemplateAsk | null;
  templates: readonly GroupTemplate[];
  onCancel: () => void;
  onReplace: (id: string) => void;
  /** `overwrite` är id:t på en indelning med samma namn som ska ersättas. */
  onSaveAs: (name: string, overwrite: string | null) => void;
  onUpdate: (template: GroupTemplate) => void;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Frågorna om indelningar i en dialog. */
export function NarvaroTemplateAsk({ ask, templates, onCancel, onReplace, onSaveAs, onUpdate }: AskProps) {
  const [name, setName] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  useEffect(() => { setName(''); setConfirmOverwrite(false); }, [ask]);

  const clean = cleanTemplateName(name);
  const same = templates.find(t => t.name.toLocaleLowerCase('sv') === clean.toLocaleLowerCase('sv')) ?? null;
  const submitSaveAs = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clean) return;
    if (same && !confirmOverwrite) { setConfirmOverwrite(true); return; }
    onSaveAs(clean, same?.id ?? null);
  };

  const title = !ask ? '' : ask.kind === 'replace' ? 'Ersätta grupperna?' : ask.kind === 'saveAs' ? 'Spara som indelning' : 'Uppdatera indelningen?';
  return (
    <Dialog open={ask !== null} onOpenChange={open => { if (!open) onCancel(); }}>
      {/* Rubriken ändras med frågan, så platsen minns under en fast nyckel. */}
      <DialogContent positionKey="narvaro-indelning" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {ask?.kind === 'replace' && (
            <DialogDescription>Passet har redan grupper. Ersätta dem med {ask.name}?</DialogDescription>
          )}
          {ask?.kind === 'update' && (
            <DialogDescription>
              {ask.template.name} får passets grupper och namn. {[
                ask.added && `${plural(ask.added, 'elev läggs', 'elever läggs')} till`,
                ask.moved && `${plural(ask.moved, 'elev flyttas', 'elever flyttas')} till en annan grupp`,
                ask.removed && `${plural(ask.removed, 'elev tas', 'elever tas')} bort (står i Inte indelade)`,
                ask.dropped && `${plural(ask.dropped, 'elev', 'elever')} som inte finns i passet tas bort, eftersom deras grupp inte finns kvar`,
              ].filter(Boolean).join('. ') || 'Inga elever byter grupp'}. Elever som inte finns i passet ligger annars kvar i sina grupper.
            </DialogDescription>
          )}
        </DialogHeader>
        {ask?.kind === 'saveAs' ? (
          <form className="flex flex-col gap-3" onSubmit={submitSaveAs}>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Namn
              <input
                value={name}
                onChange={e => { setName(e.target.value); setConfirmOverwrite(false); }}
                maxLength={MAX_TEMPLATE_NAME_LENGTH}
                placeholder="Till exempel: Labbgrupper NA1"
                autoFocus
                className="sp-input rounded-ui-sm bg-ui-paper px-2 py-1.5 text-sm font-normal"
              />
            </label>
            {ask.absent > 0 && (
              <p className="text-sm">
                {ask.absent} frånvarande kommer inte med. Du kan lägga till dem under Hantera indelningar.
              </p>
            )}
            {confirmOverwrite && same && (
              <p className="text-sm font-semibold">Det finns redan en indelning som heter {same.name}. Spara igen för att skriva över den.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="neutral" className="sp-btn" onClick={onCancel}>Avbryt</Button>
              <Button type="submit" className="sp-btn" disabled={!clean}>{confirmOverwrite ? 'Skriv över' : 'Spara'}</Button>
            </div>
          </form>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="neutral" className="sp-btn" onClick={onCancel}>Avbryt</Button>
            {ask?.kind === 'replace' && <Button className="sp-btn" onClick={() => onReplace(ask.id)}>Ersätt</Button>}
            {ask?.kind === 'update' && <Button className="sp-btn" onClick={() => onUpdate(ask.template)}>Uppdatera</Button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
