'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePersistentState } from '@/hooks/usePersistentState';
import { moveId } from '@/utils/sortOrder';

/**
 * Terminsplanerarens rutor till höger: flyttbara med dra och släpp,
 * storleksändringsbara och hopfällbara. Layouten sparas per webbläsare.
 *
 * - **Flytta:** dra i rubriken och släpp på en annan ruta. Med tangentbordet:
 *   fokusera greppet och använd piltangenterna.
 * - **Storlek:** dra i hörnet nere till höger. Nedåt/uppåt ändrar höjden,
 *   höger/vänster växlar mellan halv och hel bredd. Dubbelklick återställer
 *   höjden. Med tangentbordet: piltangenterna på hörnet.
 * - **Fäll ihop:** pilen i rubriken.
 *
 * Flytten använder webbläsarens inbyggda dra och släpp, som fungerar i Safari
 * och Chrome på datorn. Pekskärm stöds inte.
 */

export type PanelDef = {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
  /** Bredden första gången. Standard: hel. */
  defaultWide?: boolean;
};

type PanelLayout = {
  id: string;
  collapsed: boolean;
  wide: boolean;
  /** Innehållets höjd i px, eller null för att följa innehållet. */
  height: number | null;
};

const STORAGE_KEY = 'termPlanner.panels.v1';
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 2000;
const HEIGHT_STEP = 40;
/** Så långt i sidled man drar innan bredden växlar. */
const WIDTH_SWITCH_PX = 80;
/** Rutorna står två i bredd från Tailwinds lg-brytpunkt. */
const TWO_COLUMNS_QUERY = '(min-width: 1024px)';

const sanitizeLayout = (raw: unknown): PanelLayout[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const { id, collapsed, wide, height } = item as Record<string, unknown>;
    if (typeof id !== 'string') return [];
    return [{
      id,
      collapsed: collapsed === true,
      wide: wide !== false,
      height: typeof height === 'number' && Number.isFinite(height)
        ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(height)))
        : null,
    }];
  });
};

const NO_LAYOUT: PanelLayout[] = [];

/** Sparad ordning för kända rutor, sedan nya rutor sist. Okända id:n släpps. */
const mergeLayout = (stored: PanelLayout[], panels: PanelDef[]): PanelLayout[] => {
  const known = new Set(panels.map(panel => panel.id));
  const kept = stored.filter(item => known.has(item.id));
  const seen = new Set(kept.map(item => item.id));
  const added = panels
    .filter(panel => !seen.has(panel.id))
    .map(panel => ({ id: panel.id, collapsed: false, wide: panel.defaultWide !== false, height: null }));
  return [...kept, ...added];
};

type DropTarget = { id: string; after: boolean; horizontal: boolean };

