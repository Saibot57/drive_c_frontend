import { describe, expect, it } from 'vitest';
import { resolveMindmapKey } from '@/utils/mindmap/mindmapKeys';
import { wrapLabelLines } from '@/utils/mindmap/mindmapLayout';
import { caretLine, insertNewline, resolveLabelKey } from '@/utils/mindmapLabelKeys';

const key = (k: string, mods: Partial<{ shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) => ({
  key: k,
  code: '',
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

const one = { line: 0, lineCount: 1 };

describe('resolveLabelKey', () => {
  it('ger en ny rad med Ctrl+Enter och Cmd+Enter', () => {
    expect(resolveLabelKey(key('Enter', { ctrlKey: true }), one)).toBe('newline');
    expect(resolveLabelKey(key('Enter', { metaKey: true }), one)).toBe('newline');
  });

  it('lämnar Enter, Shift+Enter, Alt+Enter och Ctrl+Shift+Enter', () => {
    expect(resolveLabelKey(key('Enter'), one)).toBeNull();
    expect(resolveLabelKey(key('Enter', { shiftKey: true }), one)).toBeNull();
    expect(resolveLabelKey(key('Enter', { altKey: true }), one)).toBeNull();
    expect(resolveLabelKey(key('Enter', { ctrlKey: true, shiftKey: true }), one)).toBeNull();
  });

  it('gör ingenting under en komposition', () => {
    expect(resolveLabelKey({ ...key('Enter', { ctrlKey: true }), isComposing: true }, one)).toBeNull();
  });

  it('flyttar mellan raderna i noden och släpper pilen på första och sista raden', () => {
    expect(resolveLabelKey(key('ArrowUp'), { line: 1, lineCount: 3 })).toBe('lineUp');
    expect(resolveLabelKey(key('ArrowDown'), { line: 1, lineCount: 3 })).toBe('lineDown');
    expect(resolveLabelKey(key('ArrowUp'), { line: 0, lineCount: 3 })).toBeNull();
    expect(resolveLabelKey(key('ArrowDown'), { line: 2, lineCount: 3 })).toBeNull();
  });

  it('lämnar pilarna i en nod på en rad, som förut', () => {
    expect(resolveLabelKey(key('ArrowUp'), one)).toBeNull();
    expect(resolveLabelKey(key('ArrowDown'), one)).toBeNull();
    expect(resolveLabelKey(key('ArrowDown', { shiftKey: true }), { line: 0, lineCount: 2 })).toBeNull();
  });

  it('krockar inte med kartans tangenter i edit-läget: Ctrl+Enter är ledig där', () => {
    const ctx = { isRoot: false, parentIsRoot: false, labelEmpty: false, hasChildren: false, hasPreviousSibling: false };
    expect(resolveMindmapKey(key('Enter', { ctrlKey: true }), 'edit', ctx)).toBeNull();
  });
});

describe('caretLine', () => {
  const measure = (text: string) => text.length * 10;
  const lines = wrapLabelLines('ett två tre\nfyra', 70, measure);

  it('räknar raden på layoutens rader', () => {
    expect(caretLine(lines, 0)).toBe(0);
    expect(caretLine(lines, 7)).toBe(0);
    expect(caretLine(lines, 8)).toBe(1);
    expect(caretLine(lines, 11)).toBe(1);
    expect(caretLine(lines, 12)).toBe(2);
    expect(caretLine(lines, 16)).toBe(2);
  });
});

describe('insertNewline', () => {
  it('lägger in en radbrytning vid markören', () => {
    expect(insertNewline('abcd', 2, 2)).toEqual({ label: 'ab\ncd', caret: 3 });
  });

  it('ersätter det markerade', () => {
    expect(insertNewline('abcd', 1, 3)).toEqual({ label: 'a\nd', caret: 2 });
  });

  it('tål lägen utanför texten', () => {
    expect(insertNewline('ab', 5, 9)).toEqual({ label: 'ab\n', caret: 3 });
  });
});
