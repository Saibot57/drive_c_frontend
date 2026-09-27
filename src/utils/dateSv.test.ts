import { describe, expect, it } from 'vitest';
import { isoWeekday, isoWeekYear } from './dateSv';

// vitest.config.ts sätter TZ=Europe/Stockholm, så lokal midnatt ligger ett
// dygn före UTC-dygnet under hela året.
describe('isoWeekYear med Date', () => {
  it('räknar en lokal måndag strax efter midnatt till rätt vecka', () => {
    // Måndag 21 sep 2026 kl 00:30 lokal tid är söndag 22:30 i UTC.
    expect(isoWeekYear(new Date(2026, 8, 21, 0, 30))).toEqual({ week: 39, year: 2026 });
  });

  it('räknar en lokal midnatt på en måndag till rätt vecka', () => {
    expect(isoWeekYear(new Date(2026, 0, 5))).toEqual({ week: 2, year: 2026 });
    expect(isoWeekYear(new Date(2026, 7, 17))).toEqual({ week: 34, year: 2026 });
  });

  it('hanterar årsskiften', () => {
    expect(isoWeekYear(new Date(2025, 11, 29))).toEqual({ week: 1, year: 2026 });
    expect(isoWeekYear(new Date(2027, 0, 1))).toEqual({ week: 53, year: 2026 });
    expect(isoWeekYear(new Date(2027, 0, 4, 0, 15))).toEqual({ week: 1, year: 2027 });
  });

  it('ger samma svar som för dagens nyckel', () => {
    for (const [date, key] of [
      [new Date(2026, 8, 21, 0, 30), '2026-09-21'],
      [new Date(2027, 0, 1, 23, 59), '2027-01-01'],
      [new Date(2026, 2, 29, 1, 30), '2026-03-29'],
    ] as const) {
      expect(isoWeekYear(date)).toEqual(isoWeekYear(key));
    }
  });
});

describe('isoWeekday med Date', () => {
  it('ger måndag för en lokal måndag strax efter midnatt', () => {
    expect(isoWeekday(new Date(2026, 8, 21, 0, 30))).toBe(1);
  });

  it('ger söndag för en lokal söndag sent på kvällen', () => {
    expect(isoWeekday(new Date(2026, 8, 20, 23, 30))).toBe(7);
  });
});

describe('isoWeekYear med sträng', () => {
  it('är oförändrad för dagnycklar', () => {
    expect(isoWeekYear('2026-09-21')).toEqual({ week: 39, year: 2026 });
    expect(isoWeekYear('2027-01-01')).toEqual({ week: 53, year: 2026 });
  });

  it('kastar för ogiltiga värden', () => {
    expect(() => isoWeekYear('inte-ett-datum')).toThrow();
    expect(() => isoWeekYear(new Date(Number.NaN))).toThrow();
  });
});
