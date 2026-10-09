'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PlannerArchiveSummary, ScheduleKind } from '@/types/schedule';
import { decodeScheduleSource, encodeScheduleSource, NewScheduleSource } from '@/utils/createSchedule';

type NewScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sorten på schemat som skapas. */
  kind: ScheduleKind;
  /** Schemat som dupliceras. Då är källan låst till det. */
  duplicateOf: PlannerArchiveSummary | null;
  name: string;
  onNameChange: (value: string) => void;
  source: NewScheduleSource;
  onSourceChange: (value: NewScheduleSource) => void;
  /** Basscheman, egna före delade. */
  baseArchives: PlannerArchiveSummary[];
  /** Veckoscheman, egna före delade. Bara ett nytt basschema kan utgå från dem. */
  weekArchives: PlannerArchiveSummary[];
  /**
   * Poster i det gamla huvudschemat, eller null innan det hämtats. Har det
   * poster går de att göra till ett schema (docs/plans/basscheman.md, 5.2).
   */
  legacyMainCount: number | null;
  /** Källan är schemat som är öppet, och dess senaste sparning misslyckades. */
  sourceHasUnsavedChanges: boolean;
  onCreate: () => void;
  isCreating: boolean;
  /** Namnet används redan av ett eget schema, av någon sort. */
  nameExists: boolean;
};

const archiveLabel = (archive: PlannerArchiveSummary) => (
  archive.isOwner ? archive.name : `${archive.name} (${archive.ownerUsername ?? 'delat'})`
);

const archiveOptions = (archives: PlannerArchiveSummary[]) => archives.map(archive => (
  <option key={archive.id} value={encodeScheduleSource({ kind: 'archive', id: archive.id })}>
    {archiveLabel(archive)}
  </option>
));

export function NewScheduleDialog({
  open,
  onOpenChange,
  kind,
  duplicateOf,
  name,
  onNameChange,
  source,
  onSourceChange,
  baseArchives,
  weekArchives,
  legacyMainCount,
  sourceHasUnsavedChanges,
  onCreate,
  isCreating,
  nameExists,
}: NewScheduleDialogProps) {
  const title = duplicateOf
    ? `Duplicera ${duplicateOf.name}`
    : kind === 'base' ? 'Nytt basschema' : 'Nytt veckoschema';
  const showLegacyMain = (legacyMainCount ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onCreate(); }} className="space-y-3">
          <div>
            <Label htmlFor="new-schedule-name">Namn</Label>
            <Input
              id="new-schedule-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={kind === 'base' ? 't.ex. Bas HT26' : 't.ex. v.45 eller Höstlov'}
              autoFocus
            />
            {nameExists && (
              <p className="text-xs text-rose-600 kron:text-ui-danger mt-1">Det finns redan ett schema med det namnet.</p>
            )}
          </div>
          <div>
            {duplicateOf ? (
              <>
                <Label>Utgå från</Label>
                <p className="text-sm">{archiveLabel(duplicateOf)}</p>
              </>
            ) : (
              <>
                <Label htmlFor="new-schedule-source">Utgå från</Label>
                <select
                  id="new-schedule-source"
                  value={encodeScheduleSource(source)}
                  onChange={(e) => onSourceChange(decodeScheduleSource(e.target.value))}
                  className="sp-input h-10 w-full rounded-base border-frame border-ui-line bg-ui-paper px-2 text-sm"
                >
                  {/* Ett veckoschema utgår helst från en bas, så baserna står
                      först. Ett basschema börjar oftast tomt. */}
                  {kind === 'base' && <option value="empty">Tomt schema</option>}
                  {baseArchives.length > 0 && (
                    <optgroup label="Basscheman">{archiveOptions(baseArchives)}</optgroup>
                  )}
                  {kind === 'base' && weekArchives.length > 0 && (
                    <optgroup label="Veckoscheman">{archiveOptions(weekArchives)}</optgroup>
                  )}
                  {kind === 'week' && <option value="empty">Tomt schema</option>}
                  {showLegacyMain && (
                    <option value="main">Gamla huvudschemat ({legacyMainCount} poster)</option>
                  )}
                </select>
              </>
            )}
            <p className="mt-1 text-xs text-gray-600 kron:text-ui-muted">
              {source.kind === 'empty'
                ? 'Schemat börjar tomt.'
                : 'Posterna kopieras till det nya schemat, som öppnas direkt. Källan ändras inte.'}
            </p>
            {kind === 'week' && !duplicateOf && baseArchives.length === 0 && (
              <p className="mt-1 text-xs text-gray-600 kron:text-ui-muted">
                Det finns inga basscheman ännu. Gör om ett schema med Gör till basschema, eller skapa ett med + vid Basscheman.
              </p>
            )}
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
