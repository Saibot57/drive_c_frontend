'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ThemeArea, ThemeBlock, ThemeWheel } from '@/types/themeWheel';
import { WheelWeek } from '@/utils/themeWheelWeeks';
import { MAX_WEEK_COUNT, MIN_WEEK_COUNT } from '@/components/theme-wheel/constants';
import { ThemeColorPicker } from '@/components/theme-wheel/ThemeColorPicker';
import { generateBoxColor } from '@/config/colorManagement';

type ThemeWheelModalsProps = {
  weeks: WheelWeek[];
  /** Har användaren valt färg själv? Då slutar titeln styra den. */
  manualColor: boolean;
  setManualColor: React.Dispatch<React.SetStateAction<boolean>>;

  editingArea: ThemeArea | null;
  setEditingArea: React.Dispatch<React.SetStateAction<ThemeArea | null>>;
  onSaveArea: (event: React.FormEvent) => void;
  onCloseArea: () => void;

  editingBlock: ThemeBlock | null;
  setEditingBlock: React.Dispatch<React.SetStateAction<ThemeBlock | null>>;
  onSaveBlock: (event: React.FormEvent) => void;
  onCloseBlock: () => void;
  onDeleteBlock: (instanceId: string) => void;
  /** Falskt när blocket ännu inte lagts till – då finns inget att ta bort. */
  isExistingBlock: boolean;
  /** Arbetsområdet blocket är ett delområde av, om det är ett delområde. */
  blockParent: ThemeBlock | null;

  editingSettings: ThemeWheel | null;
  setEditingSettings: React.Dispatch<React.SetStateAction<ThemeWheel | null>>;
  onSaveSettings: (event: React.FormEvent) => void;
  onCloseSettings: () => void;

  deleteAreaName: string | null;
  onCancelDeleteArea: () => void;
  onConfirmDeleteArea: () => void;
};

const ctrlEnter = (submit: (event: React.FormEvent) => void) =>
  (event: React.KeyboardEvent<HTMLFormElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      submit(event as unknown as React.FormEvent);
    }
  };

const selectClassName = 'sp-input h-10 w-full rounded-md bg-white px-3 text-sm';

