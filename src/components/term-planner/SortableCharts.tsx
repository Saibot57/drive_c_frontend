'use client';

import React from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDragSort } from '@/hooks/useDragSort';

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

export function SortableCharts({ storageKey, items, className }: {
  storageKey: string;
  items: SortableItem[];
  className?: string;
}) {
  const byId = new Map(items.map(item => [item.id, item]));
  const { order, dragId, target, previewRef, handleProps, dropProps, onKeyDown } =
    useDragSort(storageKey, items.map(item => item.id));

  return (
    <div className={className}>
      {order.map(id => {
        const item = byId.get(id)!;
        const isTarget = target?.id === id;
        return (
          <div
            key={id}
            ref={previewRef(id)}
            {...handleProps(id)}
            {...dropProps(id)}
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
                  'pointer-events-none absolute z-10 rounded bg-black',
                  target.vertical
                    ? cn('inset-x-0 h-1', target.after ? '-bottom-2' : '-top-2')
                    : cn('inset-y-0 w-1', target.after ? '-right-2' : '-left-2'),
                )}
              />
            )}
            <button
              type="button"
              className="absolute left-1 top-1 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-black focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black group-hover:opacity-100"
              aria-label={`Flytta ${item.label} (piltangenter)`}
              title="Dra för att flytta"
              onKeyDown={event => onKeyDown(event, id)}
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
