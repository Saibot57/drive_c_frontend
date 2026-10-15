import { describe, expect, it, vi } from 'vitest';
import { createUndoStack, type UndoEntry } from './undoStack';

const entry = (label: string, undo: UndoEntry['undo'] = vi.fn()): UndoEntry => ({ label, undo });

describe('createUndoStack', () => {
  it('ångrar den senaste posten först', async () => {
    const stack = createUndoStack();
    const first = entry('första');
    const second = entry('andra');
    stack.push(first);
    stack.push(second);

    await expect(stack.undo()).resolves.toBe('andra');
    await expect(stack.undo()).resolves.toBe('första');
    await expect(stack.undo()).resolves.toBeNull();
    expect(first.undo).toHaveBeenCalledOnce();
    expect(second.undo).toHaveBeenCalledOnce();
  });

  it('kör inte notisens post en gång till när Ctrl+Z trycks efteråt', async () => {
    const stack = createUndoStack();
    const earlier = entry('flytten');
    const removal = entry('borttagningen från ytan');
    stack.push(earlier);
    stack.push(removal);

    await expect(stack.undoEntry(removal)).resolves.toBe('borttagningen från ytan');
    // Ctrl+Z ska nu ångra det som låg före, inte lägga tillbaka kortet igen.
    await expect(stack.undo()).resolves.toBe('flytten');
    expect(removal.undo).toHaveBeenCalledOnce();
    expect(earlier.undo).toHaveBeenCalledOnce();
  });

  it('gör ingenting när notisens knapp trycks efter Ctrl+Z', async () => {
    const stack = createUndoStack();
    const removal = entry('raderingen');
    stack.push(removal);

    await stack.undo();
    await expect(stack.undoEntry(removal)).resolves.toBeNull();
    expect(removal.undo).toHaveBeenCalledOnce();
  });

  it('låter notisen ångra en post som inte längre ligger i stacken, men bara en gång', async () => {
    const stack = createUndoStack(1);
    const old = entry('gammal');
    stack.push(old);
    stack.push(entry('ny'));
    stack.clear();

    await expect(stack.undoEntry(old)).resolves.toBe('gammal');
    await expect(stack.undoEntry(old)).resolves.toBeNull();
    expect(old.undo).toHaveBeenCalledOnce();
  });

  it('släpper de äldsta posterna över maxdjupet', async () => {
    const stack = createUndoStack(2);
    ['a', 'b', 'c'].forEach((label) => stack.push(entry(label)));
    expect(stack.size()).toBe(2);
    await expect(stack.undo()).resolves.toBe('c');
    await expect(stack.undo()).resolves.toBe('b');
    await expect(stack.undo()).resolves.toBeNull();
  });

  it('lägger inte till poster som skapas medan en ångring körs', async () => {
    const stack = createUndoStack();
    stack.push(entry('yttre', () => { stack.push(entry('inre')); }));

    await stack.undo();
    expect(stack.size()).toBe(0);
    expect(stack.isUndoing()).toBe(false);
  });

  it('räknar posten som ångrad även om inversen kastar', async () => {
    const stack = createUndoStack();
    const failing = entry('trasig', () => Promise.reject(new Error('nätfel')));
    stack.push(failing);

    await expect(stack.undo()).rejects.toThrow('nätfel');
    expect(stack.isUndoing()).toBe(false);
    await expect(stack.undoEntry(failing)).resolves.toBeNull();
  });
});
