'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { SmartTextInput } from '@/components/ui/SmartTextInput';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/ColorPicker';
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
import { Textarea } from '@/components/ui/textarea';
import {
  COURSE_COLOR_PALETTE,
  DEFAULT_COURSE_COLOR,
  MAX_RECENT_CUSTOM_COLORS,
  RECENT_CUSTOM_COLORS_KEY
} from '@/config/plannerConstants';
import { ColorTriggerRule, RoomTriggerRule, ScheduledEntry } from '@/types/schedule';
import {
  BULK_TEXT_FIELDS,
  BulkEditField,
  BulkEditPatch,
  bulkPatchChangesAny,
  sharedFieldValue,
  sharesTimeSlot
} from '@/utils/bulkEditSchedule';
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

const INITIAL_DRAFTS: Drafts = {
  title: { kind: 'keep' },
  teacher: { kind: 'keep' },
  room: { kind: 'keep' },
  notes: { kind: 'keep' },
  category: { kind: 'keep' }
};

/**
 * Tiden har två lägen, och bara det valda skrivs. Ett tomt tidsfält eller
 * noll minuter är orört, precis som ett tomt textfält.
 */
type TimeMode = 'set' | 'shift';

type TimeDraft = { mode: TimeMode; start: string | null; end: string | null; shift: string };

const INITIAL_TIME: TimeDraft = { mode: 'set', start: null, end: null, shift: '' };

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
   * Skriver ändringen. Returnerar ett felmeddelande när en ämnesregel eller en
   * ogiltig tid stoppade den — då står dialogen kvar och visar det — annars null.
   */
  onSave: (patch: BulkEditPatch) => string | null;
};

const plural = (count: number) => `${count} post${count === 1 ? '' : 'er'}`;

