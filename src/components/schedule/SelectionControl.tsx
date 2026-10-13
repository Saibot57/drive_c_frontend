'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uiTint } from '@/components/ui/tints';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/schedule/dialogs/ConfirmDialog';
import { PLANNER_DAYS } from '@/config/plannerConstants';
import { ScheduledEntry } from '@/types/schedule';
import {
  buildSelectionRows,
  isInSelection,
  passKey,
  ScheduleSelection,
  setAllVisible,
  setPassVisible,
  setTitleVisible,
} from '@/utils/scheduleSelection';

type SelectionControlProps = {
  schedule: ScheduledEntry[];
  selections: ScheduleSelection[];
  activeSelection: ScheduleSelection | null;
  /** Listan över förkryssade titlar i Inställningar. */
  defaults: string[];
  onActivate: (id: string | null) => void;
  onAdd: (name: string) => ScheduleSelection;
  onUpdate: (next: ScheduleSelection) => void;
  onRemove: (id: string) => void;
};

/**
 * Ögat i verktygsfältet: välj vilka pass en deltagare ska se. Medan ett urval
 * visas är knappen märkt med dess namn och har ett kryss bredvid sig som visar
 * hela schemat igen — ett halvtomt, låst schema ska aldrig se ut som vanligt.
 *
 * Ändringar i rutan sparas direkt. Visas urvalet redan ändras schemat bakom
 * rutan medan man kryssar.
 */
