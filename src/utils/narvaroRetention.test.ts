import { describe, expect, it } from 'vitest';
import { isExpiredWeek } from '@/utils/narvaroDocs';
import {
  daysUntilPurge,
  dismissWeek,
  purgeBadge,
  purgeInfo,
  purgeTier,
  purgeWhen,
  sanitizeDismissed,
  weeksNearPurge,
} from '@/utils/narvaroRetention';

// v. 46 2025 börjar måndag 10/11 2025. Sista dagen den syns är 10/11 2026.
const day = (m: number, d: number, y = 2026) => new Date(y, m - 1, d, 10, 0);

describe('dagar kvar till gallring', () => {
  it('räknar till dagen efter sista dagen', () => {
    expect(daysUntilPurge('w2025-46', day(11, 10))).toBe(1);
    expect(daysUntilPurge('w2025-46', day(11, 4))).toBe(7);
    expect(daysUntilPurge('w2025-46', day(10, 28))).toBe(14);
    expect(daysUntilPurge('w2025-46', day(11, 11))).toBeNull();
  });

  it('följer samma gräns som isExpiredWeek', () => {
    for (let d = 0; d < 40; d++) {
      const now = new Date(2026, 9, 15 + d, 23, 30);
      expect(daysUntilPurge('w2025-46', now) === null).toBe(isExpiredWeek('w2025-46', now));
    }
  });

  it('räknar hela dagar över sommartiden', () => {
    // Klockan ställs fram 29/3 2026. v. 14 2025 börjar 31/3 2025.
    expect(daysUntilPurge('w2025-14', new Date(2026, 2, 25, 0, 30))).toBe(7);
    expect(daysUntilPurge('w2025-14', new Date(2026, 2, 31, 23, 59))).toBe(1);
  });

  it('följer ISO-året vid årsskiftet', () => {
    // v. 53 2026 börjar måndag 28/12 2026.
    expect(daysUntilPurge('w2026-53', day(12, 28, 2027))).toBe(1);
    expect(daysUntilPurge('w2026-53', day(12, 29, 2027))).toBeNull();
  });

  it('ger null för ogiltiga nycklar', () => {
    expect(daysUntilPurge('keyinfo', day(11, 10))).toBeNull();
    expect(purgeInfo(null, day(11, 10))).toBeNull();
  });
});

describe('trösklar och texter', () => {
  it('väljer tröskeln 14, 7 eller 1', () => {
    expect(purgeTier(15)).toBeNull();
    expect(purgeTier(14)).toBe(14);
    expect(purgeTier(8)).toBe(14);
    expect(purgeTier(7)).toBe(7);
    expect(purgeTier(2)).toBe(7);
    expect(purgeTier(1)).toBe(1);
  });

  it('nämner inte en vecka som har mer än 14 dagar kvar', () => {
    expect(purgeInfo('w2025-46', day(10, 27))).toBeNull();
    expect(purgeInfo('w2025-46', day(11, 4))).toEqual({ daysLeft: 7, tier: 7 });
  });

  it('skriver märket och tiden', () => {
    expect(purgeBadge(6)).toBe('6 dagar kvar');
    expect(purgeBadge(1)).toBe('Sista dagen');
    expect(purgeWhen(6)).toBe('om 6 dagar');
    expect(purgeWhen(1)).toBe('efter i dag');
  });
});

describe('veckor att påminna om', () => {
  const now = day(11, 5);

  it('tar med veckor inom 14 dagar, den som gallras först först', () => {
    expect(weeksNearPurge(['w2026-45', 'w2025-47', 'w2025-46', null, 'w2025-48'], now, [])).toEqual([
      { week: 'w2025-46', daysLeft: 6, tier: 7 },
      { week: 'w2025-47', daysLeft: 13, tier: 14 },
    ]);
  });

  it('hoppar över avfärdade veckor helt, även sista dagen', () => {
    expect(weeksNearPurge(['w2025-46', 'w2025-47'], day(11, 10), ['w2025-46'])).toEqual([
      { week: 'w2025-47', daysLeft: 8, tier: 14 },
    ]);
  });

  it('läser avfärdade veckor defensivt', () => {
    expect(sanitizeDismissed(null)).toEqual([]);
    expect(sanitizeDismissed('w2025-46')).toEqual([]);
    expect(sanitizeDismissed(['w2025-46', 'w2025-46', 3, 'skräp'])).toEqual(['w2025-46']);
  });

  it('släpper gallrade veckor när en ny avfärdas', () => {
    expect(dismissWeek(['w2025-40', 'w2025-46'], 'w2025-47', now)).toEqual(['w2025-46', 'w2025-47']);
    expect(dismissWeek(['w2025-46'], 'w2025-46', now)).toEqual(['w2025-46']);
  });
});
