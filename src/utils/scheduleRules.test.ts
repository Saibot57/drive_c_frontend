import { describe, expect, it, vi } from 'vitest';
import { RestrictionRule, ScheduledEntry } from '@/types/schedule';
import {
  blocksWholeDay,
  evaluatePlacement,
  findAvailabilityWarning,
  findRestrictionConflict,
  PlacementCandidate,
  reportPlacementVerdict,
  sanitizeTeacherAvailability,
  wildcardMatch
} from '@/utils/scheduleRules';

const entry = (
  instanceId: string,
  title: string,
  startTime: string,
  endTime: string,
  day = 'Måndag'
): ScheduledEntry => ({
  id: instanceId,
  instanceId,
  title,
  teacher: '',
  room: '',
  color: '#ffffff',
  duration: 60,
  day,
  startTime,
  endTime
});

const candidate = (overrides: Partial<PlacementCandidate> = {}): PlacementCandidate => ({
  title: 'Matematik',
  teacher: '',
  day: 'Måndag',
  startTime: '09:00',
  endTime: '10:00',
  ...overrides
});

const rule = (subjectA: string, subjectB: string): RestrictionRule => ({ id: `${subjectA}-${subjectB}`, subjectA, subjectB });

describe('wildcardMatch', () => {
  it('låter * stå för vad som helst och bryr sig inte om versaler', () => {
    expect(wildcardMatch('ma*', 'Matematik 1c')).toBe(true);
    expect(wildcardMatch('*tik*', 'Matematik 1c')).toBe(true);
  });

  it('kräver att hela titeln matchar', () => {
    expect(wildcardMatch('Ma', 'Matematik')).toBe(false);
  });

  it('läser regex-tecken bokstavligt', () => {
    expect(wildcardMatch('Sv (grp 1)', 'Sv (grp 1)')).toBe(true);
    expect(wildcardMatch('Sv.', 'Sva')).toBe(false);
    expect(wildcardMatch('Ma?', 'Mat')).toBe(false);
  });
});

describe('findRestrictionConflict', () => {
  const schedule = [entry('idrott', 'Idrott', '09:30', '10:30')];
  const rules = [rule('Ma*', 'Idrott')];

  it('blockerar en placering som krockar med en förbjuden kombination', () => {
    expect(findRestrictionConflict(candidate(), schedule, rules))
      .toBe('Krock! "Matematik" krockar med "Idrott" (09:30-10:30).');
  });

  it('gäller åt båda hållen i regeln', () => {
    expect(findRestrictionConflict(candidate(), schedule, [rule('Idrott', 'Ma*')])).not.toBeNull();
  });

  it('släpper igenom utan regler, utan överlapp och på andra dagar', () => {
    expect(findRestrictionConflict(candidate(), schedule, [])).toBeNull();
    expect(findRestrictionConflict(candidate({ startTime: '08:30', endTime: '09:30' }), schedule, rules)).toBeNull();
    expect(findRestrictionConflict(candidate({ day: 'Tisdag' }), schedule, rules)).toBeNull();
  });

  it('räknar inte posten som flyttas som en krock med sig själv', () => {
    const self = [entry('ma', 'Matematik', '09:00', '10:00'), entry('idrott2', 'Matematik', '09:00', '10:00')];
    expect(findRestrictionConflict(candidate({ instanceId: 'ma' }), self, [rule('Ma*', 'Ma*')]))
      .toBe('Krock! "Matematik" krockar med "Matematik" (09:00-10:00).');
    expect(findRestrictionConflict(candidate({ instanceId: 'ma' }), [self[0]], [rule('Ma*', 'Ma*')])).toBeNull();
  });
});

describe('sanitizeTeacherAvailability', () => {
  it('ger ett tomt objekt för allt som inte är ett objekt', () => {
    expect(sanitizeTeacherAvailability(null)).toEqual({});
    expect(sanitizeTeacherAvailability('Anna')).toEqual({});
    expect(sanitizeTeacherAvailability([{ Anna: {} }])).toEqual({});
  });

  it('rensar okända spärrar, dubbletter och tomma dagar och lärare', () => {
    expect(sanitizeTeacherAvailability({
      Anna: { Måndag: ['fm', 'fm', 'kväll', 3], Tisdag: [], Onsdag: 'all' },
      Bo: { Måndag: ['nej'] },
      '  ': { Måndag: ['all'] },
      Cia: ['all']
    })).toEqual({ Anna: { Måndag: ['fm'] } });
  });
});

