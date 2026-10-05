'use client';

import React, { useRef, useState } from 'react';
import { applyStoredOrder, moveId, nextStoredOrder, sanitizeIdList } from '@/utils/sortOrder';
import { usePersistentState } from '@/hooks/usePersistentState';

/**
 * Dra och släpp för en lista som användaren sorterar själv, med ordningen
 * sparad i webbläsaren under `storageKey`.
 *
 * Kroken håller i logiken; komponenten bestämmer vad som är grepp (det man
 * drar i), vad som är släppyta och hur markeringen ser ut. Greppet och
 * släppytan kan vara samma element eller olika, t.ex. en flik som grepp och
 * hela mappen som yta.
 *
 * Dragningar som kroken inte själv har startat lämnas orörda, och dess egna
 * händelser stannar hos den. Så kan två sorterbara listor ligga i varandra.
 */

export type DropTarget = {
  id: string;
  /** Det dragna hamnar efter målet, inte före. */
  after: boolean;
  /** Målet ligger ensamt på sin rad, så före/efter är ovanför/under. */
  vertical: boolean;
};

const NO_IDS: string[] = [];

/** En yta som tar mer än så här av sin förälders bredd räknas som en egen rad. */
const FULL_ROW = 0.6;

export function useDragSort(storageKey: string, ids: string[]) {
  const [stored, persist] = usePersistentState(storageKey, sanitizeIdList, NO_IDS);
  const order = applyStoredOrder(ids, stored);

  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const previews = useRef(new Map<string, HTMLElement>());

  const reorder = (dragged: string, targetId: string, after: boolean) => {
    const next = moveId(order, dragged, targetId, after);
    if (next !== order) persist(nextStoredOrder(next, stored));
  };

  /** Elementet som följer med pekaren under dragningen. Utan det blir det greppet. */
  const previewRef = (id: string) => (element: HTMLElement | null) => {
    if (element) previews.current.set(id, element);
    else previews.current.delete(id);
  };

  const stop = () => {
    setDragId(null);
    setTarget(null);
  };

  const handleProps = (id: string) => ({
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = 'move';
      // Safari startar ingen dragning utan data.
      event.dataTransfer.setData('text/plain', id);
      const preview = previews.current.get(id);
      if (preview) {
        const rect = preview.getBoundingClientRect();
        event.dataTransfer.setDragImage(preview, event.clientX - rect.left, event.clientY - rect.top);
      }
      setDragId(id);
    },
    onDragEnd: (event: React.DragEvent) => {
      event.stopPropagation();
      stop();
    },
  });

  const dropProps = (id: string) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!dragId) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      if (id === dragId) {
        setTarget(null);
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const parent = event.currentTarget.parentElement?.getBoundingClientRect();
      const vertical = !!parent && rect.width > parent.width * FULL_ROW;
      const after = vertical
        ? event.clientY > rect.top + rect.height / 2
        : event.clientX > rect.left + rect.width / 2;
      setTarget(current => (
        current?.id === id && current.after === after && current.vertical === vertical
          ? current
          : { id, after, vertical }
      ));
    },
    onDrop: (event: React.DragEvent) => {
      if (!dragId) return;
      event.preventDefault();
      event.stopPropagation();
      if (target) reorder(dragId, target.id, target.after);
      stop();
    },
  });

  /** Piltangenterna på ett fokuserat grepp flyttar ett steg åt gången. */
  const onKeyDown = (event: React.KeyboardEvent, id: string) => {
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

  return { order, dragId, target, previewRef, handleProps, dropProps, onKeyDown };
}
