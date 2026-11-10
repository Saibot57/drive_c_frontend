import { describe, expect, it } from 'vitest';
import { resolveMindmapKey, type MindmapKeyContext, type MindmapKeyInput } from './mindmapKeys';

const key = (k: string, extra: Partial<MindmapKeyInput> = {}): MindmapKeyInput => ({
  key: k,
  code: extra.code ?? '',
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...extra,
});

const ctx = (extra: Partial<MindmapKeyContext> = {}): MindmapKeyContext => ({
  isRoot: false,
  parentIsRoot: false,
  labelEmpty: false,
  hasChildren: false,
  hasPreviousSibling: true,
  ...extra,
});

describe('resolveMindmapKey i edit-läget', () => {
  it('skapar nästa nod med Tab och Enter', () => {
    expect(resolveMindmapKey(key('Tab'), 'edit', ctx())).toEqual({ type: 'addChild' });
    expect(resolveMindmapKey(key('Enter'), 'edit', ctx())).toEqual({ type: 'addSibling', where: 'after' });
    expect(resolveMindmapKey(key('Enter', { shiftKey: true }), 'edit', ctx()))
      .toEqual({ type: 'addSibling', where: 'before' });
    expect(resolveMindmapKey(key('Tab', { shiftKey: true }), 'edit', ctx())).toEqual({ type: 'outdent' });
  });

  it('beter sig som en punktlista på en tom nod', () => {
    const empty = ctx({ labelEmpty: true });
    expect(resolveMindmapKey(key('Tab'), 'edit', empty)).toEqual({ type: 'indent' });
    expect(resolveMindmapKey(key('Tab'), 'edit', { ...empty, hasPreviousSibling: false })).toEqual({ type: 'addChild' });
    expect(resolveMindmapKey(key('Enter'), 'edit', empty)).toEqual({ type: 'outdent' });
    expect(resolveMindmapKey(key('Enter'), 'edit', { ...empty, parentIsRoot: true })).toEqual({ type: 'finishEdit' });
    expect(resolveMindmapKey(key('Backspace'), 'edit', empty)).toEqual({ type: 'remove' });
  });

  it('låter Backspace sudda text som vanligt', () => {
    expect(resolveMindmapKey(key('Backspace'), 'edit', ctx())).toBeNull();
    expect(resolveMindmapKey(key('Backspace'), 'edit', ctx({ labelEmpty: true, isRoot: true }))).toBeNull();
    expect(resolveMindmapKey(key('Backspace'), 'edit', ctx({ labelEmpty: true, hasChildren: true }))).toBeNull();
  });

  it('släpper vanliga tecken och pilar i sidled till fältet', () => {
    expect(resolveMindmapKey(key('a'), 'edit', ctx())).toBeNull();
    expect(resolveMindmapKey(key('ArrowLeft'), 'edit', ctx())).toBeNull();
    expect(resolveMindmapKey(key('ArrowDown'), 'edit', ctx())).toEqual({ type: 'navigate', direction: 'down' });
    expect(resolveMindmapKey(key('Escape'), 'edit', ctx())).toEqual({ type: 'finishEdit' });
  });

  it('gör ingenting medan ett tecken komponeras', () => {
    expect(resolveMindmapKey(key('Enter', { isComposing: true }), 'edit', ctx())).toBeNull();
  });
});

describe('resolveMindmapKey i nav-läget', () => {
  it('går med pilarna och flyttar med Alt+pil', () => {
    expect(resolveMindmapKey(key('ArrowUp'), 'nav', ctx())).toEqual({ type: 'navigate', direction: 'up' });
    expect(resolveMindmapKey(key('ArrowLeft', { altKey: true }), 'nav', ctx())).toEqual({ type: 'move', direction: 'left' });
  });

  it('börjar skriva över noden med ett tecken, även med AltGr', () => {
    expect(resolveMindmapKey(key('k'), 'nav', ctx())).toEqual({ type: 'edit', replaceWith: 'k' });
    expect(resolveMindmapKey(key('Å', { shiftKey: true }), 'nav', ctx())).toEqual({ type: 'edit', replaceWith: 'Å' });
    expect(resolveMindmapKey(key('@', { ctrlKey: true, altKey: true }), 'nav', ctx())).toEqual({ type: 'edit', replaceWith: '@' });
    expect(resolveMindmapKey(key('F2'), 'nav', ctx())).toEqual({ type: 'edit' });
  });

  it('har mellanslag, Delete och Esc', () => {
    expect(resolveMindmapKey(key(' '), 'nav', ctx())).toEqual({ type: 'toggleCollapse' });
    expect(resolveMindmapKey(key('Delete'), 'nav', ctx())).toEqual({ type: 'remove' });
    expect(resolveMindmapKey(key('Backspace'), 'nav', ctx())).toEqual({ type: 'remove' });
    expect(resolveMindmapKey(key('Escape'), 'nav', ctx())).toEqual({ type: 'leave' });
  });

  it('väljer färg med Alt+siffra efter tangentens plats, inte tecknet', () => {
    // Alt+1 på en Mac ger "¡".
    expect(resolveMindmapKey(key('¡', { altKey: true, code: 'Digit1' }), 'nav', ctx())).toEqual({ type: 'color', color: 'green' });
    expect(resolveMindmapKey(key('0', { altKey: true, code: 'Digit0' }), 'nav', ctx())).toEqual({ type: 'color', color: null });
  });

  it('kopierar, klipper ut och släpper igenom inklistring', () => {
    expect(resolveMindmapKey(key('c', { ctrlKey: true }), 'nav', ctx())).toEqual({ type: 'copy' });
    expect(resolveMindmapKey(key('x', { metaKey: true }), 'nav', ctx())).toEqual({ type: 'cut' });
    expect(resolveMindmapKey(key('v', { ctrlKey: true }), 'nav', ctx())).toEqual({ type: 'paste' });
  });

  it('lämnar andra Ctrl-kommandon åt workspace', () => {
    expect(resolveMindmapKey(key('s', { ctrlKey: true }), 'nav', ctx())).toBeNull();
    expect(resolveMindmapKey(key('a', { metaKey: true }), 'nav', ctx())).toBeNull();
  });
});

describe('ångra i båda lägena', () => {
  it.each(['nav', 'edit'] as const)('%s', (mode) => {
    expect(resolveMindmapKey(key('z', { ctrlKey: true }), mode, ctx())).toEqual({ type: 'undo' });
    expect(resolveMindmapKey(key('Z', { metaKey: true, shiftKey: true }), mode, ctx())).toEqual({ type: 'redo' });
    expect(resolveMindmapKey(key('y', { ctrlKey: true }), mode, ctx())).toEqual({ type: 'redo' });
  });
});
