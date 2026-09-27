'use client';

import { useCallback, useRef, useState } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';
import {
  commitUndoState,
  CommitOptions,
  DEFAULT_MAX_UNDO_DEPTH,
  initialUndoState,
  redoState,
  undoState,
} from '@/utils/undoHistory';

type UseUndoableStateOptions = {
  /**
   * Frågas innan en ångring körs. Skickas som funktion och inte som värde:
   * läsläget kan avgöras längre ned i komponenten än där historiken skapas,
   * så svaret läses först när tangenten trycks.
   */
  canEdit?: () => boolean;
  /** Registrerar Ctrl+Shift+Z för gör om. */
  redo?: boolean;
  maxDepth?: number;
};

/**
 * Ett värde med ångra (Ctrl+Z) och valfritt gör om (Ctrl+Shift+Z). Varje
 * `commit` sparar en ögonblicksbild av föregående värde.
 */
export function useUndoableState<T>(initial: T, options: UseUndoableStateOptions = {}) {
  const { redo: withRedo = false, maxDepth = DEFAULT_MAX_UNDO_DEPTH } = options;
  const [state, setState] = useState(() => initialUndoState(initial));
  // Via en ref, så att en ny funktionsidentitet per rendering inte tvingar
  // fram en omregistrering av tangentgenvägen.
  const canEditRef = useRef(options.canEdit);
  canEditRef.current = options.canEdit;

  const commit = useCallback((updater: (prev: T) => T, commitOptions?: CommitOptions) => {
    setState(prev => commitUndoState(prev, updater(prev.present), commitOptions, maxDepth));
  }, [maxDepth]);

  const undo = useCallback(() => {
    // Ctrl+Z går inte genom commit och skulle annars vara den enda vägen som
    // ändrade något man bara har läsrätt till.
    if (canEditRef.current && !canEditRef.current()) return;
    setState(undoState);
  }, []);

  const redo = useCallback(() => {
    if (canEditRef.current && !canEditRef.current()) return;
    setState(redoState);
  }, []);

  useHotkeys(
    [
      { key: 'z', ctrl: true, handler: undo },
      ...(withRedo ? [{ key: 'z', ctrl: true, shift: true, handler: redo }] : []),
    ],
    [undo, redo, withRedo],
  );

  return { value: state.present, commit, undo, redo };
}
