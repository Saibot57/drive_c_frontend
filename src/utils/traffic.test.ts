import { describe, expect, it } from 'vitest';
import { changeFrom, dayLabel, formatCount, formatShare, axisTicks, timeLabel } from './traffic';

describe('dayLabel', () => {
  it('ger veckodag och dag/månad oavsett lokal tidszon', () => {
    expect(dayLabel('2026-11-03')).toBe('tis 3/11');
    expect(dayLabel('2026-11-01')).toBe('sön 1/11');
  });
});

describe('timeLabel', () => {
  it('visar tiden som backend skrev den', () => {
    expect(timeLabel('2026-11-04T00:30+01:00')).toBe('4/11 00:30');
  });

  it('lämnar okänt format orört', () => {
    expect(timeLabel('igår')).toBe('igår');
  });
});

describe('changeFrom', () => {
  it('räknar förändringen i procent', () => {
    expect(changeFrom(120, 100)).toEqual({ text: '+20 %', direction: 'up' });
    expect(changeFrom(75, 100)).toEqual({ text: '−25 %', direction: 'down' });
    expect(changeFrom(100, 100)).toEqual({ text: '±0 %', direction: 'same' });
  });

  it('jämför inte när perioden före saknas eller är noll', () => {
    expect(changeFrom(10, null)).toBeNull();
    expect(changeFrom(10, undefined)).toBeNull();
    expect(changeFrom(10, 0)).toBeNull();
  });
});

describe('formatCount och formatShare', () => {
  it('formaterar som på svenska', () => {
    expect(formatCount(2699)).toBe('2 699');
    expect(formatCount(42)).toBe('42');
    expect(formatShare(362, 458)).toBe('79 %');
    expect(formatShare(1, 0)).toBe('–');
  });
});

describe('axisTicks', () => {
  it('ger jämna steg från noll upp över värdet', () => {
    expect(axisTicks(377)).toEqual([0, 100, 200, 300, 400]);
    expect(axisTicks(220)).toEqual([0, 100, 200, 300]);
    expect(axisTicks(203)).toEqual([0, 100, 200, 300]);
    expect(axisTicks(40)).toEqual([0, 10, 20, 30, 40]);
  });

  it('klarar små tal och noll', () => {
    expect(axisTicks(3)).toEqual([0, 1, 2, 3]);
    expect(axisTicks(0)).toEqual([0, 1]);
  });
});
