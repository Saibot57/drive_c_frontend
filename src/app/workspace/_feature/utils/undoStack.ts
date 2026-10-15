/**
 * Ångrastacken för workspace som ren logik, så att den går att testa utan
 * React. useWorkspaceHistory håller en instans och speglar `size` i state.
 */

export type UndoEntry = {
  /** Visas i notisen när man ångrar: "Ångrade: {label}". */
  label: string;
  undo: () => void | Promise<void>;
};

/** Djupare än så är ingen hjälpt av, och varje post håller en closure vid liv. */
export const MAX_UNDO_DEPTH = 50;

export function createUndoStack(maxDepth = MAX_UNDO_DEPTH) {
  let stack: UndoEntry[] = [];
  // Medan en ångring körs får dess egna anrop inte lägga till nya poster.
  let undoing = false;
  // Poster som redan körts. Notisens Ångra-knapp och Ctrl+Z når samma post,
  // och en invers som körs två gånger lägger till exempel tillbaka ett kort
  // två gånger.
  const done = new WeakSet<UndoEntry>();

  const push = (entry: UndoEntry) => {
    if (undoing) return;
    stack = [...stack, entry].slice(-maxDepth);
  };

  /**
   * Kör en bestämd post, även om den inte ligger överst, och tar bort den ur
   * stacken. Används av notisernas Ångra-knapp. Returnerar null om posten
   * redan är ångrad.
   */
  const undoEntry = async (entry: UndoEntry): Promise<string | null> => {
    if (done.has(entry)) return null;
    done.add(entry);
    stack = stack.filter((e) => e !== entry);

    undoing = true;
    try {
      await entry.undo();
      return entry.label;
    } finally {
      undoing = false;
    }
  };

  const undo = async (): Promise<string | null> => {
    const entry = stack[stack.length - 1];
    return entry ? undoEntry(entry) : null;
  };

  const clear = () => {
    stack = [];
  };

  return {
    push,
    undo,
    undoEntry,
    clear,
    size: () => stack.length,
    isUndoing: () => undoing,
  };
}
