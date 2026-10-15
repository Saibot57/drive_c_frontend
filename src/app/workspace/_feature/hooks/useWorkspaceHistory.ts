'use client';

import { useCallback, useRef, useState } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';
import { createUndoStack, type UndoEntry } from '../utils/undoStack';

export type { UndoEntry };

/**
 * Ångra för workspace.
 *
 * Schemat och temakalendern håller hela sitt dokument i ett objekt och kan
 * därför spara ögonblicksbilder av det (useUndoableState).
 * Här är underlaget normaliserat över tre tabeller och varje ändring är ett
 * eget REST-anrop, så en ögonblicksbild går inte att spela tillbaka. I stället
 * registrerar varje åtgärd sin egen invers när den utförs.
 *
 * Det finns medvetet ingen redo: inverserna körs genom samma vägar som
 * vanliga ändringar, och en ångring lägger därför inte till något i stacken.
 */
export function useWorkspaceHistory() {
  const stack = useRef<ReturnType<typeof createUndoStack>>();
  stack.current ??= createUndoStack();
  const [canUndo, setCanUndo] = useState(false);

  const pushUndo = useCallback((entry: UndoEntry) => {
    stack.current!.push(entry);
    setCanUndo(stack.current!.size() > 0);
  }, []);

  /** Ångrar den senaste posten. Ctrl+Z. */
  const undo = useCallback(async (): Promise<string | null> => {
    const label = stack.current!.undo();
    setCanUndo(stack.current!.size() > 0);
    return label;
  }, []);

  /**
   * Ångrar en bestämd post, även om den inte ligger överst. Notisernas
   * Ångra-knapp går hit, så att Ctrl+Z efteråt inte kör samma post igen.
   */
  const undoEntry = useCallback(async (entry: UndoEntry): Promise<string | null> => {
    const label = stack.current!.undoEntry(entry);
    setCanUndo(stack.current!.size() > 0);
    return label;
  }, []);

  /** Vid ytbyte hör stacken inte längre ihop med det man ser. */
  const clearHistory = useCallback(() => {
    stack.current!.clear();
    setCanUndo(false);
  }, []);

  return { pushUndo, undo, undoEntry, clearHistory, canUndo };
}

/** Binder Ctrl+Z. Separat så att skalet kan koppla på sin egen notis. */
export function useUndoHotkey(handler: () => void) {
  useHotkeys([{ key: 'z', ctrl: true, handler }], [handler]);
}