describe('blocksWholeDay', () => {
  it('räknar både "all" och fm + em som hela dagen', () => {
    expect(blocksWholeDay(['all'])).toBe(true);
    expect(blocksWholeDay(['fm', 'em'])).toBe(true);
    expect(blocksWholeDay(['fm'])).toBe(false);
    expect(blocksWholeDay([])).toBe(false);
  });
});

describe('findAvailabilityWarning', () => {
  const availability = {
    Anna: { Måndag: ['fm' as const] },
    Bo: { Måndag: ['em' as const] },
    Cia: { Måndag: ['all' as const] }
  };

  it('varnar när läraren är spärrad den delen av dagen', () => {
    expect(findAvailabilityWarning(candidate({ teacher: 'Anna' }), availability))
      .toBe('Anna är inte tillgänglig måndag förmiddag');
    expect(findAvailabilityWarning(candidate({ teacher: 'Cia' }), availability))
      .toBe('Cia är inte tillgänglig måndag');
  });

  it('låter en lektion över 12:00 passera halvdagsspärrar men inte heldagsspärrar', () => {
    const overNoon = { startTime: '11:00', endTime: '13:00' };
    expect(findAvailabilityWarning(candidate({ teacher: 'Anna', ...overNoon }), availability)).toBeNull();
    expect(findAvailabilityWarning(candidate({ teacher: 'Bo', ...overNoon }), availability)).toBeNull();
    expect(findAvailabilityWarning(candidate({ teacher: 'Cia', ...overNoon }), availability)).not.toBeNull();
  });

  it('matchar namn utan hänsyn till versaler och prövar varje namn i fältet', () => {
    expect(findAvailabilityWarning(candidate({ teacher: 'anna, Cia' }), availability))
      .toBe('anna är inte tillgänglig måndag förmiddag. Cia är inte tillgänglig måndag');
  });

  it('är tyst utan lärare, utan spärrar eller på en ledig dag', () => {
    expect(findAvailabilityWarning(candidate({ teacher: '' }), availability)).toBeNull();
    expect(findAvailabilityWarning(candidate({ teacher: 'Anna' }), {})).toBeNull();
    expect(findAvailabilityWarning(candidate({ teacher: 'Anna', day: 'Tisdag' }), availability)).toBeNull();
  });

  it('prövar hela lärarmängden för "alla" och summerar långa listor', () => {
    const everyone = {
      A: { Måndag: ['all' as const] },
      B: { Måndag: ['all' as const] },
      C: { Måndag: ['all' as const] },
      D: { Måndag: ['all' as const] }
    };
    expect(findAvailabilityWarning(candidate({ teacher: 'alla' }), everyone, ['A', 'B', 'C', 'D']))
      .toBe('A och 3 andra är inte tillgängliga måndag');
    expect(findAvailabilityWarning(candidate({ teacher: 'alla' }), everyone, ['A', 'B']))
      .toBe('A är inte tillgänglig måndag. B är inte tillgänglig måndag');
  });
});

describe('evaluatePlacement och reportPlacementVerdict', () => {
  const schedule = [entry('idrott', 'Idrott', '09:30', '10:30')];
  const availability = { Anna: { Måndag: ['fm' as const] } };

  it('skiljer hårda ämnesregler från mjuka lärarvarningar', () => {
    expect(evaluatePlacement(candidate({ teacher: 'Anna' }), schedule, [rule('Ma*', 'Idrott')], availability)).toEqual({
      blocked: 'Krock! "Matematik" krockar med "Idrott" (09:30-10:30).',
      warning: 'Anna är inte tillgänglig måndag förmiddag'
    });
  });

  it('stoppar en blockerad placering och visar bara felet', () => {
    const showNotice = vi.fn();
    expect(reportPlacementVerdict({ blocked: 'Krock', warning: 'Varning' }, showNotice)).toBe(false);
    expect(showNotice).toHaveBeenCalledOnce();
    expect(showNotice).toHaveBeenCalledWith('Krock', 'error');
  });

  it('släpper igenom en varning och visar den, om anroparen inte tar över beskedet', () => {
    const showNotice = vi.fn();
    expect(reportPlacementVerdict({ blocked: null, warning: 'Varning' }, showNotice)).toBe(true);
    expect(showNotice).toHaveBeenCalledWith('Varning', 'warning');

    const silent = vi.fn();
    expect(reportPlacementVerdict({ blocked: null, warning: 'Varning' }, silent, { announceWarning: false })).toBe(true);
    expect(silent).not.toHaveBeenCalled();
  });
});
