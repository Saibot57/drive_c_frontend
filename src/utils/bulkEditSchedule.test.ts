import { describe, expect, it } from 'vitest';
import {
  applyBulkEdit,
  BulkEditContext,
  normalizeBulkPatch,
  sharedFieldValue
} from '@/utils/bulkEditSchedule';
import { RestrictionRule, ScheduledEntry } from '@/types/schedule';

const entry = (overrides: Partial<ScheduledEntry> & { instanceId: string }): ScheduledEntry => ({
  id: overrides.instanceId,
  title: 'Matte 1',
  teacher: 'Tobias',
  room: 'A12',
  color: '#fff',
  duration: 60,
  day: 'Måndag',
  startTime: '08:00',
  endTime: '09:00',
  ...overrides
});

const noRules: BulkEditContext = { restrictions: [], availability: {}, allTeachers: [] };

const rule = (subjectA: string, subjectB: string): RestrictionRule => ({
  id: `${subjectA}-${subjectB}`,
  subjectA,
  subjectB
});

describe('sharedFieldValue', () => {
  it('ger värdet när alla poster delar det', () => {
    const entries = [entry({ instanceId: 'a' }), entry({ instanceId: 'b' })];
    expect(sharedFieldValue(entries, 'room')).toBe('A12');
  });

  it('ger null när posterna skiljer sig åt', () => {
    const entries = [entry({ instanceId: 'a' }), entry({ instanceId: 'b', room: 'B3' })];
    expect(sharedFieldValue(entries, 'room')).toBeNull();
  });

  it('räknar tom sal och tom sträng som samma sak', () => {
    const entries = [entry({ instanceId: 'a', room: '' }), entry({ instanceId: 'b', room: '' })];
    expect(sharedFieldValue(entries, 'room')).toBe('');
  });
});

describe('normalizeBulkPatch', () => {
  it('tar bort blanktecken runt värdena', () => {
    expect(normalizeBulkPatch({ room: '  B3 ' })).toEqual({ room: 'B3' });
  });

  it('behåller en tom sal, eftersom tom betyder "töm"', () => {
    expect(normalizeBulkPatch({ room: '' })).toEqual({ room: '' });
    expect(normalizeBulkPatch({ teacher: '   ' })).toEqual({ teacher: '' });
  });

  it('släpper en tom titel, eftersom titeln inte går att tömma', () => {
    expect(normalizeBulkPatch({ title: '  ' })).toEqual({});
  });
});

