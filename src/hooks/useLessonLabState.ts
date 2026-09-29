'use client';

import { useCallback, useEffect, useState } from 'react';
import { LAB_SEED } from '@/config/lessonLabSeed';
import type { LabState } from '@/types/lessonLab';
import { isEditableElement } from '@/utils/dom';
import { parseLabState, sanitizeLabState } from '@/utils/lessonLab';
import { commitUndoState, initialUndoState, redoState, undoState, UndoState } from '@/utils/undoHistory';

/**
 * Veckolabbets läge, delat av den enkla vyn och detaljplanen: samma nyckel i
 * localStorage, samma tvätt och samma ångra/gör om (Ctrl+Z, Ctrl+Shift+Z).
 *
 * Läget läses efter montering, så att servern och första renderingen är lika.
 * Historiken gäller sidan man är på; den följer inte med mellan vyerna.
 */

const STATE_KEY = 'lessonLab.state.v1';

export const readStored = <T,>(key: string, parse: (raw: unknown) => T, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : parse(JSON.parse(raw));
  } catch {
    return fallback;
  }
};

export const writeStored = (key: string, value: unknown) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* full eller blockerad lagring */ }
};

export function useLessonLabState() {
  const [history, setHistory] = useState<UndoState<LabState>>(() => initialUndoState(LAB_SEED));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setHistory(initialUndoState(readStored(STATE_KEY, sanitizeLabState, LAB_SEED)));
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) writeStored(STATE_KEY, history.present); }, [loaded, history.present]);

  /**
   * Varje ändring går genom tvätten, så att en borttagen lärare också
   * försvinner ur arbetsgrupper och klasser. Ett läge som inte går igenom
   * tvätten (borde inte hända) släpps i stället för att skriva över.
   */
  const commit = useCallback((change: (current: LabState) => LabState) => {
    setHistory(h => {
      const next = parseLabState(change(h.present));
      return next ? commitUndoState(h, next) : h;
    });
  }, []);

  const undo = useCallback(() => setHistory(undoState), []);
  const redo = useCallback(() => setHistory(redoState), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isEditableElement(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
      else if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return {
    state: history.present,
    loaded,
    commit,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
