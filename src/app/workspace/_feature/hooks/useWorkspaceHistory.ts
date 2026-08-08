'use client';

import { useCallback, useRef, useState } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';

export type UndoEntry = {
  /** Visas i notisen när man ångrar: "Ångrade: {label}". */
  label: string;
  undo: () => void | Promise<void>;
};

/** Djupare än så är ingen hjälpt av, och varje post håller en closure vid liv. */
const MAX_DEPTH = 50;

/**
 * Ångra för workspace.
 *
 * Schemat och temakalendern håller hela sitt dokument i ett objekt och kan
 * därför spara ögonblicksbilder av det (useScheduleHistory, useThemeWheelHistory).
 * Här är underlaget normaliserat över tre tabeller och varje ändring är ett
 * eget REST-anrop, så en ögonblicksbild går inte att spela tillbaka. I stället
 * registrerar varje åtgärd sin egen invers när den utförs.
 *
 * Det finns medvetet ingen redo: inverserna körs genom samma vägar som
 * vanliga ändringar, och en ångring lägger därför inte till något i stacken.
 */
export function useWorkspaceHistory() {
  const stack = useRef<UndoEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  // Medan en ångring körs får dess egna anrop inte lägga till nya poster.
  const undoing = useRef(false);

  const pushUndo = useCallback((entry: UndoEntry) => {
    if (undoing.current) return;
    stack.current = [...stack.current, entry].slice(-MAX_DEPTH);
    setCanUndo(true);
  }, []);

  const undo = useCallback(async (): Promise<string | null> => {
    const entry = stack.current[stack.current.length - 1];
    if (!entry) return null;

    stack.current = stack.current.slice(0, -1);
    setCanUndo(stack.current.length > 0);

    undoing.current = true;
    try {
      await entry.undo();
      return entry.label;
    } finally {
      undoing.current = false;
    }
  }, []);

  /** Vid ytbyte hör stacken inte längre ihop med det man ser. */
  const clearHistory = useCallback(() => {
    stack.current = [];
    setCanUndo(false);
  }, []);

  return { pushUndo, undo, clearHistory, canUndo, isUndoing: undoing };
}

/** Binder Ctrl+Z. Separat så att skalet kan koppla på sin egen notis. */
export function useUndoHotkey(handler: () => void) {
  useHotkeys([{ key: 'z', ctrl: true, handler }], [handler]);
}
