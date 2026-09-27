'use client';

import React from 'react';
import {
  COURSE_COLOR_PALETTE,
  DEFAULT_COURSE_COLOR,
  MAX_RECENT_CUSTOM_COLORS,
  RECENT_CUSTOM_COLORS_KEY,
} from '@/config/plannerConstants';
import { SmartTextInput } from '@/components/ui/SmartTextInput';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ColorTriggerRule, RoomTriggerRule, ScheduledEntry } from '@/types/schedule';
import { submitOnCtrlEnter } from '@/utils/dom';
import { ColorTriggerHint, RoomTriggerHint } from './TriggerHints';

type EntryEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: ScheduledEntry | null;
  onEntryChange: (entry: ScheduledEntry) => void;
  onSave: (event: React.FormEvent) => void;
  teachers: string[];
  rooms: string[];
  colorTriggers: ColorTriggerRule[];
  roomTriggers: RoomTriggerRule[];
};

/** Ändra en post som redan ligger i schemat. */
export function EntryEditorDialog({
  open,
  onOpenChange,
  entry,
  onEntryChange,
  onSave,
  teachers,
  rooms,
  colorTriggers,
  roomTriggers,
}: EntryEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Redigera</DialogTitle></DialogHeader>
        {entry && (
          <form onSubmit={onSave} onKeyDown={submitOnCtrlEnter(onSave)} className="space-y-3">
            <div>
              <Label>Titel</Label>
              <Input value={entry.title} onChange={e => onEntryChange({ ...entry, title: e.target.value })} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Start</Label><Input type="time" value={entry.startTime} onChange={e => onEntryChange({ ...entry, startTime: e.target.value })} /></div>
              <div><Label>Slut</Label><Input type="time" value={entry.endTime} onChange={e => onEntryChange({ ...entry, endTime: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SmartTextInput
                fieldId="entry-teacher"
                label="Lärare"
                value={entry.teacher}
                options={teachers}
                onChange={teacher => onEntryChange({ ...entry, teacher })}
              />
              <SmartTextInput
                fieldId="entry-room"
                label="Rum"
                value={entry.room}
                options={rooms}
                onChange={room => onEntryChange({ ...entry, room })}
              />
            </div>
            <RoomTriggerHint title={entry.title} room={entry.room} roomTriggers={roomTriggers} />
            <div className="space-y-1">
              <Label htmlFor="entry-notes">Anteckningar:</Label>
              <Textarea
                id="entry-notes"
                placeholder="Anteckningar/övrigt"
                value={entry.notes ?? ''}
                onChange={e => onEntryChange({ ...entry, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="entry-category">Uppgift:</Label>
              <Input
                id="entry-category"
                placeholder="Klistra in uppgiftslänk eller skriv en kort markering"
                value={entry.category ?? ''}
                onChange={e => onEntryChange({ ...entry, category: e.target.value })}
              />
            </div>
            <ColorTriggerHint title={entry.title} colorTriggers={colorTriggers} />
            <ColorPicker
              value={entry.color || DEFAULT_COURSE_COLOR}
              onChange={color => onEntryChange({ ...entry, color })}
              palette={COURSE_COLOR_PALETTE}
              recentStorageKey={RECENT_CUSTOM_COLORS_KEY}
              maxRecent={MAX_RECENT_CUSTOM_COLORS}
            />
            <DialogFooter><Button type="submit">Uppdatera</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