export function TermPanels({ panels }: { panels: PanelDef[] }) {
  const [stored, persist] = usePersistentState(STORAGE_KEY, sanitizeLayout, NO_LAYOUT);
  const layout = mergeLayout(stored, panels);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  const bodies = useRef(new Map<string, HTMLElement>());

  const update = useCallback((id: string, changes: Partial<PanelLayout>) => {
    persist(layoutRef.current.map(item => (item.id === id ? { ...item, ...changes } : item)));
  }, [persist]);

  const reorder = useCallback((dragged: string, target: string, after: boolean) => {
    if (dragged === target) return;
    const byId = new Map(layoutRef.current.map(item => [item.id, item]));
    const ids = moveId(layoutRef.current.map(item => item.id), dragged, target, after);
    persist(ids.map(id => byId.get(id)!));
  }, [persist]);

  const twoColumns = () => typeof window !== 'undefined' && window.matchMedia(TWO_COLUMNS_QUERY).matches;

  // --- Flytt ---

  const onDragStart = (event: React.DragEvent, id: string) => {
    event.dataTransfer.effectAllowed = 'move';
    // Safari startar ingen dragning utan data.
    event.dataTransfer.setData('text/plain', id);
    const section = sections.current.get(id);
    if (section) {
      const rect = section.getBoundingClientRect();
      event.dataTransfer.setDragImage(section, event.clientX - rect.left, event.clientY - rect.top);
    }
    setDragId(id);
  };

  const onDragOver = (event: React.DragEvent, item: PanelLayout) => {
    if (!dragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragId === item.id) {
      setDropTarget(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    // Halvbreda rutor bredvid varandra jämförs i sidled, övriga i höjdled.
    const horizontal = !item.wide && twoColumns();
    const after = horizontal
      ? event.clientX > rect.left + rect.width / 2
      : event.clientY > rect.top + rect.height / 2;
    setDropTarget(current => (
      current?.id === item.id && current.after === after && current.horizontal === horizontal
        ? current
        : { id: item.id, after, horizontal }
    ));
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (dragId && dropTarget) reorder(dragId, dropTarget.id, dropTarget.after);
    setDragId(null);
    setDropTarget(null);
  };

  const onDragEnd = () => {
    setDragId(null);
    setDropTarget(null);
  };

  const onGripKey = (event: React.KeyboardEvent, id: string) => {
    const ids = layoutRef.current.map(item => item.id);
    const index = ids.indexOf(id);
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      if (index > 0) reorder(id, ids[index - 1], false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      if (index < ids.length - 1) reorder(id, ids[index + 1], true);
    } else {
      return;
    }
    event.preventDefault();
  };

  // --- Storlek ---

  const resizeCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => resizeCleanup.current?.(), []);

  const onResizeStart = (event: React.PointerEvent, id: string) => {
    const body = bodies.current.get(id);
    if (!body || event.button !== 0) return;
    event.preventDefault();

    const startY = event.clientY;
    const startHeight = body.getBoundingClientRect().height;
    const canWiden = twoColumns();
    let anchorX = event.clientX;

    const onMove = (move: PointerEvent) => {
      const current = layoutRef.current.find(item => item.id === id);
      if (!current) return;
      const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(startHeight + move.clientY - startY)));
      let wide = current.wide;
      if (canWiden) {
        const dx = move.clientX - anchorX;
        // Ankaret flyttas vid varje växling, så att bredden inte fladdrar
        // fram och tillbaka när rutan byter plats under pekaren.
        if (!wide && dx > WIDTH_SWITCH_PX) { wide = true; anchorX = move.clientX; }
        else if (wide && dx < -WIDTH_SWITCH_PX) { wide = false; anchorX = move.clientX; }
      }
      if (height !== current.height || wide !== current.wide) update(id, { height, wide });
    };
    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      resizeCleanup.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
    resizeCleanup.current = stop;
  };

  const onResizeKey = (event: React.KeyboardEvent, item: PanelLayout) => {
    const body = bodies.current.get(item.id);
    const currentHeight = item.height ?? body?.getBoundingClientRect().height ?? MIN_HEIGHT;
    const clamp = (value: number) => Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(value)));
    if (event.key === 'ArrowUp') update(item.id, { height: clamp(currentHeight - HEIGHT_STEP) });
    else if (event.key === 'ArrowDown') update(item.id, { height: clamp(currentHeight + HEIGHT_STEP) });
    else if (event.key === 'ArrowLeft') update(item.id, { wide: false });
    else if (event.key === 'ArrowRight') update(item.id, { wide: true });
    else if (event.key === 'Escape' || event.key === 'Delete') update(item.id, { height: null });
    else return;
    event.preventDefault();
  };

  const panelById = new Map(panels.map(panel => [panel.id, panel]));

  return (
    <div className="grid min-w-0 grid-flow-row-dense grid-cols-1 items-start gap-6 lg:grid-cols-2">
      {layout.map(item => {
        const panel = panelById.get(item.id);
        if (!panel) return null;
        const target = dropTarget?.id === item.id ? dropTarget : null;

        return (
          <section
            key={item.id}
            ref={element => {
              if (element) sections.current.set(item.id, element);
              else sections.current.delete(item.id);
            }}
            className={cn(
              'sp-card relative flex min-w-0 flex-col',
              item.wide && 'lg:col-span-2',
              dragId === item.id && 'opacity-40',
            )}
            onDragOver={event => onDragOver(event, item)}
            onDrop={onDrop}
          >
            {target && (
              <div
                aria-hidden
                className={cn(
                  'pointer-events-none absolute z-20 bg-black',
                  target.horizontal
                    ? cn('inset-y-0 w-1', target.after ? 'right-0' : 'left-0')
                    : cn('inset-x-0 h-1', target.after ? 'bottom-0' : 'top-0'),
                )}
              />
            )}

            <header
              draggable
              onDragStart={event => onDragStart(event, item.id)}
              onDragEnd={onDragEnd}
              className={cn(
                'flex cursor-grab select-none items-center gap-2 px-3 py-2.5 active:cursor-grabbing',
                !item.collapsed && 'border-b-2 border-black',
              )}
            >
              <button
                type="button"
                className="rounded p-0.5 text-gray-400 hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
                aria-label="Flytta rutan (piltangenter)"
                title="Dra för att flytta"
                onKeyDown={event => onGripKey(event, item.id)}
              >
                <GripVertical size={16} />
              </button>
              <h2 className="min-w-0 flex-1 truncate font-bold">{panel.title}</h2>
              <button
                type="button"
                className="rounded p-1 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
                aria-expanded={!item.collapsed}
                aria-label={item.collapsed ? 'Fäll ut' : 'Fäll ihop'}
                title={item.collapsed ? 'Fäll ut' : 'Fäll ihop'}
                onClick={() => update(item.id, { collapsed: !item.collapsed })}
              >
                <ChevronDown size={16} className={cn('transition-transform', item.collapsed && '-rotate-90')} />
              </button>
            </header>

            {!item.collapsed && (
              <>
                <div
                  ref={element => {
                    if (element) bodies.current.set(item.id, element);
                    else bodies.current.delete(item.id);
                  }}
                  className="min-h-0 overflow-auto"
                  style={item.height ? { height: item.height } : undefined}
                >
                  {panel.content}
                </div>
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label="Ändra storlek (piltangenter, Esc återställer höjden)"
                  tabIndex={0}
                  title="Dra för att ändra storlek · dubbelklicka för att återställa höjden"
                  className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-nwse-resize focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
                  onPointerDown={event => onResizeStart(event, item.id)}
                  onDoubleClick={() => update(item.id, { height: null })}
                  onKeyDown={event => onResizeKey(event, item)}
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-400" aria-hidden>
                    <path d="M14 6 6 14M14 10l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
