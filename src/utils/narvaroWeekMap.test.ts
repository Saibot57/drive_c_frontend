import { describe, expect, it } from 'vitest';
import { emptySession, NotesStore } from '@/utils/narvaro';
import { CLASSES, ME, sheet, sheets, week } from '@/utils/__fixtures__/narvaroSchedule';
import {
  WeekMapInput,
  adjacentPass,
  isCellSelected,
  mapWeeks,
  sanitizeWeekMapMode,
  weekMapDays,
} from '@/utils/narvaroWeekMap';

const base = (over: Partial<WeekMapInput> = {}): WeekMapInput => ({
  sheets: sheets(),
  allClasses: CLASSES,
  chosen: ['Grund'],
  classNames: CLASSES,
  weekEntries: week(),
  myName: ME,
  notes: {},
  weekKey: 'w2026-47',
  now: new Date(2026, 10, 16, 10, 20),
  ...over,
});
const dayOf = (input: WeekMapInput, name: string) => weekMapDays(input).find(d => d.day === name)!;
const note = (name: string) => ({ ...emptySession(''), people: { [name]: { tags: [], note: 'x' } } });

describe('weekMapDays', () => {
  it('fem dagar med en ruta per kolumn i arket och rätt datum', () => {
    const days = weekMapDays(base());
    expect(days.map(d => d.day)).toEqual(['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag']);
    expect(days.map(d => d.cells.length)).toEqual([3, 3, 3, 4, 3]);
    expect(days[0].date).toEqual(new Date(2026, 10, 16));
    expect(days.map(d => d.isToday)).toEqual([true, false, false, false, false]);
  });

  it('rutan har schemats titel, lärare, tid och antal för den valda klassen', () => {
    const [b, c, d] = dayOf(base(), 'Måndag').cells;
    expect([b.letters, b.time, b.title, b.teachers]).toEqual(['B', '08:30', 'Tema Grund', ['Robin']]);
    expect(c.time).toBe('10:15');
    expect(d.present).toBe(2);
    expect(d.empty).toBe(false);
    expect(b.more).toBe(0);
  });

  it('det egna passet först bland klassernas, och fler pass räknas', () => {
    const [b] = dayOf(base({ chosen: ['Grund', 'Rosa'] }), 'Måndag').cells;
    expect(b.title).toBe('Tema Rosa');
    expect(b.mine).toBe(true);
    expect(b.more).toBe(1);
    const [, f] = dayOf(base(), 'Tisdag').cells;
    expect([f.title, f.mine, f.more]).toEqual(['Engelska 2', true, 2]);
  });

  it('utan schema heter rutorna som i arket', () => {
    const [b, , d] = dayOf(base({ weekEntries: null }), 'Måndag').cells;
    expect([b.title, b.time, b.teachers, b.mine]).toEqual(['8.30-9.45', '08:30', [], false]);
    expect(d.title).toBe('12.30-14.00');
    const [e] = dayOf(base({ weekEntries: null }), 'Tisdag').cells;
    expect([e.title, e.time]).toEqual(['Studieverkstad', '']);
  });

  it('studiebesöket slås ihop till en ruta som väljer hela dagen', () => {
    const cells = dayOf(base({ weekEntries: week({ studiebesok: true }) }), 'Torsdag').cells;
    expect(cells.map(c => c.letters)).toEqual(['K–M', 'N']);
    expect(cells[0]).toMatchObject({ pass: 'day', time: '08:30–15:30', title: 'Studiebesök i Malmö', mine: true });
    expect(cells[0].columns).toHaveLength(3);
    expect(isCellSelected(cells[0], cells[0].columns[1])).toBe(true);
    expect(isCellSelected(cells[0], 'day')).toBe(true);
    expect(cells[1].title).toBe('Studieverkstad');
  });

  it('en tom kolumn i arket', () => {
    const empty = sheet(['Ingen Kryss']);
    empty.people[0].marks = empty.people[0].marks.map(m => (m === null ? null : false));
    const [b] = dayOf(base({ sheets: { ...sheets(), Grund: empty } }), 'Måndag').cells;
    expect([b.present, b.empty]).toEqual([0, true]);
  });

  it('pricken: bara noteringar från de valda klasserna', () => {
    const notes: NotesStore = { '2026-11-16|Måndag|D': note('Oliv Ett') };
    expect(dayOf(base({ notes }), 'Måndag').cells[2].hasNotes).toBe(false);
    expect(dayOf(base({ notes, chosen: ['Oliv'] }), 'Måndag').cells[2].hasNotes).toBe(true);
    const grund: NotesStore = { '2026-11-16|Måndag|D': note('Grund Ett') };
    expect(dayOf(base({ notes: grund }), 'Måndag').cells.map(c => c.hasNotes)).toEqual([false, false, true]);
  });

  it('en ihopslagen ruta får pricken av hela dagens eller en kolumns noteringar', () => {
    const input = (notes: NotesStore) => base({ notes, weekEntries: week({ studiebesok: true }) });
    expect(dayOf(input({ '2026-11-19|Torsdag|dag': note('Grund Ett') }), 'Torsdag').cells[0].hasNotes).toBe(true);
    expect(dayOf(input({ '2026-11-19|Torsdag|L': note('Grund Ett') }), 'Torsdag').cells[0].hasNotes).toBe(true);
    expect(dayOf(input({}), 'Torsdag').cells[0].hasNotes).toBe(false);
  });

  it('en tidigare vecka räknar datumen från sin måndag', () => {
    const days = weekMapDays(base({ weekKey: 'w2026-46' }));
    expect(days[0].date).toEqual(new Date(2026, 10, 9));
    expect(days.some(d => d.isToday)).toBe(false);
    const notes: NotesStore = { '2026-11-09|Måndag|B': note('Grund Ett') };
    expect(weekMapDays(base({ weekKey: 'w2026-46', notes }))[0].cells[0].hasNotes).toBe(true);
  });
});

