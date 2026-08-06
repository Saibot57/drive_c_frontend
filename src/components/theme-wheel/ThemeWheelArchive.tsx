'use client';

import React, { useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, Copy, Plus, Share2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeWheelSummary } from '@/types/themeWheel';
import { isoWeekYear } from '@/utils/dateSv';
import { MAX_START_WEEK, MIN_START_WEEK } from '@/components/theme-wheel/constants';

type DuplicateState = { id: string; name: string; startWeek: number; startYear: number };
type ShareState = { id: string; name: string; recipient: string };

type ThemeWheelArchiveProps = {
  wheels: ThemeWheelSummary[];
  activeId: string;
  isBusy: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelect: (id: string) => void;
  onCreate: (name: string, startWeek: number, startYear: number) => void;
  onDuplicate: (id: string, options: { name: string; startWeek: number; startYear: number }) => void;
  onDelete: (id: string) => void;
  onShare: (id: string, toUsername: string) => Promise<boolean>;
};

const clampWeek = (value: number) => (
  Math.min(Math.max(value || MIN_START_WEEK, MIN_START_WEEK), MAX_START_WEEK)
);

/**
 * Sparade hjul. Motsvarar schemaplanerarens "Sparade Veckor": välj, skapa,
 * duplicera, dela och ta bort.
 */
