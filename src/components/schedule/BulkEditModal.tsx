'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { SmartTextInput } from '@/components/ui/SmartTextInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColorTriggerRule, RoomTriggerRule, ScheduledEntry } from '@/types/schedule';
import { BulkEditField, BulkEditPatch, sharedFieldValue } from '@/utils/bulkEditSchedule';
import { findColorTrigger } from '@/utils/colorTriggers';
import { findRoomTrigger } from '@/utils/roomTriggers';

/**
 * Ett fälts läge i dialogen. `keep` är utgångsläget och skriver ingenting.
 *
 * Att sudda ett fält tomt ger `edit` med tom text, och det lämnas också orört —
 * bara Töm-knappen tömmer. Ett fält som visar "Flera värden" ser redan tomt ut
 * när dialogen öppnas, så om tomt betydde "töm" gick det inte att se skillnad
 * på orört och tömt. För salen är skillnaden stor: tom sal betyder att
 * salsreglerna tar över.
 */
type FieldDraft =
  | { kind: 'keep' }
  | { kind: 'edit'; value: string }
  | { kind: 'clear' };

type Drafts = Record<BulkEditField, FieldDraft>;

const FIELDS: BulkEditField[] = ['title', 'teacher', 'room'];

const INITIAL_DRAFTS: Drafts = {
  title: { kind: 'keep' },
  teacher: { kind: 'keep' },
  room: { kind: 'keep' }
};

/** Så många poster räknas upp i dialogen innan resten blir en siffra. */
const LISTED_ENTRIES = 4;

type BulkEditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: ScheduledEntry[];
  teachers: string[];
  rooms: string[];
  colorTriggers: ColorTriggerRule[];
  roomTriggers: RoomTriggerRule[];
  /**
   * Skriver ändringen. Returnerar ett felmeddelande när en ämnesregel stoppade
   * den — då står dialogen kvar och visar det — annars null.
   */
  onSave: (patch: BulkEditPatch) => string | null;
};

const plural = (count: number) => `${count} post${count === 1 ? '' : 'er'}`;