const minutesLabel = (minutes: number) => {
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

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
  const [time, setTime] = useState<TimeDraft>(INITIAL_TIME);
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDrafts(INITIAL_DRAFTS);
    setTime(INITIAL_TIME);
    setColor(null);
    setError(null);
  }, [open]);

  const shared = useMemo(() => ({
    title: sharedFieldValue(entries, 'title'),
    teacher: sharedFieldValue(entries, 'teacher'),
    room: sharedFieldValue(entries, 'room'),
    notes: sharedFieldValue(entries, 'notes'),
    category: sharedFieldValue(entries, 'category'),
    color: sharedFieldValue(entries, 'color'),
    startTime: sharedFieldValue(entries, 'startTime'),
    endTime: sharedFieldValue(entries, 'endTime')
  }), [entries]);

  // Tiden visas bara när alla posterna ligger på samma tid, dag spelar ingen roll.
  const timeEditable = useMemo(() => sharesTimeSlot(entries), [entries]);

  const shiftMinutes = Number.parseInt(time.shift, 10);

  const patch = useMemo(() => {
    const result: BulkEditPatch = {};
    BULK_TEXT_FIELDS.forEach(field => {
      const draft = drafts[field];
      if (draft.kind === 'clear') result[field] = '';
      if (draft.kind === 'edit' && draft.value.trim()) result[field] = draft.value.trim();
    });
    if (color) result.color = color;
    if (timeEditable && time.mode === 'set' && (time.start || time.end)) {
      result.time = { kind: 'set', start: time.start || undefined, end: time.end || undefined };
    }
    if (timeEditable && time.mode === 'shift' && Number.isFinite(shiftMinutes) && shiftMinutes !== 0) {
      result.time = { kind: 'shift', minutes: shiftMinutes };
    }
    return result;
  }, [drafts, color, time, shiftMinutes, timeEditable]);

  // Knappen är bara aktiv när minst en post faktiskt skulle ändras.
  const canSave = useMemo(() => bulkPatchChangesAny(entries, patch), [entries, patch]);

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

  const updateTime = (change: Partial<TimeDraft>) => {
    setTime(prev => ({ ...prev, ...change }));
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
      <p className="text-xs text-gray-600 kron:text-ui-muted">
        Salen töms i {plural(entries.length)}.
        {filledByRule > 0 && ` I ${filledByRule} av dem fyller en salsregel i salen.`}
      </p>
    );
  })();

  const titleColorHint = (() => {
    if (!patch.title) return null;
    const trigger = findColorTrigger(patch.title, colorTriggers);
    if (!trigger) return null;
    return (
      <p className="flex items-center gap-2 text-xs text-gray-600 kron:text-ui-muted">
        <span
          className="h-3 w-3 shrink-0 rounded-full border border-black"
          style={{ backgroundColor: trigger.color }}
        />
        Den nya titeln matchar färgregeln &quot;{trigger.word}&quot;, så posterna får dess färg.
      </p>
    );
  })();

  /**
   * Färgreglerna vinner när korten ritas, så en vald färg syns inte på poster
   * vars titel matchar en regel. Samma sak gäller i enkelredigeraren.
   */
  const pickedColorHint = (() => {
    if (!color) return null;
    const titleFor = (entry: ScheduledEntry) => patch.title ?? entry.title;
    const ruled = entries.filter(entry => findColorTrigger(titleFor(entry), colorTriggers)).length;
    if (ruled === 0) return null;
    return (
      <p className="text-xs text-gray-600 kron:text-ui-muted">
        {ruled === entries.length ? 'I alla posterna' : `I ${ruled} av posterna`} styr en färgregel färgen,
        så där syns inte den valda färgen.
      </p>
    );
  })();

  const emptiedHint = (field: BulkEditField) => {
    if (!isEmptiedByTyping(field)) return null;
    return (
      <p className="text-xs text-gray-600 kron:text-ui-muted">
        {field === 'title'
          ? 'Titeln kan inte tömmas. Tomt fält lämnas orört.'
          : 'Tomt fält lämnas orört. Tryck Töm för att tömma det.'}
      </p>
    );
  };

  const renderClearableField = (
    field: Exclude<BulkEditField, 'title'>,
    label: string,
    control: 'suggest' | 'input' | 'textarea',
    options: string[] = []
  ) => {
    const isClearing = drafts[field].kind === 'clear';
    const allEmpty = shared[field] === '';
    const id = `bulk-${field}`;

    const renderControl = () => {
      if (control === 'textarea') {
        return (
          <div className="space-y-1">
            <Label htmlFor={id}>{label}</Label>
            <Textarea
              id={id}
              rows={3}
              value={shownValue(field)}
              placeholder={placeholder(field)}
              disabled={isClearing}
              onChange={event => handleChange(field, event.target.value)}
            />
          </div>
        );
      }
      if (isClearing || control === 'input') {
        return (
          <div className="space-y-1">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              value={shownValue(field)}
              placeholder={placeholder(field)}
              disabled={isClearing}
              onChange={event => handleChange(field, event.target.value)}
            />
          </div>
        );
      }
      return (
        <SmartTextInput
          fieldId={id}
          label={label}
          value={shownValue(field)}
          options={options}
          placeholder={placeholder(field)}
          onChange={value => handleChange(field, value)}
        />
      );
    };

    return (
      <div className="space-y-1">
        {renderControl()}
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

  const modeButton = (mode: TimeMode, label: string) => (
    <button
      type="button"
      aria-pressed={time.mode === mode}
      onClick={() => updateTime({ mode })}
      className={`rounded border-frame border-ui-line px-2 py-0.5 text-xs font-bold transition-colors ${
        time.mode === mode ? 'bg-ui-ink text-ui-surface' : 'bg-ui-paper hover:bg-gray-100 kron:hover:bg-ui-surface-3'
      }`}
    >
      {label}
    </button>
  );

  const timeHint = (() => {
    if (time.mode === 'shift') {
      if (!Number.isFinite(shiftMinutes) || shiftMinutes === 0) {
        return 'Varje post flyttas lika mycket. Minus flyttar tidigare.';
      }
      return `Varje post flyttas ${minutesLabel(shiftMinutes)} ${shiftMinutes > 0 ? 'senare' : 'tidigare'}.`;
    }
    if (time.start && !time.end) return 'Posterna flyttas till den starttiden och behåller sin längd.';
    if (!time.start && time.end) return 'Posterna behåller sin start och slutar på den tiden.';
    if (time.start && time.end) return 'Alla posterna får exakt de tiderna, på sina egna dagar.';
    return null;
  })();

  const listed = entries.slice(0, LISTED_ENTRIES);
  const rest = entries.length - listed.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Redigera {plural(entries.length)}</DialogTitle>
          <DialogDescription>
            Bara fält du ändrar sparas. Det du skriver ersätter det som står i alla markerade poster.
          </DialogDescription>
        </DialogHeader>
        <ul className="text-xs text-gray-700 kron:text-ui-ink-2 space-y-0.5">
          {listed.map(entry => (
            <li key={entry.instanceId} className="truncate">
              <span className="font-mono">{entry.day.slice(0, 3)} {entry.startTime}</span>
              {' · '}
              <span className="font-semibold">{entry.title}</span>
            </li>
          ))}
          {rest > 0 && <li className="text-ui-muted">+{rest} till</li>}
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
            {titleColorHint}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {renderClearableField('teacher', 'Lärare', 'suggest', teachers)}
            {renderClearableField('room', 'Rum', 'suggest', rooms)}
          </div>
          {roomHint}

          {timeEditable ? (
            <fieldset className="space-y-2" aria-label="Tid">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-heading leading-none">Tid</span>
                <div className="flex gap-1">
                  {modeButton('set', 'Sätt tid')}
                  {modeButton('shift', 'Flytta')}
                </div>
              </div>
              {time.mode === 'set' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="bulk-start">Start</Label>
                    <Input
                      id="bulk-start"
                      type="time"
                      value={time.start ?? shared.startTime ?? ''}
                      onChange={event => updateTime({ start: event.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bulk-end">Slut</Label>
                    <Input
                      id="bulk-end"
                      type="time"
                      value={time.end ?? shared.endTime ?? ''}
                      onChange={event => updateTime({ end: event.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="neutral" size="sm" onClick={() => updateTime({
                    shift: String((Number.isFinite(shiftMinutes) ? shiftMinutes : 0) - 15)
                  })}>
                    −15
                  </Button>
                  <Input
                    id="bulk-shift"
                    aria-label="Flytta antal minuter"
                    type="number"
                    step={5}
                    className="w-24 text-center"
                    placeholder="0"
                    value={time.shift}
                    onChange={event => updateTime({ shift: event.target.value })}
                  />
                  <span className="text-sm">min</span>
                  <Button type="button" variant="neutral" size="sm" onClick={() => updateTime({
                    shift: String((Number.isFinite(shiftMinutes) ? shiftMinutes : 0) + 15)
                  })}>
                    +15
                  </Button>
                </div>
              )}
              {timeHint && <p className="text-xs text-gray-600 kron:text-ui-muted">{timeHint}</p>}
            </fieldset>
          ) : (
            <p className="text-xs text-gray-600 kron:text-ui-muted">
              Posterna ligger på olika tider, så tiden går inte att ändra här.
            </p>
          )}

          {renderClearableField('category', 'Uppgift', 'input')}
          {renderClearableField('notes', 'Anteckningar', 'textarea')}

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label>Färg</Label>
              {color ? (
                <button
                  type="button"
                  className="text-xs font-semibold underline underline-offset-2"
                  onClick={() => { setColor(null); setError(null); }}
                >
                  Behåll färgerna
                </button>
              ) : (
                shared.color === null && <span className="text-xs text-ui-muted">Flera färger – orörda tills du väljer</span>
              )}
            </div>
            <ColorPicker
              value={color ?? shared.color ?? DEFAULT_COURSE_COLOR}
              onChange={next => { setColor(next); setError(null); }}
              palette={COURSE_COLOR_PALETTE}
              recentStorageKey={RECENT_CUSTOM_COLORS_KEY}
              maxRecent={MAX_RECENT_CUSTOM_COLORS}
            />
            {pickedColorHint}
          </div>

          {error && (
            <p role="alert" className="border-frame border-ui-line bg-rose-100 kron:bg-ui-paper px-3 py-2 text-sm font-semibold text-rose-900 kron:text-ui-danger">
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