export function ThemeWheelArchive({
  wheels,
  activeId,
  isBusy,
  collapsed,
  onToggleCollapsed,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  onShare,
}: ThemeWheelArchiveProps) {
  const today = isoWeekYear(new Date());
  const [newWheel, setNewWheel] = useState<{ name: string; startWeek: number; startYear: number } | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateState | null>(null);
  const [share, setShare] = useState<ShareState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ThemeWheelSummary | null>(null);

  return (
    <div className={`hidden lg:flex flex-col gap-4 transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[300px]'}`}>
      <div className={`sp-card flex flex-1 flex-col transition-all duration-300 ${collapsed ? 'p-2' : 'p-4'}`}>
        <div className={`flex ${collapsed ? 'flex-col items-center gap-3' : 'mb-4 items-center justify-between'}`}>
          <h2 className={`flex items-center gap-2 font-bold ${collapsed ? 'sr-only' : ''}`}>
            <Archive size={18} /> Sparade hjul
          </h2>
          <Button
            size="sm"
            variant="neutral"
            onClick={onToggleCollapsed}
            className="h-8 w-8 p-0 sp-btn"
            aria-label={collapsed ? 'Visa sparade hjul' : 'Dölj sparade hjul'}
          >
            {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </Button>
          {collapsed && <Archive size={18} />}
        </div>

        {!collapsed && (
          <div className="flex flex-1 flex-col gap-4">
            <Button
              variant="neutral"
              disabled={isBusy}
              onClick={() => setNewWheel({ name: '', startWeek: today.week, startYear: today.year })}
              className="w-full sp-btn bg-emerald-100 hover:bg-emerald-200"
            >
              <Plus size={14} className="mr-2" /> Nytt hjul
            </Button>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {wheels.length === 0 ? (
                <p className="text-sm italic text-gray-500">Inga sparade hjul ännu.</p>
              ) : (
                wheels.map(item => (
                  <div key={item.id} className="sp-archive-card flex items-center gap-2 p-3">
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      disabled={isBusy}
                      className="min-w-0 flex-1 text-left disabled:opacity-50"
                    >
                      <span className="block break-words text-sm font-bold leading-tight">
                        {item.name}{item.id === activeId ? ' • aktiv' : ''}
                      </span>
                      <span className="text-2xs text-gray-500">
                        v.{item.startWeek} · {item.weekCount} veckor
                      </span>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="neutral"
                        onClick={() => setDuplicate({
                          id: item.id,
                          name: `${item.name} (kopia)`,
                          startWeek: item.startWeek,
                          startYear: item.startYear,
                        })}
                        className="h-8 w-8 p-0 sp-btn bg-indigo-100 hover:bg-indigo-200"
                        aria-label={`Duplicera ${item.name}`}
                        title={`Duplicera ${item.name}`}
                      >
                        <Copy size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="neutral"
                        onClick={() => setShare({ id: item.id, name: item.name, recipient: '' })}
                        className="h-8 w-8 p-0 sp-btn bg-emerald-100 hover:bg-emerald-200"
                        aria-label={`Dela ${item.name}`}
                        title={`Dela ${item.name}`}
                      >
                        <Share2 size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="neutral"
                        onClick={() => setPendingDelete(item)}
                        className="h-8 w-8 p-0 sp-btn bg-rose-100 text-rose-800 hover:bg-rose-200"
                        aria-label={`Ta bort ${item.name}`}
                        title={`Ta bort ${item.name}`}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={Boolean(newWheel)} onOpenChange={open => { if (!open) setNewWheel(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nytt hjul</DialogTitle></DialogHeader>
          {newWheel && (
            <form
              className="space-y-3"
              onSubmit={event => {
                event.preventDefault();
                onCreate(newWheel.name.trim(), clampWeek(newWheel.startWeek), newWheel.startYear);
                setNewWheel(null);
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="new-wheel-name">Namn</Label>
                <Input
                  id="new-wheel-name"
                  value={newWheel.name}
                  onChange={event => setNewWheel({ ...newWheel, name: event.target.value })}
                  placeholder="Svenska 1 HT26"
                  className="sp-input"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="new-wheel-week">Startvecka</Label>
                  <Input
                    id="new-wheel-week"
                    type="number"
                    min={MIN_START_WEEK}
                    max={MAX_START_WEEK}
                    value={newWheel.startWeek}
                    onChange={event => setNewWheel({ ...newWheel, startWeek: Number(event.target.value) })}
                    className="sp-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-wheel-year">År</Label>
                  <Input
                    id="new-wheel-year"
                    type="number"
                    value={newWheel.startYear}
                    onChange={event => setNewWheel({ ...newWheel, startYear: Number(event.target.value) })}
                    className="sp-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!newWheel.name.trim() || isBusy}>Skapa</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(duplicate)} onOpenChange={open => { if (!open) setDuplicate(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Duplicera hjul</DialogTitle></DialogHeader>
          {duplicate && (
            <form
              className="space-y-3"
              onSubmit={event => {
                event.preventDefault();
                onDuplicate(duplicate.id, {
                  name: duplicate.name.trim(),
                  startWeek: clampWeek(duplicate.startWeek),
                  startYear: duplicate.startYear,
                });
                setDuplicate(null);
              }}
            >
              <p className="text-sm text-gray-600">
                Arbetsområdena ligger på hjulets veckonummer, så kopian kan flyttas till en
                annan termin genom att ändra startveckan.
              </p>
              <div className="space-y-1">
                <Label htmlFor="duplicate-name">Namn</Label>
                <Input
                  id="duplicate-name"
                  value={duplicate.name}
                  onChange={event => setDuplicate({ ...duplicate, name: event.target.value })}
                  className="sp-input"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="duplicate-week">Startvecka</Label>
                  <Input
                    id="duplicate-week"
                    type="number"
                    min={MIN_START_WEEK}
                    max={MAX_START_WEEK}
                    value={duplicate.startWeek}
                    onChange={event => setDuplicate({ ...duplicate, startWeek: Number(event.target.value) })}
                    className="sp-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="duplicate-year">År</Label>
                  <Input
                    id="duplicate-year"
                    type="number"
                    value={duplicate.startYear}
                    onChange={event => setDuplicate({ ...duplicate, startYear: Number(event.target.value) })}
                    className="sp-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!duplicate.name.trim() || isBusy}>Duplicera</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(share)} onOpenChange={open => { if (!open) setShare(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dela hjul</DialogTitle></DialogHeader>
          {share && (
            <form
              className="space-y-3"
              onSubmit={async event => {
                event.preventDefault();
                const sent = await onShare(share.id, share.recipient.trim());
                if (sent) setShare(null);
              }}
            >
              <p className="text-sm text-gray-600">
                &quot;{share.name}&quot; kopieras till mottagarens konto. Det blir en egen kopia –
                era ändringar påverkar inte varandra.
              </p>
              <div className="space-y-1">
                <Label htmlFor="share-recipient">Användarnamn</Label>
                <Input
                  id="share-recipient"
                  value={share.recipient}
                  onChange={event => setShare({ ...share, recipient: event.target.value })}
                  className="sp-input"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!share.recipient.trim() || isBusy}>Dela</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingDelete)} onOpenChange={open => { if (!open) setPendingDelete(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ta bort hjul?</DialogTitle></DialogHeader>
          <p className="text-sm">
            &quot;{pendingDelete?.name}&quot; tas bort med sina arbetsområden.
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="neutral" className="sp-btn" onClick={() => setPendingDelete(null)}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="neutral"
              disabled={isBusy}
              className="sp-btn bg-rose-100 text-rose-800 hover:bg-rose-200"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Ta bort
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
