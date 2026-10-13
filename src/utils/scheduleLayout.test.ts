import { describe, expect, it } from 'vitest';
import { buildDayLayout, moveInLane, resolveLaneDrop, stepInLane } from '@/utils/scheduleLayout';

type Entry = {
  instanceId: string;
  title: string;
  color: string;
  day: string;
  startTime: string;
  endTime: string;
  laneOrder?: number;
};

const entry = (instanceId: string, startTime: string, endTime: string, extra: Partial<Entry> = {}): Entry => ({
  instanceId,
  title: instanceId,
  color: '#cccccc',
  day: 'Fredag',
  startTime,
  endTime,
  ...extra,
});

/** Id:na i den ordning de står från vänster till höger. */
const leftToRight = (entries: Entry[], ids: string[]) => {
  const layout = buildDayLayout(entries);
  return [...ids].sort((a, b) => layout.get(a)!.column - layout.get(b)!.column);
};

describe('buildDayLayout', () => {
  it('ordnar samtidiga poster efter titel när ingen ordning är satt', () => {
    const entries = [entry('Studiero', '08:30', '09:30'), entry('Feedback', '08:30', '09:30'), entry('Ma 1', '08:30', '09:30')];
    expect(leftToRight(entries, ['Studiero', 'Feedback', 'Ma 1'])).toEqual(['Feedback', 'Ma 1', 'Studiero']);
  });

  it('låter laneOrder gå före sluttid och titel', () => {
    const entries = [
      entry('Ma2', '09:45', '11:00', { laneOrder: 1 }),
      entry('Feedback', '09:45', '11:30', { laneOrder: 0 }),
    ];
    expect(leftToRight(entries, ['Ma2', 'Feedback'])).toEqual(['Feedback', 'Ma2']);
  });

  it('lägger poster utan ordning efter dem som har en', () => {
    const entries = [entry('A', '08:00', '09:00'), entry('B', '08:00', '09:00', { laneOrder: 0 })];
    expect(leftToRight(entries, ['A', 'B'])).toEqual(['B', 'A']);
  });

  it('flyttar aldrig en senare post före en tidigare', () => {
    const entries = [entry('Tidig', '08:00', '10:00', { laneOrder: 5 }), entry('Sen', '09:00', '10:00', { laneOrder: 0 })];
    expect(leftToRight(entries, ['Tidig', 'Sen'])).toEqual(['Tidig', 'Sen']);
  });

  it('ger lika många spalter oavsett ordning bland samtidiga', () => {
    const base = [entry('Lång', '08:00', '11:00'), entry('Kort', '08:00', '09:00'), entry('Sen', '09:00', '10:00')];
    const a = buildDayLayout(base);
    const b = buildDayLayout(moveInLane(base, 'Lång', 1));
    expect(a.get('Lång')!.columns).toBe(2);
    expect(b.get('Lång')!.columns).toBe(2);
  });
});

describe('moveInLane', () => {
  const entries = [entry('A', '08:30', '09:30'), entry('B', '08:30', '09:30'), entry('C', '08:30', '09:30'), entry('Paus', '09:30', '09:45')];

  it('flyttar posten och numrerar alla samtidiga', () => {
    const next = moveInLane(entries, 'A', 2);
    expect(leftToRight(next, ['A', 'B', 'C'])).toEqual(['B', 'C', 'A']);
    expect(next.filter(e => e.startTime === '08:30').map(e => [e.instanceId, e.laneOrder])).toEqual([
      ['A', 2], ['B', 0], ['C', 1],
    ]);
    expect(next.find(e => e.instanceId === 'Paus')).toBe(entries[3]);
  });

  it('lämnar listan orörd när posten redan står där', () => {
    expect(moveInLane(entries, 'B', 1)).toBe(entries);
  });

  it('rör inte samma tid en annan dag', () => {
    const withMonday = [...entries, entry('M', '08:30', '09:30', { day: 'Måndag' })];
    const next = moveInLane(withMonday, 'C', 0);
    expect(next.find(e => e.instanceId === 'M')!.laneOrder).toBeUndefined();
  });
});

describe('stepInLane', () => {
  const entries = [entry('A', '08:30', '09:30'), entry('B', '08:30', '09:30')];

  it('byter plats med grannen', () => {
    expect(leftToRight(stepInLane(entries, 'A', 1), ['A', 'B'])).toEqual(['B', 'A']);
  });

  it('gör ingenting vid kanten eller för en ensam post', () => {
    expect(stepInLane(entries, 'A', -1)).toBe(entries);
    expect(stepInLane(entries, 'B', 1)).toBe(entries);
    const alone = [entry('X', '10:00', '11:00')];
    expect(stepInLane(alone, 'X', 1)).toBe(alone);
  });
});

describe('resolveLaneDrop', () => {
  it('väljer platsen under pekaren', () => {
    const entries = [entry('A', '08:30', '09:30'), entry('B', '08:30', '09:30'), entry('C', '08:30', '09:30'), entry('D', '08:30', '09:30')];
    expect(resolveLaneDrop(entries, 'A', 0.1)).toEqual({ index: 0, column: 0, columns: 4 });
    expect(resolveLaneDrop(entries, 'A', 0.6)).toEqual({ index: 2, column: 2, columns: 4 });
    expect(resolveLaneDrop(entries, 'A', 1)).toEqual({ index: 3, column: 3, columns: 4 });
  });

  it('räknar med spalter som en tidigare post håller', () => {
    const entries = [entry('Tidig', '08:00', '10:00'), entry('A', '09:00', '10:00'), entry('B', '09:00', '10:00')];
    // Tidig står i spalt 0, så A och B delar spalt 1 och 2.
    expect(resolveLaneDrop(entries, 'B', 0.1)).toEqual({ index: 0, column: 1, columns: 3 });
    expect(resolveLaneDrop(entries, 'A', 0.9)).toEqual({ index: 1, column: 2, columns: 3 });
  });

  it('har inget att säga om en ensam post', () => {
    expect(resolveLaneDrop([entry('X', '10:00', '11:00')], 'X', 0.5)).toBeNull();
  });
});
