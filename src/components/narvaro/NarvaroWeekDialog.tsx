'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PublicTimeGrid, { EntryState } from '@/components/schedule/public/PublicTimeGrid';
import { ScheduleNamePicker } from '@/components/narvaro/NarvaroScheduleLine';
import type { ScheduleWeeks } from '@/hooks/useNarvaroSchedule';
import type { ScheduledEntry } from '@/types/schedule';
import { NotesStore, Stamp, combineSheets, sessionText } from '@/utils/narvaro';
import { Sheets } from '@/utils/narvaroDocs';
import { EntrySession, ScheduleTarget, isMine, sessionForEntry, sheetsForWeek, shiftWeek } from '@/utils/narvaroSchedule';
import { collectTeacherNames } from '@/utils/scheduleStats';

/**
 * Veckans schema i Närvarorutor. Egna pass ritas som vanligt och övriga
 * nedtonade; ett pass med noteringar har en prick. Ett klick i den aktuella
 * veckan väljer passet på sidan, ett klick i en annan vecka visar passets
 * noteringar här. Se docs/plans/narvaro-schemakoppling.md, avsnitt 4.2.
 */

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentWeek: string;
  weeks: ScheduleWeeks;
  ensureWeek: (week: string) => void;
  resolveColor: (title: string, fallbackColor: string) => string;
  resolveRoom: (title: string, room?: string) => string;
  myName: string;
  onChooseName: (name: string) => void;
  /** Närvarons ark per vecka och klass. */
  tables: Record<string, Sheets>;
  notes: NotesStore;
  stamps: readonly Stamp[];
  /** Ett pass i den aktuella veckan valdes. */
  onPick: (target: ScheduleTarget) => void;
  onCopy: (text: string) => void;
};

const weekNumber = (weekKey: string) => weekKey.slice(-2).replace(/^0/, '');
const NO_SESSIONS = new Map<string, EntrySession | null>();

export function NarvaroWeekDialog({
  open, onOpenChange, currentWeek, weeks, ensureWeek, resolveColor, resolveRoom,
  myName, onChooseName, tables, notes, stamps, onPick, onCopy,
}: Props) {
  const [shown, setShown] = useState(currentWeek);
  const [picked, setPicked] = useState<ScheduledEntry | null>(null);
  useEffect(() => {
    if (!open) return;
    setShown(currentWeek);
    setPicked(null);
  }, [open, currentWeek]);
  useEffect(() => { if (open) ensureWeek(shown); }, [open, shown, ensureWeek]);

  const data = weeks[shown];
  const isCurrent = shown === currentWeek;
  const sheets = useMemo(() => sheetsForWeek(tables, shown), [tables, shown]);
  const sessions = useMemo(() => (data
    ? new Map(data.entries.map(e => [e.instanceId, sessionForEntry(e, sheets, data.entries, shown, notes)]))
    : NO_SESSIONS), [data, sheets, shown, notes]);
  const teacherNames = useMemo(() => (data ? collectTeacherNames(data.entries) : []), [data]);

  const entryState = (entry: ScheduledEntry): EntryState => {
    const s = sessions.get(entry.instanceId);
    return { dimmed: !!myName && !isMine(entry, myName), marked: !!s?.sess, clickable: !!s };
  };
  const onEntryClick = (entry: ScheduledEntry) => {
    const s = sessions.get(entry.instanceId);
    if (!s) return;
    if (isCurrent) onPick(s.target);
    else setPicked(entry);
  };
  const go = (delta: number) => { setShown(w => shiftWeek(w, delta)); setPicked(null); };

  const pickedSession = picked ? sessions.get(picked.instanceId) ?? null : null;
  const pickedText = pickedSession?.sess
    ? sessionText(pickedSession.sess, combineSheets(sheets, Object.keys(sheets)), stamps)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent movable={false} className="flex max-h-[94vh] w-[96vw] max-w-none flex-col gap-3 overflow-y-auto p-5 pt-8">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="neutral" size="icon" className="sp-btn" aria-label="Veckan före" onClick={() => go(-1)}>
              <ChevronLeft />
            </Button>
            <DialogTitle className="min-w-[7ch] text-center text-xl">Vecka {weekNumber(shown)}</DialogTitle>
            <Button variant="neutral" size="icon" className="sp-btn" aria-label="Veckan efter" onClick={() => go(1)}>
              <ChevronRight />
            </Button>
            {!isCurrent && (
              <button type="button" className="text-sm text-ui-muted underline" onClick={() => { setShown(currentWeek); setPicked(null); }}>
                Till den här veckan
              </button>
            )}
            <span className="ml-auto">
              <ScheduleNamePicker label="Du i schemat:" names={teacherNames} value={myName} onChange={onChooseName} />
            </span>
          </div>
          <DialogDescription className="text-sm text-ui-muted">
            {myName ? 'Dina pass är starka och övriga nedtonade. ' : ''}En prick betyder noteringar.{' '}
            {isCurrent ? 'Klicka på ett pass för att välja det.' : 'Klicka på ett pass för att se noteringarna.'}
          </DialogDescription>
        </DialogHeader>

        {data === undefined && <p className="text-sm text-ui-muted">Hämtar schemat…</p>}
        {data === null && <p className="text-sm text-ui-muted">Inget schema för vecka {weekNumber(shown)}.</p>}
        {data && (
          <PublicTimeGrid
            entries={data.entries}
            resolveColor={resolveColor}
            resolveRoom={resolveRoom}
            onEntryClick={onEntryClick}
            entryState={entryState}
          />
        )}

        {picked && !isCurrent && (
          <section className="sp-card flex flex-col gap-2 p-3" aria-label="Noteringar för passet">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">
                {pickedSession?.sess?.label || `${picked.title} · ${picked.day} ${picked.startTime}`}
              </h3>
              {pickedText && (
                <Button variant="neutral" size="sm" className="sp-btn" onClick={() => onCopy(pickedText)}>
                  <Copy /> Kopiera
                </Button>
              )}
            </div>
            {pickedText ? (
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-ui-sm border border-ui-line bg-ui-surface-2 p-2.5 font-mono text-xs">
                {pickedText}
              </pre>
            ) : (
              <p className="text-sm text-ui-muted">Inga noteringar för {picked.title} {picked.day.toLocaleLowerCase('sv')}.</p>
            )}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
