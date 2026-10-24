import { describe, expect, it } from 'vitest';
import { countTextRows, fitsRows, minRowsFor } from './calendarRows';

describe('countTextRows', () => {
  it.each([
    ['', 0],
    ['   \n\n', 0],
    ['en rad', 1],
    ['a\nb\nc', 3],
    ['a\n\n\nb', 4],
    ['a\nb\n\n\n', 2],
  ])('%j har %i rader', (text, rows) => {
    expect(countTextRows(text)).toBe(rows);
  });
});

describe('fitsRows', () => {
  it('tillåter text upp till antalet rader', () => {
    expect(fitsRows('', 'a\nb\nc\nd\ne', 5)).toBe(true);
  });

  it('stoppar en rad för mycket, även en tom rad i slutet', () => {
    expect(fitsRows('a\nb\nc\nd\ne', 'a\nb\nc\nd\ne\n', 5)).toBe(false);
    expect(fitsRows('', 'a\nb\nc\nd\ne\nf', 5)).toBe(false);
  });

  it('låter en äldre text med fler rader redigeras utan att växa', () => {
    const old = 'a\nb\nc\nd\ne\nf';
    expect(fitsRows(old, 'a\nb\nc\nd\ne\nfg', 4)).toBe(true);
    expect(fitsRows(old, 'a\nb\nc\nd\ne', 4)).toBe(true);
    expect(fitsRows(old, `${old}\ng`, 4)).toBe(false);
  });
});

describe('minRowsFor', () => {
  it('håller sig inom 4–7', () => {
    expect(minRowsFor(0)).toBe(4);
    expect(minRowsFor(6)).toBe(6);
    expect(minRowsFor(9)).toBe(7);
  });
});
