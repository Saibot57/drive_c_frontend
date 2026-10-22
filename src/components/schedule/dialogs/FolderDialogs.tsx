'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PlannerArchiveSummary } from '@/types/schedule';
import { folderNameOf, ownArchivesIn } from '@/utils/scheduleFolders';
import type { FolderGroup } from '@/utils/scheduleFolders';

/** Samma gräns som backend (MAX_FOLDER_NAME_LENGTH). */
const MAX_FOLDER_NAME_LENGTH = 100;

/** Namnet duger inte, eller null. Visas under fältet. */
const nameProblem = (name: string): string | null => (
  name.trim().length > MAX_FOLDER_NAME_LENGTH ? 'Namnet är för långt.' : null
);

const mergeHint = (name: string) => (
  <p className="mt-1 text-xs text-ui-muted">
    Det finns redan en mapp som heter &quot;{name}&quot;. Schemana läggs ihop med den.
  </p>
);

/** Ägarna till de andras scheman i mappen, för texterna om vad som ligger kvar. */
const otherOwners = (group: FolderGroup): string => Array.from(new Set(
  group.archives.filter(archive => !archive.isOwner).map(archive => archive.ownerUsername ?? 'någon annan')
)).join(', ');

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const yours = (count: number) => (count === 1 ? 'ditt schema' : `dina ${count} scheman`);
const theirs = (group: FolderGroup, count: number) => (
  count === 1 ? `schemat från ${otherOwners(group)}` : `de ${count} från ${otherOwners(group)}`
);

type FolderContentsDialogProps = {
  /** Stängd, Ny mapp, eller Lägg till scheman i en befintlig mapp. */
  target: { kind: 'create'; selectedIds: string[] } | { kind: 'add'; folder: string } | null;
  onClose: () => void;
  /** De egna veckoschemana. Bara dem kan man flytta. */
  ownWeekArchives: PlannerArchiveSummary[];
  existingNames: string[];
  isSaving: boolean;
  onSubmit: (folder: string, archives: PlannerArchiveSummary[]) => Promise<boolean>;
};

/**
 * Ny mapp och Lägg till scheman. En mapp utan scheman finns inte, så Ny mapp
 * kräver både ett namn och minst ett schema.
 */