export function BulkEditModal({
  open,
  onOpenChange,
  entries,
  teachers,
  rooms,
  colorTriggers,
  roomTriggers,
  onSave
}: BulkEditModalProps) {
  const [drafts, setDrafts] = useState<Drafts>(INITIAL_DRAFTS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDrafts(INITIAL_DRAFTS);
    setError(null);
  }, [open]);

  const shared = useMemo(() => ({
    title: sharedFieldValue(entries, 'title'),
    teacher: sharedFieldValue(entries, 'teacher'),
    room: sharedFieldValue(entries, 'room')
  }), [entries]);

  const patch = useMemo(() => {
    const result: BulkEditPatch = {};
    FIELDS.forEach(field => {
      const draft = drafts[field];
      if (draft.kind === 'clear') result[field] = '';
      if (draft.kind === 'edit' && draft.value.trim()) result[field] = draft.value.trim();
    });
    return result;
  }, [drafts]);

  // Knappen är bara aktiv när minst en post faktiskt skulle ändras.
  const canSave = useMemo(() => (
    entries.some(entry => (Object.keys(patch) as BulkEditField[]).some(field => (
      (entry[field] ?? '') !== patch[field]
    )))
  ), [entries, patch]);

  const shownValue = (field: BulkEditField): string => {
    const draft = drafts[field];
    if (draft.kind === 'edit') return draft.value;
    if (draft.kind === 'clear') return '';
    return shared[field] ?? '';
  };

  const placeholder = (field: BulkEditField): string | undefined => {
    if (drafts[field].kind === 'clear') return 'Töms';
    return shared[field] === null ? 'Flera värden' : undefined;
  };

  const setDraft = (field: BulkEditField, draft: FieldDraft) => {
    setDrafts(prev => ({ ...prev, [field]: draft }));
    setError(null);
  };

  const handleChange = (field: BulkEditField, value: string) => {
    // SmartTextInput skickar värdet igen när fältet tappar fokus. Utan den här
    // spärren hade man fått tomt-fält-hinten bara av att tabba förbi.
    if (drafts[field].kind === 'keep' && value === shownValue(field)) return;
    setDraft(field, { kind: 'edit', value });
  };

  const isEmptiedByTyping = (field: BulkEditField) => {
    const draft = drafts[field];
    return draft.kind === 'edit' && !draft.value.trim();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setError(onSave(patch));
  };

  /**
   * Salsreglerna gäller för poster med tom sal, så en tömning är inte alltid
   * en tom sal på kortet. Räknas med den nya titeln när den också byts.
   */
  const roomHint = (() => {
    if (drafts.room.kind !== 'clear') return null;
    const titleFor = (entry: ScheduledEntry) => patch.title ?? entry.title;
    const filledByRule = entries.filter(entry => findRoomTrigger(titleFor(entry), roomTriggers)).length;
    return (
      <p className="text-xs text-gray-600">
        Salen töms i {plural(entries.length)}.
        {filledByRule > 0 && ` I ${filledByRule} av dem fyller en salsregel i salen.`}
      </p>
    );
  })();

  const colorHint = (() => {
    if (!patch.title) return null;
    const trigger = findColorTrigger(patch.title, colorTriggers);
    if (!trigger) return null;
    return (
      <p className="flex items-center gap-2 text-xs text-gray-600">
        <span
          className="h-3 w-3 shrink-0 rounded-full border border-black"
          style={{ backgroundColor: trigger.color }}
        />
        Den nya titeln matchar färgregeln &quot;{trigger.word}&quot;, så posterna får dess färg.
      </p>
    );
  })();

  const emptiedHint = (field: BulkEditField) => {
    if (!isEmptiedByTyping(field)) return null;
    return (
      <p className="text-xs text-gray-600">
        {field === 'title'
          ? 'Titeln kan inte tömmas. Tomt fält lämnas orört.'
          : 'Tomt fält lämnas orört. Tryck Töm för att tömma det.'}
      </p>
    );
  };

  const renderClearableField = (
    field: 'teacher' | 'room',
    label: string,
    options: string[]
  ) => {
    const isClearing = drafts[field].kind === 'clear';
    const allEmpty = shared[field] === '';
    return (
      <div className="space-y-1">
        {isClearing ? (
          <div className="space-y-1">
            <Label htmlFor={`bulk-${field}`}>{label}</Label>
            <Input id={`bulk-${field}`} value="" placeholder="Töms" disabled />
          </div>
        ) : (
          <SmartTextInput
            fieldId={`bulk-${field}`}
            label={label}
            value={shownValue(field)}
            options={options}
            placeholder={placeholder(field)}
            onChange={value => handleChange(field, value)}
          />
        )}
        <button
          type="button"
          className="text-xs font-semibold underline underline-offset-2 disabled:no-underline disabled:opacity-40"
          disabled={!isClearing && allEmpty}
          title={!isClearing && allEmpty ? 'Fältet är redan tomt i alla poster' : undefined}
          onClick={() => setDraft(field, isClearing ? { kind: 'keep' } : { kind: 'clear' })}
        >
          {isClearing ? 'Ångra tömning' : 'Töm'}
        </button>
        {emptiedHint(field)}
      </div>
    );
  };

  const listed = entries.slice(0, LISTED_ENTRIES);
  const rest = entries.length - listed.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redigera {plural(entries.length)}</DialogTitle>
          <DialogDescription>
            Bara fält du ändrar sparas. Det du skriver ersätter det som står i alla markerade poster.
          </DialogDescription>
        </DialogHeader>
        <ul className="text-xs text-gray-700 space-y-0.5">
          {listed.map(entry => (
            <li key={entry.instanceId} className="truncate">
              <span className="font-mono">{entry.day.slice(0, 3)} {entry.startTime}</span>
              {' · '}
              <span className="font-semibold">{entry.title}</span>
            </li>
          ))}
          {rest > 0 && <li className="text-gray-500">+{rest} till</li>}
        </ul>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bulk-title">Titel</Label>
            <Input
              id="bulk-title"
              value={shownValue('title')}
              placeholder={placeholder('title')}
              onChange={event => handleChange('title', event.target.value)}
            />
            {emptiedHint('title')}
            {colorHint}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {renderClearableField('teacher', 'Lärare', teachers)}
            {renderClearableField('room', 'Rum', rooms)}
          </div>
          {roomHint}
          {error && (
            <p role="alert" className="border-2 border-black bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900">
              Inget ändrades. {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="neutral" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={!canSave}>
              Spara i {plural(entries.length)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
