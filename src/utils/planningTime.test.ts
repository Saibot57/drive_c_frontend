import { describe, expect, it } from 'vitest';
import { DEFAULT_PLANNING_MIN_GAP_MINUTES, PLANNER_DAYS } from '@/config/plannerConstants';
import {
  computePlanningByDay,
  parsePlanningQuery,
  sanitizePlanningMinGap,
  subtractIntervals
} from '@/utils/planningTime';

// Luckräkningen mot hela scheman täcks av fixturerna i
// `components/schedule/__fixtures__/planningTime.ts`. Här prövas delarna.

describe('parsePlanningQuery', () => {
  const teachers = ['Tobias Lundh', 'Anna Berg', 'Bo'];

  it('kräver både nyckelordet och minst en lärare', () => {
    expect(parsePlanningQuery('', teachers).isPlanning).toBe(false);
    expect(parsePlanningQuery('Tobias', teachers).isPlanning).toBe(false);
    expect(parsePlanningQuery('planering', teachers).isPlanning).toBe(false);
    expect(parsePlanningQuery('planering okänd', teachers).isPlanning).toBe(false);
  });

  it('hittar lärare på del av namnet och sparar ord som inte träffade', () => {
    expect(parsePlanningQuery('Planering tobias xyz', teachers)).toEqual({
      isPlanning: true,
      terms: ['tobias'],
      teachers: ['Tobias Lundh'],
      ignoredWords: ['xyz'],
      label: 'Tobias Lundh'
    });
  });

  it('delar på blanksteg, semikolon, plus och komma', () => {
    const query = parsePlanningQuery('planering;tobias+anna,bo', teachers);
    expect(query.teachers).toEqual(['Tobias Lundh', 'Anna Berg', 'Bo']);
    expect(query.label).toBe('Tobias Lundh, Anna Berg, Bo');
  });

  it('låter "alla" peka ut hela lärarmängden', () => {
    const query = parsePlanningQuery('alla planering', teachers);
    expect(query.teachers).toEqual(teachers);
    expect(query.terms).toEqual(teachers);
    expect(query.label).toBe('alla lärare');
  });

  it('visar en person med två stavningar en gång i etiketten men räknar med båda', () => {
    const query = parsePlanningQuery('planering tobias', ['Tobias', 'Tobias Lundh']);
    expect(query.teachers).toEqual(['Tobias', 'Tobias Lundh']);
    expect(query.label).toBe('Tobias Lundh');
  });
});

describe('subtractIntervals', () => {
  const frame = { start: 480, end: 1020 };

  it('lämnar ramen orörd utan bortfall', () => {
    expect(subtractIntervals(frame, [])).toEqual([frame]);
  });

  it('klipper ut bortfall och slår ihop dem som överlappar', () => {
    expect(subtractIntervals(frame, [
      { start: 600, end: 660 },
      { start: 630, end: 720 },
      { start: 900, end: 960 }
    ])).toEqual([
      { start: 480, end: 600 },
      { start: 720, end: 900 },
      { start: 960, end: 1020 }
    ]);
  });

  it('klipper bortfall som sticker ut utanför ramen', () => {
    expect(subtractIntervals(frame, [{ start: 400, end: 500 }, { start: 1000, end: 1100 }]))
      .toEqual([{ start: 500, end: 1000 }]);
  });

  it('ger ingenting när ramen är tom eller helt täckt', () => {
    expect(subtractIntervals({ start: 600, end: 600 }, [])).toEqual([]);
    expect(subtractIntervals(frame, [{ start: 0, end: 1440 }])).toEqual([]);
  });
});

describe('sanitizePlanningMinGap', () => {
  it('faller tillbaka på standarden för skräp', () => {
    expect(sanitizePlanningMinGap(undefined)).toBe(DEFAULT_PLANNING_MIN_GAP_MINUTES);
    expect(sanitizePlanningMinGap('abc')).toBe(DEFAULT_PLANNING_MIN_GAP_MINUTES);
    expect(sanitizePlanningMinGap(Number.NaN)).toBe(DEFAULT_PLANNING_MIN_GAP_MINUTES);
  });

  it('läser text, avrundar och håller sig mellan 0 och 240', () => {
    expect(sanitizePlanningMinGap('30')).toBe(30);
    expect(sanitizePlanningMinGap(12.6)).toBe(13);
    expect(sanitizePlanningMinGap(-5)).toBe(0);
    expect(sanitizePlanningMinGap(1000)).toBe(240);
  });
});

describe('computePlanningByDay', () => {
  it('ger varje veckodag ett tomt resultat när sökningen inte är planering', () => {
    const result = computePlanningByDay({
      schedule: [],
      query: parsePlanningQuery('', []),
      availability: {},
      minGapMinutes: DEFAULT_PLANNING_MIN_GAP_MINUTES
    });
    expect(Object.keys(result)).toEqual([...PLANNER_DAYS]);
    Object.values(result).forEach(day => {
      expect(day).toEqual({ blocks: [], isDayOff: false, totalMinutes: 0 });
    });
  });
});
