'use client';

import React from 'react';
import { X } from 'lucide-react';
import { COURSE_COLOR_PALETTE, DEFAULT_COURSE_COLOR } from '@/components/schedule/constants';
import { SmartTextInput } from '@/components/ui/SmartTextInput';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { generateBoxColor } from '@/config/colorManagement';
import { PlannerCourse, RestrictionRule, ScheduledEntry } from '@/types/schedule';

type ScheduleModalsProps = {
  isCourseModalOpen: boolean;
  onCourseModalOpenChange: (open: boolean) => void;
  editingCourse: PlannerCourse | null;
  setEditingCourse: React.Dispatch<React.SetStateAction<PlannerCourse | null>>;
  manualColor: boolean;
  setManualColor: React.Dispatch<React.SetStateAction<boolean>>;
  onSaveCourse: (event: React.FormEvent) => void;
  teachers: string[];
  rooms: string[];
  isEntryModalOpen: boolean;
  onEntryModalOpenChange: (open: boolean) => void;
  editingEntry: ScheduledEntry | null;
  setEditingEntry: React.Dispatch<React.SetStateAction<ScheduledEntry | null>>;
  onSaveEntry: (event: React.FormEvent) => void;
  isRestrictionsModalOpen: boolean;
  onRestrictionsModalOpenChange: (open: boolean) => void;
  newRule: RestrictionRule;
  setNewRule: React.Dispatch<React.SetStateAction<RestrictionRule>>;
  restrictions: RestrictionRule[];
  onAddRule: () => void;
  onRemoveRule: (id: string) => void;
  isImportConfirmOpen: boolean;
  onImportConfirmOpenChange: (open: boolean) => void;
  onCancelImport: () => void;
  onConfirmImport: () => void;
  overwriteWeekName: string | null;
  onOverwriteWeekNameChange: (value: string | null) => void;
  onConfirmOverwriteWeek: () => void;
  deleteWeekName: string | null;
  onDeleteWeekNameChange: (value: string | null) => void;
  onConfirmDeleteWeek: () => void;
};