export function SelectionControl({
  schedule,
  selections,
  activeSelection,
  defaults,
  onActivate,
  onAdd,
  onUpdate,
  onRemove,
}: SelectionControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);

  const editing = selections.find(selection => selection.id === editingId) ?? null;

  const open = () => {
    const start = activeSelection ?? selections[0] ?? null;
    setEditingId(start?.id ?? null);
    setIsCreating(start === null);
    setNewName('');
    setExpanded(new Set());
    setIsOpen(true);
  };

  const rows = useMemo(
    () => (editing ? buildSelectionRows(schedule, editing, defaults, PLANNER_DAYS) : []),
    [schedule, editing, defaults]
  );
  const visibleTotal = rows.reduce((sum, row) => sum + row.visibleCount, 0);
  const newCount = rows.filter(row => row.isNew).length;

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const created = onAdd(name);
    setEditingId(created.id);
    setIsCreating(false);
    setNewName('');
  };

  const toggleExpanded = (title: string) => {
    setExpanded(previous => {
      const next = new Set(previous);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const isEditingActive = Boolean(editing && activeSelection?.id === editing.id);

  return (
    <>
      <span className="flex items-center">
        <Button
          variant="neutral"
          onClick={open}
          className={`sp-btn ${activeSelection ? uiTint.info : ''}`}
          title={activeSelection
            ? `Visar bara ${activeSelection.name}s pass. Schemat är låst tills du visar alla igen.`
            : 'Visa bara de pass en deltagare ska gå på, inför en export.'}
          aria-label={activeSelection ? `Urval: ${activeSelection.name}` : 'Urval'}
        >
          <Eye size={16} className={activeSelection ? 'mr-2' : ''} />
          {activeSelection && <span className="max-w-[140px] truncate">{activeSelection.name}</span>}
        </Button>
        {activeSelection && (
          <Button
            variant="neutral"
            onClick={() => onActivate(null)}
            className="sp-btn ml-1 px-2"
            title="Visa alla pass igen"
            aria-label="Visa alla pass igen"
          >
            <X size={16} />
          </Button>
        )}
      </span>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-lg flex-col">
          <DialogHeader>
            <DialogTitle>Urval</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-ui-muted">
            Visa bara de pass en deltagare ska gå på. Det som väljs bort tar ingen plats,
            och exporten blir som det du ser. Schemat är låst medan ett urval visas.
          </p>

          <div className="flex items-end gap-2">
            {isCreating ? (
              <form
                className="flex flex-1 items-end gap-2"
                onSubmit={event => { event.preventDefault(); handleCreate(); }}
              >
                <div className="flex-1">
                  <Label htmlFor="selection-new-name">Namn på urvalet</Label>
                  <Input
                    id="selection-new-name"
                    autoFocus
                    value={newName}
                    onChange={event => setNewName(event.target.value)}
                    placeholder="Anna"
                    className="mt-1 h-9"
                  />
                </div>
                <Button type="submit" disabled={!newName.trim()} className="h-9">Skapa</Button>
                {selections.length > 0 && (
                  <Button type="button" variant="neutral" className="h-9" onClick={() => setIsCreating(false)}>
                    Avbryt
                  </Button>
                )}
              </form>
            ) : (
              <>
                <div className="flex-1">
                  <Label htmlFor="selection-picker">Urval</Label>
                  <select
                    id="selection-picker"
                    className="mt-1 h-9 w-full rounded border-frame border-ui-line bg-ui-paper px-2"
                    value={editingId ?? ''}
                    onChange={event => { setEditingId(event.target.value); setExpanded(new Set()); }}
                  >
                    {selections.map(selection => (
                      <option key={selection.id} value={selection.id}>{selection.name}</option>
                    ))}
                  </select>
                </div>
                <Button type="button" variant="neutral" className="h-9" onClick={() => setIsCreating(true)}>
                  Nytt…
                </Button>
                {editing && (
                  <Button
                    type="button"
                    variant="neutral"
                    className="h-9 px-2"
                    onClick={() => setConfirmRemove(true)}
                    title={`Ta bort ${editing.name}`}
                    aria-label={`Ta bort ${editing.name}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </>
            )}
          </div>

          {editing && !isCreating && (
            <>
              <div className="flex items-center justify-between gap-2 text-xs text-ui-muted">
                <span>
                  {visibleTotal} av {schedule.length} pass syns
                  {newCount > 0 && ` · ${newCount} ${newCount === 1 ? 'ny titel' : 'nya titlar'} sedan sist`}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    className="rounded px-2 py-1 font-bold sp-menu-item"
                    onClick={() => onUpdate(setAllVisible(editing, schedule, defaults, true))}
                  >
                    Alla
                  </button>
                  <button
                    type="button"
                    className="rounded px-2 py-1 font-bold sp-menu-item"
                    onClick={() => onUpdate(setAllVisible(editing, schedule, defaults, false))}
                  >
                    Inga
                  </button>
                </span>
              </div>

              <ul className="min-h-0 flex-1 overflow-y-auto rounded border-frame border-ui-line">
                {rows.length === 0 && (
                  <li className="px-3 py-2 text-sm italic text-ui-muted">Schemat har inga pass.</li>
                )}
                {rows.map(row => {
                  const isExpanded = expanded.has(row.title);
                  const state = row.visibleCount === 0
                    ? false
                    : row.visibleCount === row.entries.length ? true : 'mixed';
                  return (
                    <li key={row.title} className="border-b border-ui-line last:border-b-0">
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <button
                          type="button"
                          className="rounded p-0.5 text-ui-muted sp-menu-item"
                          onClick={() => toggleExpanded(row.title)}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Dölj' : 'Visa'} passen för ${row.title}`}
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                          <TriStateCheckbox
                            state={state}
                            onChange={() => onUpdate(setTitleVisible(editing, schedule, defaults, row.title, state !== true))}
                          />
                          <span className="truncate font-bold">{row.title}</span>
                          {row.isNew && (
                            <span className={`rounded px-1 text-2xs font-bold ${uiTint.warning}`}>ny</span>
                          )}
                        </label>
                        <span className="shrink-0 text-xs text-ui-muted">
                          {state === 'mixed' ? `${row.visibleCount} av ${row.entries.length}` : `${row.entries.length}`} pass
                        </span>
                      </div>
                      {isExpanded && (
                        <ul className="pb-1.5 pl-9 pr-2">
                          {row.entries.map(entry => {
                            const visible = isInSelection(editing, entry, defaults);
                            const details = [entry.teacher, entry.room].filter(Boolean).join(' · ');
                            return (
                              <li key={entry.instanceId}>
                                <label className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={visible}
                                    onChange={() => onUpdate(setPassVisible(editing, schedule, defaults, entry, !visible))}
                                  />
                                  <span className="font-mono text-xs">
                                    {entry.day.slice(0, 3)} {entry.startTime}–{entry.endTime}
                                  </span>
                                  {details && <span className="truncate text-xs text-ui-muted">{details}</span>}
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <DialogFooter className="shrink-0">
            {activeSelection && (
              <Button variant="neutral" onClick={() => { onActivate(null); setIsOpen(false); }}>
                Visa alla
              </Button>
            )}
            {editing && !isCreating && !isEditingActive && (
              <Button onClick={() => { onActivate(editing.id); setIsOpen(false); }}>
                Visa {editing.name}
              </Button>
            )}
            {(isEditingActive || !editing || isCreating) && (
              <Button variant="neutral" onClick={() => setIsOpen(false)}>Stäng</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && (
        <ConfirmDialog
          open={confirmRemove}
          onOpenChange={setConfirmRemove}
          title="Ta bort urvalet?"
          confirmLabel="Ta bort"
          destructive
          onConfirm={() => {
            const remaining = selections.filter(selection => selection.id !== editing.id);
            onRemove(editing.id);
            setEditingId(remaining[0]?.id ?? null);
            setIsCreating(remaining.length === 0);
            setConfirmRemove(false);
          }}
        >
          <p className="text-sm">
            {editing.name} försvinner för gott. Schemat påverkas inte.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

/** En vanlig kryssruta som också kan visa "några av passen". */
function TriStateCheckbox({ state, onChange }: { state: boolean | 'mixed'; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'mixed';
  }, [state]);
  return <input ref={ref} type="checkbox" checked={state === true} onChange={onChange} />;
}
