'use client';

import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Network, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActiveLamp } from '@/components/ui/ActiveLamp';
import { cn } from '@/lib/utils';
import type { MindmapSync } from '@/hooks/useMindmapSync';
import type { MindmapSummary } from '@/types/mindmapDoc';
import { MAX_MINDMAPS, MAX_MINDMAP_NAME_LENGTH } from '@/types/mindmapDoc';
import { changedLabel } from '@/utils/mindmapDoc';

/**
 * "Sparade kartor": panelen till vänster om kartan. Förebilden är Arbetslags
 * "Sparade upplägg", men med sidans tokens i stället för Tailwinds grå.
 * Namnet byts i raden, som där.
 */

type List = Pick<MindmapSync, 'maps' | 'active' | 'busy' | 'open' | 'create' | 'duplicate' | 'rename' | 'remove'>;

export function MindmapList({ list, open, onOpenChange }: {
  list: List;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const collapsed = !open;
  const toggle = () => onOpenChange(!open);
  const full = list.maps.length >= MAX_MINDMAPS;
  const fullTitle = `Du kan ha högst ${MAX_MINDMAPS} kartor. Ta bort en först.`;

  return (
    <aside
      className={cn('flex shrink-0 flex-col transition-all duration-300', collapsed ? 'lg:w-[72px]' : 'lg:w-[300px]')}
      aria-label="Sparade kartor"
    >
      <div className={cn('sp-card flex flex-1 flex-col', collapsed ? 'p-2' : 'p-4')}>
        <div className={cn('flex', collapsed ? 'flex-col items-center gap-3' : 'mb-4 items-center justify-between')}>
          <h2 className={cn('ui-panel-title flex items-center gap-2 font-bold', collapsed && 'sr-only')}>
            <Network size={18} /> Sparade kartor
          </h2>
          <Button
            size="sm"
            variant="neutral"
            onClick={toggle}
            className="sp-btn h-8 w-8 p-0"
            aria-label={collapsed ? 'Visa kartor' : 'Dölj kartor'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </Button>
          {collapsed && (
            <button
              type="button"
              onClick={toggle}
              className="flex flex-col items-center gap-2 rounded-ui-sm px-1 py-2 text-xs font-bold text-ui-ink-2 hover:bg-ui-surface-3"
              title={`${list.maps.length} sparade kartor. Klicka för att visa.`}
            >
              <span className="text-[11px] font-black uppercase tracking-[0.18em] [writing-mode:vertical-rl]">Kartor</span>
              <Network size={18} />
              {list.maps.length}
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <Button
              variant="neutral"
              onClick={() => void list.create()}
              disabled={list.busy || full}
              title={full ? fullTitle : 'En tom karta'}
              className="sp-btn w-full"
            >
              <Plus size={14} className="mr-2" /> Ny karta
            </Button>

            {list.maps.length === 0 && (
              <p className="text-sm text-ui-muted">Inga kartor än. Skapa en, så sparas den här.</p>
            )}

            {/* Listan scrollar inuti panelen och gör aldrig sidan högre. */}
            <div className="lg:relative lg:flex-1">
              <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1 lg:absolute lg:inset-0 lg:max-h-none">
                {list.maps.map((map) => (
                  <MapRow
                    key={map.id}
                    map={map}
                    active={map.id === list.active?.id}
                    busy={list.busy}
                    full={full}
                    fullTitle={fullTitle}
                    list={list}
                  />
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function MapRow({ map, active, busy, full, fullTitle, list }: {
  map: MindmapSummary;
  active: boolean;
  busy: boolean;
  full: boolean;
  fullTitle: string;
  list: List;
}) {
  const [mode, setMode] = useState<'view' | 'rename' | 'confirmDelete'>('view');
  const [draft, setDraft] = useState(map.name);

  // Sant när namnrutan redan är stängd, så att en blur efteråt inte sparar igen.
  const renameDone = useRef(false);

  const startRename = () => { renameDone.current = false; setDraft(map.name); setMode('rename'); };
  const finishRename = (save: boolean) => {
    if (renameDone.current) return;
    renameDone.current = true;
    setMode('view');
    if (save && draft.trim() && draft.trim() !== map.name) void list.rename(map.id, draft);
  };

  return (
    <li className={cn('sp-archive-card flex flex-col gap-2 p-3', active && 'bg-ui-surface-3')}>
      <div className="flex items-start gap-2">
        {mode === 'rename' ? (
          <input
            type="text"
            value={draft}
            autoFocus
            maxLength={MAX_MINDMAP_NAME_LENGTH}
            aria-label="Kartans namn"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => finishRename(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') finishRename(true);
              if (event.key === 'Escape') finishRename(false);
            }}
            className="sp-input min-w-0 flex-1 rounded-ui-sm bg-ui-paper px-2 py-1 text-sm font-bold text-ui-ink"
          />
        ) : (
          <button
            type="button"
            onClick={() => void list.open(map.id)}
            disabled={busy}
            aria-current={active ? 'true' : undefined}
            className="flex min-w-0 flex-1 flex-col items-start text-left disabled:cursor-wait"
          >
            <span className="flex min-w-0 items-center gap-2">
              <ActiveLamp on={active} />
              <span className="break-words text-sm font-bold leading-tight kron:font-medium">
                {map.name}{active && <span className="kron:hidden"> • öppen</span>}
              </span>
              {active && <span className="ui-label hidden text-[10px] kron:inline">Öppen</span>}
            </span>
            <span className="text-[11px] text-ui-muted">{changedLabel(map.updatedAt)}</span>
          </button>
        )}

        {mode === 'view' && (
          <div className="flex shrink-0 gap-1.5">
            <Button size="sm" variant="neutral" onClick={startRename} disabled={busy} className="sp-btn h-8 w-8 p-0" aria-label={`Byt namn på ${map.name}`} title="Byt namn">
              <Pencil size={14} />
            </Button>
            <Button size="sm" variant="neutral" onClick={() => void list.duplicate(map.id)} disabled={busy || full} className="sp-btn h-8 w-8 p-0" aria-label={`Kopiera ${map.name}`} title={full ? fullTitle : 'Kopiera'}>
              <Copy size={14} />
            </Button>
            <Button size="sm" variant="neutral" onClick={() => setMode('confirmDelete')} disabled={busy} className="sp-btn h-8 w-8 p-0 text-ui-danger" aria-label={`Ta bort ${map.name}`} title="Ta bort">
              <Trash2 size={14} />
            </Button>
          </div>
        )}
      </div>

      {mode === 'confirmDelete' && (
        <div className="flex items-center justify-between gap-2 rounded-ui-sm bg-ui-mark-pink px-2 py-1 text-xs text-ui-mark-fg">
          <span className="font-semibold">Ta bort {map.name}? Det går inte att ångra.</span>
          <span className="flex gap-2">
            <button type="button" className="font-bold underline" onClick={() => { setMode('view'); void list.remove(map.id); }}>
              Ja, ta bort
            </button>
            <button type="button" className="font-semibold underline" onClick={() => setMode('view')} autoFocus>Nej</button>
          </span>
        </div>
      )}
    </li>
  );
}