describe('applyBulkEdit', () => {
  it('skriver bara i de markerade posterna', () => {
    const schedule = [entry({ instanceId: 'a' }), entry({ instanceId: 'b' }), entry({ instanceId: 'c' })];
    const result = applyBulkEdit(schedule, ['a', 'c'], { room: 'B3' }, noRules);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.schedule.map(e => e.room)).toEqual(['B3', 'A12', 'B3']);
    expect(result.changedCount).toBe(2);
  });

  it('lämnar fält som inte finns i ändringen orörda', () => {
    const schedule = [
      entry({ instanceId: 'a', teacher: 'Hanna', title: 'Svenska' }),
      entry({ instanceId: 'b', teacher: 'Tobias', title: 'Matte' })
    ];
    const result = applyBulkEdit(schedule, ['a', 'b'], { room: 'B3' }, noRules);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.schedule.map(e => [e.title, e.teacher])).toEqual([['Svenska', 'Hanna'], ['Matte', 'Tobias']]);
  });

  it('tömmer salen när värdet är en tom sträng', () => {
    const schedule = [entry({ instanceId: 'a' }), entry({ instanceId: 'b', room: 'B3' })];
    const result = applyBulkEdit(schedule, ['a', 'b'], { room: '' }, noRules);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.schedule.map(e => e.room)).toEqual(['', '']);
  });

  it('rör inte färg, tid, dag eller anteckningar', () => {
    const original = entry({ instanceId: 'a', color: '#abc', notes: 'Ta med dator', day: 'Tisdag' });
    const result = applyBulkEdit([original], ['a'], { title: 'Matte 2', teacher: 'Hanna', room: 'B3' }, noRules);

    if (!result.ok) throw new Error('väntade ok');
    const { title, teacher, room, ...rest } = result.schedule[0];
    const { title: _t, teacher: _te, room: _r, ...originalRest } = original;
    expect({ title, teacher, room }).toEqual({ title: 'Matte 2', teacher: 'Hanna', room: 'B3' });
    expect(rest).toEqual(originalRest);
  });

  it('ger tillbaka samma schema när ingenting ändras, så ångra inte får ett tomt steg', () => {
    const schedule = [entry({ instanceId: 'a' })];
    const result = applyBulkEdit(schedule, ['a'], { room: 'A12' }, noRules);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.schedule).toBe(schedule);
    expect(result.changedCount).toBe(0);
  });

  it('räknar bara poster som faktiskt ändrades', () => {
    const schedule = [entry({ instanceId: 'a', room: 'B3' }), entry({ instanceId: 'b' })];
    const result = applyBulkEdit(schedule, ['a', 'b'], { room: 'B3' }, noRules);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.changedCount).toBe(1);
  });

  it('hoppar över id:n som inte finns i schemat', () => {
    const schedule = [entry({ instanceId: 'a' })];
    const result = applyBulkEdit(schedule, ['a', 'borta'], { room: 'B3' }, noRules);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.schedule).toHaveLength(1);
    expect(result.changedCount).toBe(1);
  });

  it('stoppar hela ändringen när ett titelbyte bryter mot en ämnesregel', () => {
    const schedule = [
      entry({ instanceId: 'a', title: 'Engelska', startTime: '08:00', endTime: '09:00' }),
      entry({ instanceId: 'b', title: 'Engelska', day: 'Tisdag' }),
      entry({ instanceId: 'x', title: 'Svenska', startTime: '08:30', endTime: '09:30' })
    ];
    const context = { ...noRules, restrictions: [rule('Matte*', 'Svenska*')] };
    const result = applyBulkEdit(schedule, ['a', 'b'], { title: 'Matte 2' }, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.entry.instanceId).toBe('a');
    expect(result.message).toContain('Svenska');
  });

  it('upptäcker krockar mellan två poster som båda byter titel', () => {
    const schedule = [
      entry({ instanceId: 'a', title: 'Engelska', startTime: '08:00', endTime: '09:00' }),
      entry({ instanceId: 'b', title: 'Engelska', startTime: '08:30', endTime: '09:30' })
    ];
    const context = { ...noRules, restrictions: [rule('Matte*', 'Matte*')] };
    const result = applyBulkEdit(schedule, ['a', 'b'], { title: 'Matte 2' }, context);

    expect(result.ok).toBe(false);
  });

  it('låter en krock som redan fanns vara när titeln inte byts', () => {
    const schedule = [
      entry({ instanceId: 'a', title: 'Matte 1', startTime: '08:00', endTime: '09:00' }),
      entry({ instanceId: 'x', title: 'Svenska', startTime: '08:30', endTime: '09:30' })
    ];
    const context = { ...noRules, restrictions: [rule('Matte*', 'Svenska*')] };
    const result = applyBulkEdit(schedule, ['a'], { room: 'B3' }, context);

    expect(result.ok).toBe(true);
  });

  it('varnar för otillgängliga lärare men skriver ändå', () => {
    const schedule = [entry({ instanceId: 'a', day: 'Måndag' }), entry({ instanceId: 'b', day: 'Tisdag' })];
    const context = { ...noRules, availability: { Hanna: { Måndag: ['all' as const] } } };
    const result = applyBulkEdit(schedule, ['a', 'b'], { teacher: 'Hanna' }, context);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.schedule.map(e => e.teacher)).toEqual(['Hanna', 'Hanna']);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].entry.instanceId).toBe('a');
  });

  it('varnar inte för tillgänglighet när läraren inte byts', () => {
    const schedule = [entry({ instanceId: 'a', teacher: 'Hanna', day: 'Måndag' })];
    const context = { ...noRules, availability: { Hanna: { Måndag: ['all' as const] } } };
    const result = applyBulkEdit(schedule, ['a'], { room: 'B3' }, context);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.warnings).toHaveLength(0);
  });
});
