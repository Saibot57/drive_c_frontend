'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const sanitizeHiddenList = (input: string) => {
  const lines = input
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  return lines.filter(line => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

type HiddenSettingsPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teachers: string[];
  rooms: string[];
  onSave: (nextTeachers: string[], nextRooms: string[]) => void;
};

export function HiddenSettingsPanel({
  open,
  onOpenChange,
  teachers,
  rooms,
  onSave
}: HiddenSettingsPanelProps) {
  const [teacherText, setTeacherText] = useState('');
  const [roomText, setRoomText] = useState('');

  useEffect(() => {
    if (!open) return;
    setTeacherText(teachers.join('\n'));
    setRoomText(rooms.join('\n'));
  }, [open, rooms, teachers]);

  const handleSave = () => {
    const nextTeachers = sanitizeHiddenList(teacherText);
    const nextRooms = sanitizeHiddenList(roomText);
    onSave(nextTeachers, nextRooms);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hidden settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="hidden-teachers">Lärare (en per rad)</Label>
            <Textarea
              id="hidden-teachers"
              value={teacherText}
              onChange={event => setTeacherText(event.target.value)}
              rows={6}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hidden-rooms">Salar (en per rad)</Label>
            <Textarea
              id="hidden-rooms"
              value={roomText}
              onChange={event => setRoomText(event.target.value)}
              rows={6}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="neutral" onClick={handleSave} className="border-2 border-black">
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
              <p className="text-gray-500">Inga kategorier hittades.</p>
            )}
          </div>
          <div>
            <p className="font-semibold">Aktiviteter utan kategori</p>
            <p>{missingCount} av {totalCount}</p>
          </div>
          {!hasActivities && (
            <p className="text-gray-500">Inga aktiviteter laddade ännu.</p>
          )}
          <p className="text-xs text-gray-500">
            Öppna via Ctrl + Shift + C.
          </p>
        </div>
        <DialogFooter>
          <Button variant="neutral" onClick={() => onOpenChange(false)} className="border-2 border-black">
            Stäng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