export function ThemeWheelModals({
  weeks,
  manualColor,
  setManualColor,
  editingArea,
  setEditingArea,
  onSaveArea,
  onCloseArea,
  editingBlock,
  setEditingBlock,
  onSaveBlock,
  onCloseBlock,
  onDeleteBlock,
  isExistingBlock,
  blockParent,
  editingSettings,
  setEditingSettings,
  onSaveSettings,
  onCloseSettings,
  deleteAreaName,
  onCancelDeleteArea,
  onConfirmDeleteArea,
}: ThemeWheelModalsProps) {
  // Ett delområde får bara välja bland förälderns veckor.
  const selectableWeeks = blockParent
    ? weeks.filter(week => week.index >= blockParent.startWeek && week.index <= blockParent.endWeek)
    : weeks;

  return (
    <>
      <Dialog open={Boolean(editingArea)} onOpenChange={open => { if (!open) onCloseArea(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Arbetsområde</DialogTitle></DialogHeader>
          {editingArea && (
            <form onSubmit={onSaveArea} onKeyDown={ctrlEnter(onSaveArea)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="area-title">Namn</Label>
                <Input
                  id="area-title"
                  value={editingArea.title}
                  onChange={event => {
                    const title = event.target.value;
                    setEditingArea({
                      ...editingArea,
                      title,
                      color: manualColor || title.length < 2
                        ? editingArea.color
                        : generateBoxColor(title),
                    });
                  }}
                  className="sp-input"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="area-comment">Kommentar (valfri)</Label>
                <Input
                  id="area-comment"
                  value={editingArea.comment ?? ''}
                  onChange={event => setEditingArea({ ...editingArea, comment: event.target.value })}
                  placeholder="Kort text som visas i hjulet"
                  className="sp-input"
                />
              </div>
              <ThemeColorPicker
                value={editingArea.color}
                onChange={color => { setManualColor(true); setEditingArea({ ...editingArea, color }); }}
              />
              <DialogFooter>
                <Button type="submit" disabled={!editingArea.title.trim()}>Spara</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingBlock)} onOpenChange={open => { if (!open) onCloseBlock(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{blockParent ? 'Delområde' : 'Arbetsområde i hjulet'}</DialogTitle>
          </DialogHeader>
          {editingBlock && (
            <form onSubmit={onSaveBlock} onKeyDown={ctrlEnter(onSaveBlock)} className="space-y-3">
              {blockParent && (
                <p className="flex items-center gap-2 text-xs text-gray-600">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-black"
                    style={{ backgroundColor: blockParent.color }}
                  />
                  Ligger inom &quot;{blockParent.title}&quot; och kan bara sträcka sig över dess veckor.
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="block-title">Namn</Label>
                <Input
                  id="block-title"
                  value={editingBlock.title}
                  onChange={event => {
                    const title = event.target.value;
                    setEditingBlock({
                      ...editingBlock,
                      title,
                      color: manualColor || title.length < 2
                        ? editingBlock.color
                        : generateBoxColor(title),
                    });
                  }}
                  className="sp-input"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="block-start">Från</Label>
                  <select
                    id="block-start"
                    className={selectClassName}
                    value={editingBlock.startWeek}
                    onChange={event => {
                      const startWeek = Number(event.target.value);
                      setEditingBlock({
                        ...editingBlock,
                        startWeek,
                        endWeek: Math.max(editingBlock.endWeek, startWeek),
                      });
                    }}
                  >
                    {selectableWeeks.map(week => (
                      <option key={week.index} value={week.index}>{week.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="block-end">Till och med</Label>
                  <select
                    id="block-end"
                    className={selectClassName}
                    value={editingBlock.endWeek}
                    onChange={event => {
                      const endWeek = Number(event.target.value);
                      setEditingBlock({
                        ...editingBlock,
                        endWeek,
                        startWeek: Math.min(editingBlock.startWeek, endWeek),
                      });
                    }}
                  >
                    {selectableWeeks.map(week => (
                      <option key={week.index} value={week.index}>{week.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="block-comment">Kommentar (valfri)</Label>
                <Textarea
                  id="block-comment"
                  value={editingBlock.comment ?? ''}
                  onChange={event => setEditingBlock({ ...editingBlock, comment: event.target.value })}
                  placeholder="Visas under namnet när ringen är hög nog"
                  rows={2}
                />
              </div>

              <div className="space-y-2 rounded border-2 border-black/10 p-3">
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={Boolean(editingBlock.milestone)}
                    onChange={event => setEditingBlock({
                      ...editingBlock,
                      milestone: event.target.checked
                        ? { label: 'Inlämning', week: editingBlock.endWeek }
                        : undefined,
                    })}
                  />
                  Examination eller deadline
                </label>
                {editingBlock.milestone && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="milestone-label">Vad</Label>
                      <Input
                        id="milestone-label"
                        value={editingBlock.milestone.label}
                        onChange={event => setEditingBlock({
                          ...editingBlock,
                          milestone: { ...editingBlock.milestone!, label: event.target.value },
                        })}
                        className="sp-input"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="milestone-week">Vecka</Label>
                      <select
                        id="milestone-week"
                        className={selectClassName}
                        value={editingBlock.milestone.week}
                        onChange={event => setEditingBlock({
                          ...editingBlock,
                          milestone: { ...editingBlock.milestone!, week: Number(event.target.value) },
                        })}
                      >
                        {weeks
                          .filter(week => week.index >= editingBlock.startWeek && week.index <= editingBlock.endWeek)
                          .map(week => (
                            <option key={week.index} value={week.index}>{week.label}</option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="milestone-date">Datum</Label>
                      <Input
                        id="milestone-date"
                        type="date"
                        value={editingBlock.milestone.date ?? ''}
                        onChange={event => setEditingBlock({
                          ...editingBlock,
                          milestone: { ...editingBlock.milestone!, date: event.target.value || undefined },
                        })}
                        className="sp-input"
                      />
                    </div>
                  </div>
                )}
              </div>

              <ThemeColorPicker
                value={editingBlock.color}
                onChange={color => { setManualColor(true); setEditingBlock({ ...editingBlock, color }); }}
              />

              <DialogFooter className="gap-2">
                {isExistingBlock && (
                  <Button
                    type="button"
                    variant="neutral"
                    className="sp-btn bg-rose-100 text-rose-800 hover:bg-rose-200"
                    onClick={() => onDeleteBlock(editingBlock.instanceId)}
                  >
                    Ta bort
                  </Button>
                )}
                <Button type="submit" disabled={!editingBlock.title.trim()}>Spara</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingSettings)} onOpenChange={open => { if (!open) onCloseSettings(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hjulets inställningar</DialogTitle></DialogHeader>
          {editingSettings && (
            <form onSubmit={onSaveSettings} onKeyDown={ctrlEnter(onSaveSettings)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="wheel-name">Namn</Label>
                <Input
                  id="wheel-name"
                  value={editingSettings.name}
                  onChange={event => setEditingSettings({ ...editingSettings, name: event.target.value })}
                  className="sp-input"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="wheel-start-week">Startvecka</Label>
                  <Input
                    id="wheel-start-week"
                    type="number"
                    min={1}
                    max={53}
                    value={editingSettings.startWeek}
                    onChange={event => setEditingSettings({
                      ...editingSettings,
                      startWeek: Math.min(Math.max(Number(event.target.value) || 1, 1), 53),
                    })}
                    className="sp-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wheel-start-year">År</Label>
                  <Input
                    id="wheel-start-year"
                    type="number"
                    value={editingSettings.startYear}
                    onChange={event => setEditingSettings({
                      ...editingSettings,
                      startYear: Number(event.target.value) || editingSettings.startYear,
                    })}
                    className="sp-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wheel-week-count">Antal veckor</Label>
                  <Input
                    id="wheel-week-count"
                    type="number"
                    min={MIN_WEEK_COUNT}
                    max={MAX_WEEK_COUNT}
                    value={editingSettings.weekCount}
                    onChange={event => setEditingSettings({
                      ...editingSettings,
                      weekCount: Math.min(
                        Math.max(Number(event.target.value) || MIN_WEEK_COUNT, MIN_WEEK_COUNT),
                        MAX_WEEK_COUNT
                      ),
                    })}
                    className="sp-input"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Arbetsområdena ligger på hjulets veckonummer, inte på kalendern. Byter du
                startvecka följer hela temat med.
              </p>
              <DialogFooter>
                <Button type="submit" disabled={!editingSettings.name.trim()}>Spara</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteAreaName)} onOpenChange={open => { if (!open) onCancelDeleteArea(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ta bort arbetsområde?</DialogTitle></DialogHeader>
          <p className="text-sm">
            &quot;{deleteAreaName}&quot; tas bort ur biblioteket. Det som redan ligger i hjulet
            påverkas inte.
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="neutral" className="sp-btn" onClick={onCancelDeleteArea}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="neutral"
              className="sp-btn bg-rose-100 text-rose-800 hover:bg-rose-200"
              onClick={onConfirmDeleteArea}
            >
              Ta bort
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
