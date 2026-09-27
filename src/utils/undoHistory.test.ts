import { describe, expect, it } from 'vitest';
import { commitUndoState, initialUndoState, redoState, undoState } from './undoHistory';

describe('undoHistory', () => {
  it('ångrar och gör om i rätt ordning', () => {
    let state = initialUndoState('a');
    state = commitUndoState(state, 'b');
    state = commitUndoState(state, 'c');

    state = undoState(state);
    expect(state.present).toBe('b');
    state = undoState(state);
    expect(state.present).toBe('a');
    state = redoState(state);
    expect(state.present).toBe('b');
  });

  it('tömmer gör om-listan när något nytt händer', () => {
    let state = commitUndoState(initialUndoState(1), 2);
    state = undoState(state);
    state = commitUndoState(state, 3);
    expect(state.future).toEqual([]);
    expect(redoState(state)).toBe(state);
  });

  it('sparar inget steg när värdet är oförändrat', () => {
    const state = initialUndoState({ x: 1 });
    expect(commitUndoState(state, state.present)).toBe(state);
  });

  it('rensar historiken vid inläsning', () => {
    const state = commitUndoState(commitUndoState(initialUndoState('a'), 'b'), 'c', { clearHistory: true });
    expect(state).toEqual({ past: [], present: 'c', future: [] });
  });

  it('släpper de äldsta stegen över taket', () => {
    let state = initialUndoState(0);
    for (let i = 1; i <= 5; i += 1) state = commitUndoState(state, i, {}, 3);
    expect(state.past).toEqual([2, 3, 4]);
  });

  it('gör ingenting utan historik', () => {
    const state = initialUndoState('a');
    expect(undoState(state)).toBe(state);
    expect(redoState(state)).toBe(state);
  });
});
