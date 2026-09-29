'use client';

import React, { useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePersistentState } from '@/hooks/usePersistentState';
import { applyStoredOrder, moveId, nextStoredOrder, sanitizeIdList } from '@/utils/sortOrder';

/**
 * Diagramkort som kan sorteras med dra och släpp inom sin ruta. Ordningen
 * sparas i webbläsaren under `storageKey`. Med tangentbordet: fokusera
 * greppet i kortets hörn och använd piltangenterna.
 *
 * Rutorna runt omkring (TermPanels) har egen dra och släpp. De två håller
 * isär sig genom att var och en bara reagerar på dragningar den själv har
 * startat, och kortens händelser stannar här.
 */

export type SortableItem = {
  id: string;
  /** För tangentbordsgreppets etikett, t.ex. "Oliv" eller "Anna". */
  label: string;
  node: React.ReactNode;
};

type Target = { id: string; after: boolean };

const NO_IDS: string[] = [];

export function SortableCharts({ storageKey, items, className }: {
  storageKey: string;
  items: SortableItem[];
  className?: string;
}) {
  const [stored, persist] = usePersistentState(storageKey, sanitizeIdList, NO_IDS);
  const byId = new Map(items.map(item => [item.id, item]));
  const order = applyStoredOrder(items.map(item => item.id), stored);

  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const cards = useRef(new Map<string, HTMLElement>());

  const reorder = (dragged: string, targetId: string, after: boolean) => {
    const next = moveId(order, dragged, targetId, after);
    if (next !== order) persist(nextStoredOrder(next, stored));
  };

  const onDragStart = (event: React.DragEvent, id: string) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    // Safari startar ingen dragning utan data.
    event.dataTransfer.setData('text/plain', id);
    const card = cards.current.get(id);
    if (card) {
      const rect = card.getBoundingClientRect();
      event.dataTransfer.setDragImage(card, event.clientX - rect.left, event.clientY - rect.top);
    }
    setDragId(id);
  };

  const onDragOver = (event: React.DragEvent, id: string) => {
    // En ruta som dras över korten ska rutorna själva ta hand om.
    if (!dragId) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    if (id === dragId) {
      setTarget(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientX > rect.left + rect.width / 2;
    setTarget(current => (current?.id === id && current.after === after ? current : { id, after }));
  };

  const onDrop = (event: React.DragEvent) => {
    if (!dragId) return;
    event.preventDefault();
    event.stopPropagation();
    if (target) reorder(dragId, target.id, target.after);
    setDragId(null);
    setTarget(null);
  };

  const onDragEnd = (event: React.DragEvent) => {
    event.stopPropagation();
    setDragId(null);
    setTarget(null);
  };

  const onGripKey = (event: React.KeyboardEvent, id: string) => {
    const index = order.indexOf(id);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      if (index > 0) reorder(id, order[index - 1], false);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      if (index < order.length - 1) reorder(id, order[index + 1], true);
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className={className}>
      {order.map(id => {
        const item = byId.get(id)!;
        const isTarget = target?.id === id;
        return (
          <div
            key={id}
            ref={element => {
              if (element) cards.current.set(id, element);
              else cards.current.delete(id);
            }}
            draggable
            onDragStart={event => onDragStart(event, id)}
            onDragOver={event => onDragOver(event, id)}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            className={cn(
              'group relative min-w-0 cursor-grab select-none rounded-lg border-2 border-transparent p-2',
              'hover:border-gray-200 active:cursor-grabbing',
              dragId === id && 'opacity-40',
            )}
          >
            {isTarget && (
              <div
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-y-0 z-10 w-1 rounded bg-black',
                  target.after ? '-right-2' : '-left-2',
                )}
              />
            )}
            <button
              type="button"
              className="absolute left-1 top-1 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-black focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black group-hover:opacity-100"
              aria-label={`Flytta ${item.label} (piltangenter)`}
              title="Dra för att flytta"
              onKeyDown={event => onGripKey(event, id)}
            >
              <GripVertical size={14} />
            </button>
            {item.node}
          </div>
        );
      })}
    </div>
  );
}
