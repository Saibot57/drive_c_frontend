/**
 * Ångra och gör om som rena funktioner över en ögonblicksbild-historik.
 *
 * Används av useUndoableState. Att logiken är ren gör att den går att testa
 * utan React, och att React får köra uppdateringarna två gånger i StrictMode
 * utan att en ändring hamnar dubbelt i historiken.
 */

export type UndoState<T> = {
  past: T[];
  present: T;
  future: T[];
};

/** Hur många steg bakåt som sparas. Äldre steg släpps. */
export const DEFAULT_MAX_UNDO_DEPTH = 100;

export type CommitOptions = {
  /** Används vid inläsning: den nya datan ska inte gå att ångra tillbaka. */
  clearHistory?: boolean;
};

export const initialUndoState = <T>(present: T): UndoState<T> => ({ past: [], present, future: [] });

export const commitUndoState = <T>(
  state: UndoState<T>,
  next: T,
  options: CommitOptions = {},
  maxDepth = DEFAULT_MAX_UNDO_DEPTH
): UndoState<T> => {
  if (next === state.present) return state;
  if (options.clearHistory) return initialUndoState(next);
  return {
    past: [...state.past, state.present].slice(-maxDepth),
    present: next,
    future: [],
  };
};

export const undoState = <T>(state: UndoState<T>): UndoState<T> => {
  if (state.past.length === 0) return state;
  return {
    past: state.past.slice(0, -1),
    present: state.past[state.past.length - 1],
    future: [...state.future, state.present],
  };
};

export const redoState = <T>(state: UndoState<T>): UndoState<T> => {
  if (state.future.length === 0) return state;
  return {
    past: [...state.past, state.present],
    present: state.future[state.future.length - 1],
    future: state.future.slice(0, -1),
  };
};
