/**
 * Tester för månadskalenderns datumlager.
 *
 * Körs med TZ=Europe/Stockholm (satt i vitest.config.ts) eftersom flera fall
 * bara är meningsfulla i en tidszon med sommartid och positiv UTC-offset.
 */
import { describe, expect, it } from 'vitest';

import {
  DAYS_IN_MATRIX,
  formatMonthTitle,
  formatSwedishDate,
  fromLocalDateKey,
  getIsoWeek,
  getIsoWeekYear,
  getMatrixRange,
  getMatrixRows,
  getMonthMatrix,
  isValidDateKey,
  localIsoWeekday,
  shiftMonth,
  toLocalDateKey,
} from './calendarDates';

describe('toLocalDateKey', () => {
  it('bygger nyckeln ur lokala komponenter', () => {
    expect(toLocalDateKey(new Date(2026, 7, 14))).toBe('2026-08-14');
  });

  it('nollutfyller månad och dag', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('ger rätt dag vid lokal midnatt under sommartid', () => {
    // Lokal midnatt 14 aug är 13 aug 22:00 UTC. toISOString() hade gett
    // '2026-08-13' — det är precis buggen som finns i calendarService.
    const localMidnight = new Date(2026, 7, 14, 0, 0, 0);
    expect(toLocalDateKey(localMidnight)).toBe('2026-08-14');
    expect(localMidnight.toISOString().split('T')[0]).toBe('2026-08-13');
  });

  it('ger rätt dag strax före midnatt', () => {
    expect(toLocalDateKey(new Date(2026, 7, 14, 23, 59, 59))).toBe('2026-08-14');
  });

  it('håller ihop över sommartidens början', () => {
    // Sommartid börjar 29 mars 2026 (klockan går 02 -> 03).
    expect(toLocalDateKey(new Date(2026, 2, 29, 0, 30))).toBe('2026-03-29');
    expect(toLocalDateKey(new Date(2026, 2, 29, 23, 30))).toBe('2026-03-29');
    expect(toLocalDateKey(new Date(2026, 2, 30, 0, 30))).toBe('2026-03-30');
  });

  it('håller ihop över sommartidens slut', () => {
    // Sommartid slutar 25 oktober 2026 (klockan går 03 -> 02, dygnet är 25 h).
    expect(toLocalDateKey(new Date(2026, 9, 25, 0, 30))).toBe('2026-10-25');
    expect(toLocalDateKey(new Date(2026, 9, 25, 23, 30))).toBe('2026-10-25');
    expect(toLocalDateKey(new Date(2026, 9, 26, 0, 30))).toBe('2026-10-26');
  });
});

describe('fromLocalDateKey', () => {
  it('är invers till toLocalDateKey', () => {
    for (const key of ['2026-01-01', '2026-08-14', '2026-12-31', '2028-02-29']) {
      expect(toLocalDateKey(fromLocalDateKey(key))).toBe(key);
    }
  });

  it('ger lokal midnatt, inte UTC-midnatt', () => {
    const d = fromLocalDateKey('2026-08-14');
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(14);
  });

  it('överlever sommartidsdygnen', () => {
    expect(toLocalDateKey(fromLocalDateKey('2026-03-29'))).toBe('2026-03-29');
    expect(toLocalDateKey(fromLocalDateKey('2026-10-25'))).toBe('2026-10-25');
  });
});

describe('isValidDateKey', () => {
  it.each(['2026-08-14', '2028-02-29', '2026-01-01', '2026-12-31'])(
    'godtar %s',
    (key) => expect(isValidDateKey(key)).toBe(true),
  );

  it.each([
    '2026-8-14',            // inte nollutfyllt
    '2026-13-01',           // månad 13
    '2026-02-30',           // finns inte
    '2027-02-29',           // inte skottår
    '2026-00-10',           // månad 0
    '2026-08-00',           // dag 0
    '14/08/2026',
    'idag',
    '',
  ])('avvisar %s', (key) => expect(isValidDateKey(key)).toBe(false));
});

describe('localIsoWeekday', () => {
  it('ger 1 för måndag och 7 för söndag', () => {
    expect(localIsoWeekday(new Date(2026, 7, 17))).toBe(1); // måndag
    expect(localIsoWeekday(new Date(2026, 7, 23))).toBe(7); // söndag
  });
});

describe('getIsoWeek', () => {
  it('räknar rätt mitt i året', () => {
    expect(getIsoWeek('2026-08-14')).toBe(33);
    expect(getIsoWeek('2026-08-17')).toBe(34);
  });

  it('ger samma vecka för hela måndag-söndag', () => {
    const veckan = [
      '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20',
      '2026-08-21', '2026-08-22', '2026-08-23',
    ];
    expect(veckan.map(getIsoWeek)).toEqual([34, 34, 34, 34, 34, 34, 34]);
  });

  it('lägger vecka 1 i december när året börjar så', () => {
    // 2026 börjar på en torsdag, så v.1 2026 startar redan 29 dec 2025.
    expect(getIsoWeekYear('2025-12-28')).toEqual({ week: 52, year: 2025 });
    expect(getIsoWeekYear('2025-12-29')).toEqual({ week: 1, year: 2026 });
    expect(getIsoWeekYear('2026-01-01')).toEqual({ week: 1, year: 2026 });
    expect(getIsoWeekYear('2026-01-04')).toEqual({ week: 1, year: 2026 });
    expect(getIsoWeekYear('2026-01-05')).toEqual({ week: 2, year: 2026 });
  });

  it('lägger januaridagar i föregående års sista vecka när året börjar sent i veckan', () => {
    // 2027 börjar på en fredag: 1-3 jan tillhör v.53 2026.
    expect(getIsoWeekYear('2027-01-01')).toEqual({ week: 53, year: 2026 });
    expect(getIsoWeekYear('2027-01-04')).toEqual({ week: 1, year: 2027 });
  });

  it('ger 53 veckor för ett långt år', () => {
    expect(getIsoWeekYear('2026-12-31')).toEqual({ week: 53, year: 2026 });
  });

  it('är korrekt för måndagar — regressionsvakt', () => {
    // isoWeekYear läser med getUTC*. Skickas ett lokalt Date-objekt för en
    // måndag pekar det på söndagen före i UTC och veckan blir ett för låg.
    // Varje rad i matrisen börjar på en måndag, så det här måste hålla.
    const måndagar: Array<[string, number]> = [
      ['2026-08-17', 34],
      ['2026-01-05', 2],
      ['2025-12-29', 1],
      ['2026-06-01', 23],
    ];
    for (const [key, week] of måndagar) {
      expect(getIsoWeek(key)).toBe(week);
    }
  });
});

describe('getMonthMatrix', () => {
  it('ger alltid 42 celler', () => {
    for (let m = 0; m < 12; m++) {
      expect(getMonthMatrix(2026, m)).toHaveLength(DAYS_IN_MATRIX);
    }
    // Även februari i ett skottår som börjar på måndag (28 dagar / 4 veckor).
    expect(getMonthMatrix(2021, 1)).toHaveLength(42);
  });

  it('börjar alltid på en måndag', () => {
    for (let m = 0; m < 12; m++) {
      expect(localIsoWeekday(getMonthMatrix(2026, m)[0].date)).toBe(1);
    }
  });

  it('ger sammanhängande dagar utan hopp', () => {
    const cells = getMonthMatrix(2026, 7);
    for (let i = 1; i < cells.length; i++) {
      const diff = (cells[i].date.getTime() - cells[i - 1].date.getTime()) / 86400000;
      // Sommartidsdygn är 23 eller 25 timmar, så jämför avrundat.
      expect(Math.round(diff)).toBe(1);
    }
  });

  it('placerar augusti 2026 rätt', () => {
    // 1 aug 2026 är en lördag, så matrisen börjar måndag 27 juli.
    const cells = getMonthMatrix(2026, 7);
    expect(cells[0].key).toBe('2026-07-27');
    expect(cells[0].inMonth).toBe(false);
    expect(cells[5].key).toBe('2026-08-01');
    expect(cells[5].inMonth).toBe(true);
    expect(cells[41].key).toBe('2026-09-06');
    expect(cells[41].inMonth).toBe(false);
  });

  it('hanterar en månad som börjar på söndag', () => {
    // 1 mars 2026 är en söndag: matrisen börjar måndag 23 februari.
    const cells = getMonthMatrix(2026, 2);
    expect(cells[0].key).toBe('2026-02-23');
    expect(cells[6].key).toBe('2026-03-01');
    expect(cells[6].inMonth).toBe(true);
  });

  it('hanterar en månad som börjar på måndag utan att backa en vecka', () => {
    // 1 juni 2026 är en måndag.
    const cells = getMonthMatrix(2026, 5);
    expect(cells[0].key).toBe('2026-06-01');
    expect(cells[0].inMonth).toBe(true);
  });

  it('markerar exakt månadens dagar som inMonth', () => {
    const cells = getMonthMatrix(2026, 7); // augusti har 31 dagar
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
    expect(cells.filter((c) => c.inMonth).map((c) => c.dayOfMonth))
      .toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it('tar med skottdagen', () => {
    const cells = getMonthMatrix(2028, 1);
    const feb = cells.filter((c) => c.inMonth);
    expect(feb).toHaveLength(29);
    expect(feb[28].key).toBe('2028-02-29');
  });

  it('utelämnar 29 februari ett icke-skottår', () => {
    const feb = getMonthMatrix(2027, 1).filter((c) => c.inMonth);
    expect(feb).toHaveLength(28);
    expect(feb.map((c) => c.key)).not.toContain('2027-02-29');
  });

  it('spänner över årsskiftet', () => {
    const cells = getMonthMatrix(2026, 11); // december 2026
    expect(cells.some((c) => c.key.startsWith('2027-01'))).toBe(true);
    expect(cells.find((c) => c.key === '2026-12-31')?.inMonth).toBe(true);
  });

  it('ger korrekta veckonummer runt årsskiftet', () => {
    const cells = getMonthMatrix(2026, 0); // januari 2026
    expect(cells[0].key).toBe('2025-12-29');
    expect(cells[0].isoWeek).toBe(1); // v.1 2026 börjar i december
    expect(cells.find((c) => c.key === '2026-01-05')?.isoWeek).toBe(2);
  });

  it('ger samma veckonummer för alla sju celler i en rad', () => {
    for (const row of getMatrixRows(getMonthMatrix(2026, 7))) {
      const weeks = new Set(row.map((c) => c.isoWeek));
      expect(weeks.size).toBe(1);
    }
  });
});

describe('getMatrixRows', () => {
  it('delar 42 celler i 6 rader om 7', () => {
    const rows = getMatrixRows(getMonthMatrix(2026, 7));
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.length === 7)).toBe(true);
  });
});

describe('getMatrixRange', () => {
  it('ger första och sista nyckeln', () => {
    expect(getMatrixRange(getMonthMatrix(2026, 7)))
      .toEqual({ start: '2026-07-27', end: '2026-09-06' });
  });

  it('spänner aldrig mer än backendens tak på 62 dagar', () => {
    for (let y = 2025; y <= 2028; y++) {
      for (let m = 0; m < 12; m++) {
        const { start, end } = getMatrixRange(getMonthMatrix(y, m));
        const days =
          Math.round(
            (fromLocalDateKey(end).getTime() - fromLocalDateKey(start).getTime()) / 86400000,
          ) + 1;
        expect(days).toBe(42);
      }
    }
  });
});

describe('shiftMonth', () => {
  it('går framåt och bakåt', () => {
    expect(shiftMonth(2026, 7, 1)).toEqual({ year: 2026, month: 8 });
    expect(shiftMonth(2026, 7, -1)).toEqual({ year: 2026, month: 6 });
  });

  it('rullar över årsskiftet', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe('formatering', () => {
  it('versaliserar månadsrubriken', () => {
    expect(formatMonthTitle(2026, 7)).toBe('Augusti 2026');
    expect(formatMonthTitle(2026, 0)).toBe('Januari 2026');
  });

  it('skriver fullständigt svenskt datum med gemen månad', () => {
    expect(formatSwedishDate('2026-08-14')).toBe('Fredag 14 augusti 2026');
    expect(formatSwedishDate('2026-08-17')).toBe('Måndag 17 augusti 2026');
    expect(formatSwedishDate('2026-01-01')).toBe('Torsdag 1 januari 2026');
  });
});