export function ScheduleModals({
  isCourseModalOpen,
  onCourseModalOpenChange,
  editingCourse,
  setEditingCourse,
  manualColor,
  setManualColor,
  onSaveCourse,
  teachers,
  rooms,
  isEntryModalOpen,
  onEntryModalOpenChange,
  editingEntry,
  setEditingEntry,
  onSaveEntry,
  isRestrictionsModalOpen,
  onRestrictionsModalOpenChange,
  newRule,
  setNewRule,
  restrictions,
  onAddRule,
  onRemoveRule,
  isImportConfirmOpen,
  onImportConfirmOpenChange,
  onCancelImport,
  onConfirmImport,
  overwriteWeekName,
  onOverwriteWeekNameChange,
  onConfirmOverwriteWeek,
  deleteWeekName,
  onDeleteWeekNameChange,
  onConfirmDeleteWeek
}: ScheduleModalsProps) {
  return (
    <>
      <Dialog open={isCourseModalOpen} onOpenChange={onCourseModalOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hantera ämne</DialogTitle></DialogHeader>
          {editingCourse && (
            <form onSubmit={onSaveCourse} className="space-y-3">
              <Label>Titel</Label>
              <Input value={editingCourse.title} onChange={e => {
                const val = e.target.value;
                let col = editingCourse.color;
                if (!manualColor && val.length > 1) col = generateBoxColor(val);
                setEditingCourse({ ...editingCourse, title: val, color: col });
              }} autoFocus />
              <Label>Standardlängd (min)</Label> <Input type="number" value={editingCourse.duration} onChange={e => setEditingCourse({ ...editingCourse, duration: parseInt(e.target.value) })} />
              <div className="grid grid-cols-2 gap-2">
                <SmartTextInput
                  fieldId="course-teacher"
                  label="Lärare"
                  value={editingCourse.teacher}
                  options={teachers}
                  onChange={teacher => setEditingCourse({ ...editingCourse, teacher })}
                />
                <SmartTextInput
                  fieldId="course-room"
                  label="Rum"
                  value={editingCourse.room}
                  options={rooms}
                  onChange={room => setEditingCourse({ ...editingCourse, room })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <div className="flex gap-2">
                  {COURSE_COLOR_PALETTE.map(c => (
                    <div
                      key={c}
                      onClick={() => {
                        setManualColor(true);
                        setEditingCourse({ ...editingCourse, color: c });
                      }}
                      className={`w-6 h-6 rounded-full cursor-pointer border ${editingCourse.color === c ? 'ring-2 ring-black' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-gray-700 border border-black/20 rounded px-2 py-1 bg-white/70 hover:bg-white cursor-pointer">
                  <span
                    className="h-4 w-4 rounded-full border border-black"
                    style={{ backgroundColor: editingCourse.color }}
                  />
                  Egen färg
                  <input
                    type="color"
                    className="sr-only"
                    aria-label="Välj egen färg"
                    value={editingCourse.color}
                    onChange={e => {
                      setManualColor(true);
                      setEditingCourse({ ...editingCourse, color: e.target.value });
                    }}
                  />
                </label>
              </div>
              <DialogFooter><Button type="submit">Spara</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEntryModalOpen} onOpenChange={onEntryModalOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redigera Tid</DialogTitle></DialogHeader>
          {editingEntry && (
            <form onSubmit={onSaveEntry} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Start</Label><Input type="time" value={editingEntry.startTime} onChange={e => setEditingEntry({ ...editingEntry, startTime: e.target.value })} /></div>
                <div><Label>Slut</Label><Input type="time" value={editingEntry.endTime} onChange={e => setEditingEntry({ ...editingEntry, endTime: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SmartTextInput
                  fieldId="entry-teacher"
                  label="Lärare"
                  value={editingEntry.teacher}
                  options={teachers}
                  onChange={teacher => setEditingEntry({ ...editingEntry, teacher })}
                />
                <SmartTextInput
                  fieldId="entry-room"
                  label="Rum"
                  value={editingEntry.room}
                  options={rooms}
                  onChange={room => setEditingEntry({ ...editingEntry, room })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="entry-category">Uppgift:</Label>
                <Textarea
                  id="entry-category"
                  placeholder="Klistra in uppgiftslänk eller skriv en kort markering"
                  value={editingEntry.category ?? ''}
                  onChange={e => setEditingEntry({ ...editingEntry, category: e.target.value })}
                  rows={2}
                />
              </div>
              <Input
                aria-label="Anteckningar"
                placeholder="Anteckningar/övrigt"
                value={editingEntry.notes ?? ''}
                onChange={e => setEditingEntry({ ...editingEntry, notes: e.target.value })}
              />
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <div className="flex gap-2">
                  {COURSE_COLOR_PALETTE.map(c => (
                    <div
                      key={c}
                      onClick={() => setEditingEntry({ ...editingEntry, color: c })}
                      className={`w-6 h-6 rounded-full cursor-pointer border ${editingEntry.color === c ? 'ring-2 ring-black' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-gray-700 border border-black/20 rounded px-2 py-1 bg-white/70 hover:bg-white cursor-pointer">
                  <span
                    className="h-4 w-4 rounded-full border border-black"
                    style={{ backgroundColor: editingEntry.color || DEFAULT_COURSE_COLOR }}
                  />
                  Egen färg
                  <input
                    type="color"
                    className="sr-only"
                    aria-label="Välj egen färg"
                    value={editingEntry.color || DEFAULT_COURSE_COLOR}
                    onChange={e => setEditingEntry({ ...editingEntry, color: e.target.value })}
                  />
                </label>
              </div>
              <DialogFooter><Button type="submit">Uppdatera</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isRestrictionsModalOpen} onOpenChange={onRestrictionsModalOpenChange}>
        <DialogContent><DialogHeader><DialogTitle>Regler</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-2"><Input placeholder="Matte*" value={newRule.subjectA} onChange={e => setNewRule({ ...newRule, subjectA: e.target.value })} /><Input placeholder="Svenska*" value={newRule.subjectB} onChange={e => setNewRule({ ...newRule, subjectB: e.target.value })} /><Button onClick={onAddRule}>+</Button></div>
            {restrictions.map(r => <div key={r.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded"><span>{r.subjectA} ⚡ {r.subjectB}</span><X size={14} className="cursor-pointer" onClick={() => onRemoveRule(r.id)} /></div>)}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isImportConfirmOpen}
        onOpenChange={onImportConfirmOpenChange}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ersätta nuvarande schema?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">
            Om du fortsätter ersätts aktuella byggstenar och schema med innehållet från filen.
          </p>
          <DialogFooter>
            <Button variant="neutral" onClick={onCancelImport}>Avbryt</Button>
            <Button onClick={onConfirmImport}>Ersätt schema</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(overwriteWeekName)} onOpenChange={(open) => { if (!open) onOverwriteWeekNameChange(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ersätta befintlig vecka?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">Vecka &quot;{overwriteWeekName}&quot; finns redan. Vill du skriva över den?</p>
          <DialogFooter>
            <Button variant="neutral" onClick={() => onOverwriteWeekNameChange(null)}>Avbryt</Button>
            <Button onClick={onConfirmOverwriteWeek}>Skriv över</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteWeekName)} onOpenChange={(open) => { if (!open) onDeleteWeekNameChange(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Radera vecka?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">Radera vecka &quot;{deleteWeekName}&quot;?</p>
          <DialogFooter>
            <Button variant="neutral" onClick={() => onDeleteWeekNameChange(null)}>Avbryt</Button>
            <Button className="bg-rose-200 hover:bg-rose-300" onClick={onConfirmDeleteWeek}>Radera</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
