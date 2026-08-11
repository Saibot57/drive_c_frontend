'use client';

import React, { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { COURSE_COLOR_PALETTE, DEFAULT_COURSE_COLOR, MAX_RECENT_CUSTOM_COLORS, RECENT_CUSTOM_COLORS_KEY } from '@/components/schedule/constants';
import { SmartTextInput } from '@/components/ui/SmartTextInput';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { generateBoxColor } from '@/config/colorManagement';
import { ColorTriggerRule, PlannerArchiveSummary, PlannerCourse, RestrictionRule, ScheduledEntry } from '@/types/schedule';
import { findColorTrigger } from '@/utils/colorTriggers';

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
  colorTriggers: ColorTriggerRule[];
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
  overwriteArchive: PlannerArchiveSummary | null;
  onOverwriteArchiveChange: (value: PlannerArchiveSummary | null) => void;
  onConfirmOverwriteWeek: () => void;
  deleteArchive: PlannerArchiveSummary | null;
  onDeleteArchiveChange: (value: PlannerArchiveSummary | null) => void;
  onConfirmDeleteWeek: () => void;
  shareArchive: PlannerArchiveSummary | null;
  onShareArchiveChange: (value: PlannerArchiveSummary | null) => void;
  shareRecipient: string;
  onShareRecipientChange: (value: string) => void;
  onConfirmShareWeek: () => void;
  onRemoveShare: (username: string) => void;
  onLeaveShare: (archive: PlannerArchiveSummary, username: string) => void;
  onSendCopy: () => void;
  /** Inloggat användarnamn — behövs för att kunna lämna en delning. */
  currentUsername: string | null;
  isSharing: boolean;
  deleteCourseName: string | null;
  onDeleteCourseNameChange: (value: string | null) => void;
  onConfirmDeleteCourse: () => void;
  isClearScheduleConfirmOpen: boolean;
  onClearScheduleConfirmOpenChange: (open: boolean) => void;
  onConfirmClearSchedule: () => void;
  isNewScheduleDialogOpen: boolean;
  onNewScheduleDialogOpenChange: (open: boolean) => void;
  newScheduleName: string;
  onNewScheduleNameChange: (value: string) => void;
  onConfirmCreateNewSchedule: () => void;
  newScheduleNameExists: boolean;
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
  colorTriggers,
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
  overwriteArchive,
  onOverwriteArchiveChange,
  onConfirmOverwriteWeek,
  deleteArchive,
  onDeleteArchiveChange,
  shareArchive,
  onShareArchiveChange,
  shareRecipient,
  onShareRecipientChange,
  onConfirmShareWeek,
  onRemoveShare,
  onLeaveShare,
  onSendCopy,
  currentUsername,
  isSharing,
  onConfirmDeleteWeek,
  deleteCourseName,
  onDeleteCourseNameChange,
  onConfirmDeleteCourse,
  isClearScheduleConfirmOpen,
  onClearScheduleConfirmOpenChange,
  onConfirmClearSchedule,
  isNewScheduleDialogOpen,
  onNewScheduleDialogOpenChange,
  newScheduleName,
  onNewScheduleNameChange,
  onConfirmCreateNewSchedule,
  newScheduleNameExists
}: ScheduleModalsProps) {
  const ctrlEnter = (submit: (e: React.FormEvent) => void) =>
    (e: React.KeyboardEvent<HTMLFormElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submit(e as unknown as React.FormEvent);
      }
    };

  const loadRecentColors = (): string[] => {
    try {
      const raw = localStorage.getItem(RECENT_CUSTOM_COLORS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const [recentColors, setRecentColors] = useState<string[]>(loadRecentColors);

  /**
   * En färgregel slår igenom när kortet ritas, så färgväljaren nedan har ingen
   * synlig effekt så länge titeln matchar. Säg det i stället för att låta
   * användaren undra.
   */
  const activeTrigger = (title: string) => findColorTrigger(title ?? '', colorTriggers);

  const renderTriggerHint = (title: string) => {
    const trigger = activeTrigger(title);
    if (!trigger) return null;
    return (
      <p className="flex items-center gap-2 text-xs text-gray-600">
        <span
          className="h-3 w-3 shrink-0 rounded-full border border-black"
          style={{ backgroundColor: trigger.color }}
        />
        Färgen styrs av färgregeln &quot;{trigger.word}&quot; och går inte att ändra här.
      </p>
    );
  };

  const saveRecentColor = useCallback((color: string) => {
    const paletteSet = new Set(COURSE_COLOR_PALETTE as readonly string[]);
    if (paletteSet.has(color)) return;
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      const updated = [color, ...filtered].slice(0, MAX_RECENT_CUSTOM_COLORS);
      localStorage.setItem(RECENT_CUSTOM_COLORS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <>
      <Dialog open={isCourseModalOpen} onOpenChange={onCourseModalOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hantera ämne</DialogTitle></DialogHeader>
          {editingCourse && (
            <form onSubmit={onSaveCourse} onKeyDown={ctrlEnter(onSaveCourse)} className="space-y-3">
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
              {renderTriggerHint(editingCourse.title)}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <div className="flex gap-2">
                  {COURSE_COLOR_PALETTE.map(c => (
                    <div
                      key={c}
                      onClick={() => {
                        setManualColor(true);
                        setEditingCourse({ ...editingCourse, color: c });
                      }}
                      className={`w-6 h-6 rounded-full cursor-pointer border ${editingCourse.color === c ? 'sp-swatch-ring' : ''}`}
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
                      saveRecentColor(e.target.value);
                    }}
                  />
                </label>
              </div>
              {recentColors.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">Senaste:</span>
                  {recentColors.map(c => (
                    <div
                      key={`recent-${c}`}
                      onClick={() => {
                        setManualColor(true);
                        setEditingCourse({ ...editingCourse, color: c });
                      }}
                      className={`w-6 h-6 rounded-full cursor-pointer border border-dashed border-black/40 ${editingCourse.color === c ? 'sp-swatch-ring' : ''}`}
                      style={{ backgroundColor: c }}
                      title="Senast använda"
                    />
                  ))}
                </div>
              )}
              <DialogFooter><Button type="submit">Spara</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEntryModalOpen} onOpenChange={onEntryModalOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redigera</DialogTitle></DialogHeader>
          {editingEntry && (
            <form onSubmit={onSaveEntry} onKeyDown={ctrlEnter(onSaveEntry)} className="space-y-3">
              <div>
                <Label>Titel</Label>
                <Input value={editingEntry.title} onChange={e => setEditingEntry({ ...editingEntry, title: e.target.value })} autoFocus />
              </div>
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
                <Label htmlFor="entry-notes">Anteckningar:</Label>
                <Textarea
                  id="entry-notes"
                  placeholder="Anteckningar/övrigt"
                  value={editingEntry.notes ?? ''}
                  onChange={e => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="entry-category">Uppgift:</Label>
                <Input
                  id="entry-category"
                  placeholder="Klistra in uppgiftslänk eller skriv en kort markering"
                  value={editingEntry.category ?? ''}
                  onChange={e => setEditingEntry({ ...editingEntry, category: e.target.value })}
                />
              </div>
              {renderTriggerHint(editingEntry.title)}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <div className="flex gap-2">
                  {COURSE_COLOR_PALETTE.map(c => (
                    <div
                      key={c}
                      onClick={() => setEditingEntry({ ...editingEntry, color: c })}
                      className={`w-6 h-6 rounded-full cursor-pointer border ${editingEntry.color === c ? 'sp-swatch-ring' : ''}`}
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
                    onChange={e => {
                      setEditingEntry({ ...editingEntry, color: e.target.value });
                      saveRecentColor(e.target.value);
                    }}
                  />
                </label>
              </div>
              {recentColors.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">Senaste:</span>
                  {recentColors.map(c => (
                    <div
                      key={`recent-${c}`}
                      onClick={() => setEditingEntry({ ...editingEntry, color: c })}
                      className={`w-6 h-6 rounded-full cursor-pointer border border-dashed border-black/40 ${editingEntry.color === c ? 'sp-swatch-ring' : ''}`}
                      style={{ backgroundColor: c }}
                      title="Senast använda"
                    />
                  ))}
                </div>
              )}
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

      <Dialog open={Boolean(overwriteArchive)} onOpenChange={(open) => { if (!open) onOverwriteArchiveChange(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ersätta befintlig vecka?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">Vecka &quot;{overwriteArchive?.name}&quot; finns redan. Vill du skriva över den?</p>
          <DialogFooter>
            <Button variant="neutral" onClick={() => onOverwriteArchiveChange(null)}>Avbryt</Button>
            <Button onClick={onConfirmOverwriteWeek}>Skriv över</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteArchive)} onOpenChange={(open) => { if (!open) onDeleteArchiveChange(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Radera vecka?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">Radera vecka &quot;{deleteArchive?.name}&quot;?</p>
          {/* Radering av ett delat schema drabbar fler än en. */}
          {deleteArchive && deleteArchive.sharedWith.length > 0 && (
            <p className="text-sm font-bold text-rose-800">
              Schemat är delat med {deleteArchive.sharedWith.join(', ')}. Det försvinner för dem också.
            </p>
          )}
          <DialogFooter>
            <Button variant="neutral" onClick={() => onDeleteArchiveChange(null)}>Avbryt</Button>
            <Button className="bg-rose-200 hover:bg-rose-300" onClick={onConfirmDeleteWeek}>Radera</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(shareArchive)} onOpenChange={(open) => { if (!open) onShareArchiveChange(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dela &quot;{shareArchive?.name}&quot;</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <form onSubmit={(e) => { e.preventDefault(); onConfirmShareWeek(); }} className="space-y-3">
              <div>
                <Label>Användarnamn</Label>
                <Input
                  value={shareRecipient}
                  onChange={(e) => onShareRecipientChange(e.target.value)}
                  placeholder="t.ex. hanna"
                  autoFocus
                  autoComplete="off"
                />
              </div>
              <p className="text-xs text-gray-600">
                Ni arbetar i <strong>samma</strong> schema. Ändringar syns för alla nästa gång
                de öppnar det. En i taget — den som har schemat öppet håller det låst.
              </p>
              <Button type="submit" className="w-full" disabled={isSharing || !shareRecipient.trim()}>
                {isSharing ? 'Delar…' : 'Ge tillgång'}
              </Button>
            </form>

            {shareArchive && (
              <div className="space-y-2 border-t-2 border-black pt-3">
                <Label className="text-xs font-bold uppercase text-gray-500">Har tillgång</Label>
                <p className="text-sm">
                  {shareArchive.ownerUsername ?? 'Okänd'}
                  <span className="text-gray-500"> — äger schemat</span>
                </p>
                {shareArchive.sharedWith.length === 0 ? (
                  <p className="text-sm italic text-gray-500">Ingen annan än du ännu.</p>
                ) : (
                  shareArchive.sharedWith.map((username) => (
                    <div key={username} className="flex items-center justify-between gap-2">
                      <span className="text-sm">{username}</span>
                      {shareArchive.isOwner && (
                        <Button
                          size="sm"
                          variant="neutral"
                          className="h-7 bg-rose-100 hover:bg-rose-200 text-rose-800"
                          disabled={isSharing}
                          onClick={() => onRemoveShare(username)}
                        >
                          Ta bort
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Den gamla engångskopian finns kvar: den är rätt verktyg när
                kollegan ska bygga något eget utifrån veckan i stället för att
                arbeta i den. Backend hämtar kopian ur den egna uppsättningen,
                så den erbjuds bara för scheman man äger. */}
            {shareArchive?.isOwner && (
              <div className="space-y-2 border-t-2 border-black pt-3">
                <Label className="text-xs font-bold uppercase text-gray-500">Eller skicka en kopia</Label>
                <p className="text-xs text-gray-600">
                  Mottagaren får en egen version att göra vad de vill med. Dina senare
                  ändringar följer inte med.
                </p>
                <Button
                  type="button"
                  variant="neutral"
                  className="w-full"
                  disabled={isSharing || !shareRecipient.trim()}
                  onClick={onSendCopy}
                >
                  Skicka kopia till {shareRecipient.trim() || '…'}
                </Button>
              </div>
            )}

            {shareArchive && !shareArchive.isOwner && currentUsername && (
              <div className="border-t-2 border-black pt-3">
                <Button
                  type="button"
                  variant="neutral"
                  className="w-full bg-rose-100 hover:bg-rose-200 text-rose-800"
                  disabled={isSharing}
                  onClick={() => onLeaveShare(shareArchive, currentUsername)}
                >
                  Lämna schemat
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="neutral" onClick={() => onShareArchiveChange(null)}>Stäng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteCourseName)} onOpenChange={(open) => { if (!open) onDeleteCourseNameChange(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort byggsten?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">Ta bort byggstenen &quot;{deleteCourseName}&quot;?</p>
          <DialogFooter>
            <Button variant="neutral" onClick={() => onDeleteCourseNameChange(null)}>Avbryt</Button>
            <Button className="bg-rose-200 hover:bg-rose-300" onClick={onConfirmDeleteCourse}>Ta bort</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isClearScheduleConfirmOpen} onOpenChange={onClearScheduleConfirmOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rensa schemat?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">Detta tar bort alla schemaposter från den aktuella vyn.</p>
          <DialogFooter>
            <Button variant="neutral" onClick={() => onClearScheduleConfirmOpenChange(false)}>Avbryt</Button>
            <Button className="bg-rose-200 hover:bg-rose-300" onClick={onConfirmClearSchedule}>Rensa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewScheduleDialogOpen} onOpenChange={onNewScheduleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skapa nytt schema</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); onConfirmCreateNewSchedule(); }} className="space-y-3">
            <div>
              <Label>Namn</Label>
              <Input
                value={newScheduleName}
                onChange={(e) => onNewScheduleNameChange(e.target.value)}
                placeholder="t.ex. v.45 eller Höstlov"
                autoFocus
              />
              {newScheduleNameExists && (
                <p className="text-xs text-rose-600 mt-1">Det finns redan ett schema med det namnet.</p>
              )}
            </div>
            <p className="text-sm text-gray-700">
              Det aktiva schemat ersätts med ett tomt schema. Spara det aktiva schemat först om du vill behålla det.
            </p>
            <DialogFooter>
              <Button variant="neutral" type="button" onClick={() => onNewScheduleDialogOpenChange(false)}>Avbryt</Button>
              <Button type="submit" disabled={!newScheduleName.trim() || newScheduleNameExists}>Skapa</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
