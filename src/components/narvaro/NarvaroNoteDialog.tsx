'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { PersonNote, Stamp } from '@/utils/narvaro';
import { STAMP_BG } from '@/components/narvaro/stampStyle';

type Props = {
  name: string | null;
  note: PersonNote;
  stamps: readonly Stamp[];
  /** Personen lades till för hand och kan tas bort ur passet. */
  added: boolean;
  onToggleStamp: (stampId: string) => void;
  /** Sparar texten. Anropas när dialogen stängs. */
  onClose: (text: string) => void;
  onRemove: () => void;
};

/** Stämplar och fritext för en person i passet. Texten sparas när dialogen stängs. */
export function NarvaroNoteDialog({ name, note, stamps, added, onToggleStamp, onClose, onRemove }: Props) {
  const [text, setText] = useState(note.note);
  useEffect(() => { if (name) setText(note.note); }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={name !== null} onOpenChange={open => { if (!open) onClose(text.trim()); }}>
      {/* Rubriken är personens namn, så platsen minns under en fast nyckel. */}
      <DialogContent positionKey="narvaro-notering" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {stamps.map(s => (
            <button
              key={s.id}
              type="button"
              aria-pressed={note.tags.includes(s.id)}
              onClick={() => onToggleStamp(s.id)}
              className={cn(
                'rounded-ui-sm border-frame border-ui-line px-3 py-1 text-sm font-semibold text-ui-mark-fg',
                STAMP_BG[s.color],
                note.tags.includes(s.id) ? 'ring-2 ring-[var(--ui-focus)] ring-offset-2' : 'opacity-70 hover:opacity-100',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Notering
          <Textarea
            id="narvaro-note"
            rows={3}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Till exempel: ledde diskussionen om kapitel 3"
            autoFocus
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          {added
            ? <button type="button" className="text-sm font-semibold text-ui-muted underline" onClick={onRemove}>Ta bort från passet</button>
            : <span />}
          <Button className="sp-btn" onClick={() => onClose(text.trim())}>Klar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
