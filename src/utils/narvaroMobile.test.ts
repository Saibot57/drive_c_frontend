import { describe, expect, it } from 'vitest';
import { DEFAULT_STAMPS, emptySession, setPersonNote } from '@/utils/narvaro';
import {
  byFirstName,
  isMobileMode,
  mobileSections,
  pickActiveStamp,
  pushUndo,
  sanitizeMobilePref,
  setStamp,
  undoSession,
  type UndoEntry,
} from '@/utils/narvaroMobile';

describe('mobilläget slås på', () => {
  it('följer skärmen utan eget val', () => {
    expect(isMobileMode('auto', true)).toBe(true);
    expect(isMobileMode('auto', false)).toBe(false);
  });

  it('låter ett eget val gå före skärmen', () => {
    expect(isMobileMode('off', true)).toBe(false);
    expect(isMobileMode('on', false)).toBe(true);
  });

  it('läser trasiga värden som auto', () => {
    expect(sanitizeMobilePref('on')).toBe('on');
    expect(sanitizeMobilePref('off')).toBe('off');
    expect(sanitizeMobilePref(true)).toBe('auto');
    expect(sanitizeMobilePref(null)).toBe('auto');
  });
});

describe('pickActiveStamp', () => {
  it('väljer den sparade stämpeln om den finns kvar', () => {
    expect(pickActiveStamp(DEFAULT_STAMPS, DEFAULT_STAMPS[2].id)).toBe(DEFAULT_STAMPS[2].id);
  });

  it('faller tillbaka på den första', () => {
    expect(pickActiveStamp(DEFAULT_STAMPS, 'borttagen')).toBe(DEFAULT_STAMPS[0].id);
    expect(pickActiveStamp([], 'x')).toBeNull();
  });
});

describe('byFirstName', () => {
  it('sorterar på förnamn med svensk ordning och sedan på efternamn', () => {
    expect(byFirstName(['Örjan Berg', 'Åsa Lind', 'Anna Ström', 'Anna Berg', 'Zack Ek']))
      .toEqual(['Anna Berg', 'Anna Ström', 'Zack Ek', 'Åsa Lind', 'Örjan Berg']);
  });
});

describe('mobileSections', () => {
  const present = ['Cecilia A', 'Bo B', 'Adam C', 'Dan D'];

  it('visar hela klassen i en sektion', () => {
    expect(mobileSections('class', present, [['Bo B']])).toEqual([
      { title: null, names: ['Adam C', 'Bo B', 'Cecilia A', 'Dan D'] },
    ]);
  });

  it('visar klassen när passet saknar grupper', () => {
    expect(mobileSections('groups', present, undefined)).toHaveLength(1);
  });

  it('delar upp i grupper, hoppar över tomma och lägger resten under Utan grupp', () => {
    const stored = [['Dan D', 'Bo B'], ['Frånvarande F'], ['Cecilia A']];
    expect(mobileSections('groups', present, stored)).toEqual([
      { title: 'Grupp 1', names: ['Bo B', 'Dan D'] },
      { title: 'Grupp 3', names: ['Cecilia A'] },
      { title: 'Utan grupp', names: ['Adam C'] },
    ]);
  });
});

describe('setStamp och ångra', () => {
  const id = DEFAULT_STAMPS[0].id;
  const other = DEFAULT_STAMPS[1].id;

  it('sätter och tar bort uttryckligen', () => {
    const on = setStamp(emptySession('p'), 'Ali', id, true);
    expect(on.people.Ali.tags).toEqual([id]);
    expect(setStamp(on, 'Ali', id, true)).toBe(on);
    expect(setStamp(on, 'Ali', id, false).people.Ali).toBeUndefined();
  });

  it('ångrar bara stämpeln och behåller noteringen', () => {
    let sess = setPersonNote(emptySession('p'), 'Ali', { tags: [other], note: 'ledde' });
    sess = setStamp(sess, 'Ali', id, true);
    const undone = undoSession(sess, { key: 'k', name: 'Ali', stampId: id, on: true });
    expect(undone.people.Ali).toEqual({ tags: [other], note: 'ledde' });
  });

  it('ångrar en borttagning genom att sätta tillbaka stämpeln', () => {
    const sess = setStamp(emptySession('p'), 'Ali', id, true);
    const removed = setStamp(sess, 'Ali', id, false);
    expect(undoSession(removed, { key: 'k', name: 'Ali', stampId: id, on: false }).people.Ali.tags).toEqual([id]);
  });
});

describe('pushUndo', () => {
  const entry = (key: string, name: string): UndoEntry => ({ key, name, stampId: 's', on: true });

  it('sparar högst tio steg', () => {
    let stack: UndoEntry[] = [];
    for (let i = 0; i < 12; i++) stack = pushUndo(stack, entry('k', `n${i}`));
    expect(stack).toHaveLength(10);
    expect(stack[0].name).toBe('n2');
    expect(stack[9].name).toBe('n11');
  });

  it('glömmer steg från andra pass', () => {
    const stack = pushUndo([entry('a', 'x'), entry('a', 'y')], entry('b', 'z'));
    expect(stack).toEqual([entry('b', 'z')]);
  });
});