export function FolderContentsDialog({
  target,
  onClose,
  ownWeekArchives,
  existingNames,
  isSaving,
  onSubmit
}: FolderContentsDialogProps) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!target) return;
    setName(target.kind === 'add' ? target.folder : '');
    setSelected(new Set(target.kind === 'create' ? target.selectedIds : []));
  }, [target]);

  // Lösa scheman först: det är dem man oftast vill samla. Scheman som redan
  // ligger i mappen visas inte.
  const candidates = useMemo(() => {
    const outside = ownWeekArchives.filter(archive => (
      target?.kind !== 'add' || folderNameOf(archive) !== target.folder
    ));
    return [
      ...outside.filter(archive => folderNameOf(archive) === null),
      ...outside.filter(archive => folderNameOf(archive) !== null)
    ];
  }, [ownWeekArchives, target]);

  const trimmed = name.trim();
  const problem = nameProblem(name);
  const merges = target?.kind === 'create' && existingNames.includes(trimmed);
  const chosen = candidates.filter(archive => selected.has(archive.id));
  const canSubmit = Boolean(trimmed) && !problem && chosen.length > 0 && !isSaving;

  const toggle = (archiveId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(archiveId)) next.delete(archiveId);
      else next.add(archiveId);
      return next;
    });
  };

  const submit = async () => {
    if (!canSubmit) return;
    if (await onSubmit(trimmed, chosen)) onClose();
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[85vh] flex-col">
        <DialogHeader>
          <DialogTitle>
            {target?.kind === 'add' ? `Lägg till scheman i ${target.folder}` : 'Ny mapp'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); void submit(); }} className="flex min-h-0 flex-col gap-3">
          {target?.kind === 'create' && (
            <div>
              <Label htmlFor="folder-name">Namn</Label>
              <Input
                id="folder-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="t.ex. HT26 eller Introveckor"
                autoFocus
                autoComplete="off"
              />
              {problem && <p className="mt-1 text-xs text-ui-danger">{problem}</p>}
              {merges && mergeHint(trimmed)}
            </div>
          )}
          <div className="flex min-h-0 flex-col">
            <Label>Scheman</Label>
            {candidates.length === 0 ? (
              <p className="text-sm text-ui-muted">Du har inga fler veckoscheman att lägga här.</p>
            ) : (
              <ul className="min-h-0 overflow-y-auto pr-1">
                {candidates.map(archive => {
                  const folder = folderNameOf(archive);
                  return (
                    <li key={archive.id}>
                      <label className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.has(archive.id)}
                          onChange={() => toggle(archive.id)}
                        />
                        <span className="min-w-0 break-words">{archive.name}</span>
                        {folder && <span className="ml-auto shrink-0 text-xs text-ui-muted">{folder}</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-xs text-ui-muted">
              Bara dina egna scheman kan flyttas. Alla som har schemat delat ser samma mapp.
            </p>
          </div>
          <DialogFooter>
            <Button variant="neutral" type="button" onClick={onClose}>Avbryt</Button>
            <Button type="submit" disabled={!canSubmit}>
              {target?.kind === 'add' ? 'Lägg till' : 'Skapa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type RenameFolderDialogProps = {
  group: FolderGroup | null;
  onClose: () => void;
  existingNames: string[];
  isSaving: boolean;
  onRename: (from: string, to: string) => Promise<boolean>;
};

/** Byt namn på en mapp. Bara de egna schemana byter mapp. */
export function RenameFolderDialog({ group, onClose, existingNames, isSaving, onRename }: RenameFolderDialogProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (group) setName(group.name);
  }, [group]);

  const trimmed = name.trim();
  const problem = nameProblem(name);
  const unchanged = trimmed === group?.name;
  const merges = !unchanged && existingNames.includes(trimmed);
  const ownCount = group ? ownArchivesIn(group).length : 0;
  const othersCount = group ? group.archives.length - ownCount : 0;
  const canSubmit = Boolean(trimmed) && !problem && !unchanged && !isSaving;

  const submit = async () => {
    if (!group || !canSubmit) return;
    if (await onRename(group.name, trimmed)) onClose();
  };

  return (
    <Dialog open={Boolean(group)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Byt namn på mappen</DialogTitle>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-3">
          <div>
            <Label htmlFor="folder-rename">Namn</Label>
            <Input
              id="folder-rename"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              autoComplete="off"
            />
            {problem && <p className="mt-1 text-xs text-ui-danger">{problem}</p>}
            {merges && mergeHint(trimmed)}
          </div>
          {group && othersCount > 0 && (
            <p className="text-sm text-ui-ink-2">
              Bara {yours(ownCount)} byter mapp. {capitalize(theirs(group, othersCount))} ligger
              kvar i &quot;{group.name}&quot;.
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

/** Texten i Ta bort mapp. Schemana tas aldrig bort, och andras ligger kvar. */
export function DeleteFolderMessage({ group }: { group: FolderGroup }) {
  const ownCount = ownArchivesIn(group).length;
  const othersCount = group.archives.length - ownCount;
  if (othersCount === 0) {
    return (
      <p className="text-sm text-ui-ink-2">
        Ta bort mappen &quot;{group.name}&quot;? {ownCount === 1 ? 'Schemat' : `De ${ownCount} schemana`} i
        den tas inte bort. De hamnar under Veckoscheman.
      </p>
    );
  }
  return (
    <p className="text-sm text-ui-ink-2">
      {capitalize(yours(ownCount))} i &quot;{group.name}&quot; hamnar under Veckoscheman och tas inte
      bort. {capitalize(theirs(group, othersCount))} ligger kvar i mappen.
    </p>
  );
}
