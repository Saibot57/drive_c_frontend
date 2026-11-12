import { describe, expect, it } from 'vitest';
import { DEFAULT_STAMPS, emptySession, parsePasted, setPersonNote } from '@/utils/narvaro';
import {
  byFirstName,
  groupsForDate,
  groupsOptions,
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

describe('grupper samma dag', () => {
  const sess = '2026-11-02|Måndag|B';
  const store = {
    '2026-11-02|Måndag|C#Grund+Rosa': { groups: [['A', 'B'], ['C']] },
    '2026-11-02|Måndag|B#Rosa': { groups: [['D']] },
    '2026-11-02|Måndag|dag#Rosa': { groups: [['E']] },
    '2026-11-02|Måndag|D#Rosa': { groups: [[]] },
    '2026-11-02|Måndag|E#Borttagen': { groups: [['F']] },
    '2026-11-03|Tisdag|B#Rosa': { groups: [['G']] },
  };

  it('hittar dagens pass med grupper, oavsett pass och klasser', () => {
    const found = groupsForDate(store, sess, ['Grund', 'Rosa']);
    expect(found.map(f => f.key)).toEqual([
      '2026-11-02|Måndag|B#Rosa',
      '2026-11-02|Måndag|C#Grund+Rosa',
      '2026-11-02|Måndag|dag#Rosa',
    ]);
    expect(found[1]).toEqual({
      key: '2026-11-02|Måndag|C#Grund+Rosa', sessKey: '2026-11-02|Måndag|C', which: 'C', classes: ['Grund', 'Rosa'], count: 3,
    });
  });

  it('hoppar över tomma grupper och klasser som inte finns', () => {
    const keys = groupsForDate(store, sess, ['Grund', 'Rosa']).map(f => f.key);
    expect(keys).not.toContain('2026-11-02|Måndag|D#Rosa');
    expect(keys).not.toContain('2026-11-02|Måndag|E#Borttagen');
  });

  it('sorterar kolumner efter längd, så att AA kommer efter Z', () => {
    const wide = { [`${sess.slice(0, -1)}AA#Rosa`]: { groups: [['A']] }, [`${sess.slice(0, -1)}Z#Rosa`]: { groups: [['B']] } };
    expect(groupsForDate(wide, sess, ['Rosa']).map(f => f.which)).toEqual(['Z', 'AA']);
  });
});

describe('val av grupper i mobilen', () => {
  const sheet = (name: string) => parsePasted([
    '\tMåndag\t\tTisdag',
    '\t8.30-9.45\t10.00-11.45\t8.30-9.45',
    'TORA VEGA',
    `${name}\tTRUE\tTRUE\tTRUE`,
  ].join('\n'), '')!;
  const sheets = { Rosa: sheet('Ali'), Grund: sheet('Nils') };
  const sess = '2026-11-02|Måndag|B';
  const store = {
    '2026-11-02|Måndag|B#Rosa': { groups: [['Ali']] },
    '2026-11-02|Måndag|C#Grund+Rosa': { groups: [['Ali'], ['Nils']] },
    '2026-11-02|Måndag|dag#Grund': { groups: [['Nils']] },
  };

  it('ger passets tid och klasser, och vilket pass ett tryck byter till', () => {
    const opts = groupsOptions(store, sess, '2026-11-02|Måndag|B#Rosa', sheets, {});
    expect(opts).toEqual([
      { key: '2026-11-02|Måndag|C#Grund+Rosa', label: '10.00-11.45 · Grund + Rosa', count: 2, classes: ['Grund', 'Rosa'], pass: 'c2' },
      { key: '2026-11-02|Måndag|dag#Grund', label: 'Hela dagen · Grund', count: 1, classes: ['Grund'], pass: 'day' },
    ]);
  });

  it('använder passets egna namn', () => {
    const names = { '2026-11-02|Måndag|C': { Grund: 'Svenska', Rosa: 'Svenska' } };
    const opts = groupsOptions(store, sess, '', sheets, names);
    expect(opts.find(o => o.pass === 'c2')?.label).toBe('Svenska · Grund + Rosa');
  });

  it('hoppar över ett pass som inte längre finns i arket', () => {
    const gone = { '2026-11-02|Måndag|Q#Rosa': { groups: [['Ali']] } };
    expect(groupsOptions(gone, sess, '', sheets, {})).toEqual([]);
  });
});