describe('adjacentPass', () => {
  const days = weekMapDays(base({ weekEntries: week({ studiebesok: true }) }));
  const id = (day: string, i: number) => days.find(d => d.day === day)!.cells[i].pass;

  it('går framåt och bakåt inom dagen och över dagar', () => {
    expect(adjacentPass(days, 'Måndag', id('Måndag', 0), 1)).toEqual({ day: 'Måndag', pass: id('Måndag', 1) });
    expect(adjacentPass(days, 'Måndag', id('Måndag', 2), 1)).toEqual({ day: 'Tisdag', pass: id('Tisdag', 0) });
    expect(adjacentPass(days, 'Tisdag', id('Tisdag', 0), -1)).toEqual({ day: 'Måndag', pass: id('Måndag', 2) });
  });
  it('en ihopslagen ruta är ett steg', () => {
    expect(adjacentPass(days, 'Onsdag', id('Onsdag', 2), 1)).toEqual({ day: 'Torsdag', pass: 'day' });
    expect(adjacentPass(days, 'Torsdag', 'day', 1)).toEqual({ day: 'Torsdag', pass: id('Torsdag', 1) });
  });
  it('från hela dagen: framåt till dagens första, bakåt till förra dagens sista', () => {
    expect(adjacentPass(days, 'Tisdag', 'day', 1)).toEqual({ day: 'Tisdag', pass: id('Tisdag', 0) });
    expect(adjacentPass(days, 'Tisdag', 'day', -1)).toEqual({ day: 'Måndag', pass: id('Måndag', 2) });
  });
  it('null vid veckans början och slut', () => {
    expect(adjacentPass(days, 'Måndag', id('Måndag', 0), -1)).toBeNull();
    expect(adjacentPass(days, 'Fredag', id('Fredag', 2), 1)).toBeNull();
    expect(adjacentPass(days, 'Måndag', 'day', -1)).toBeNull();
  });
});

describe('mapWeeks', () => {
  it('veckor med ark eller noteringar och den här veckan, äldst först', () => {
    const tables = { 'w2026-45': { Grund: sheet(['A B']) }, 'w2026-44': {} };
    const notes: NotesStore = {
      '2026-11-10|Tisdag|F': note('A B'),
      '2026-10-27|Tisdag|F': emptySession('tom'),
    };
    expect(mapWeeks(tables, notes, 'w2026-47')).toEqual([
      { week: 'w2026-45', hasNotes: false },
      { week: 'w2026-46', hasNotes: true },
      { week: 'w2026-47', hasNotes: false },
    ]);
  });
});

describe('sanitizeWeekMapMode', () => {
  it('bara day eller week', () => {
    expect(sanitizeWeekMapMode('day')).toBe('day');
    expect(sanitizeWeekMapMode('week')).toBe('week');
    expect(sanitizeWeekMapMode(3)).toBe('week');
  });
});
