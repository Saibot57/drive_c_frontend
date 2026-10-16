import { describe, expect, it } from 'vitest';
import {
  applyBulkEdit,
  BulkEditContext,
  bulkPatchChangesAny,
  normalizeBulkPatch,
  retimeEntry,
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

  it('rör inte färg, tid, dag eller anteckningar när bara titel, lärare och sal byts', () => {
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

describe('normalizeBulkPatch – tid och färg', () => {
  it('släpper en tidsändring som inte ändrar något', () => {
    expect(normalizeBulkPatch({ time: { kind: 'set' } })).toEqual({});
    expect(normalizeBulkPatch({ time: { kind: 'shift', minutes: 0 } })).toEqual({});
    expect(normalizeBulkPatch({ time: { kind: 'shift', minutes: Number.NaN } })).toEqual({});
  });

  it('släpper en tom färg, eftersom färgen inte går att tömma', () => {
    expect(normalizeBulkPatch({ color: ' ' })).toEqual({});
  });

  it('behåller tomma anteckningar, eftersom tomt betyder "töm"', () => {
    expect(normalizeBulkPatch({ notes: '  ', category: '' })).toEqual({ notes: '', category: '' });
  });
});

describe('retimeEntry', () => {
  const at = { startTime: '09:00', endTime: '10:30' };

  it('behåller längden när bara starten sätts', () => {
    expect(retimeEntry(at, { kind: 'set', start: '13:00' })).toEqual({ start: 13 * 60, end: 14 * 60 + 30 });
  });

  it('behåller starten när bara sluttiden sätts', () => {
    expect(retimeEntry(at, { kind: 'set', end: '11:00' })).toEqual({ start: 9 * 60, end: 11 * 60 });
  });

  it('flyttar båda tiderna lika mycket', () => {
    expect(retimeEntry(at, { kind: 'shift', minutes: -15 })).toEqual({ start: 8 * 60 + 45, end: 10 * 60 + 15 });
  });
});

describe('applyBulkEdit – anteckningar, uppgift och färg', () => {
  it('ersätter anteckningar och uppgift, även där de saknades', () => {
    const schedule = [entry({ instanceId: 'a', notes: 'Gammal' }), entry({ instanceId: 'b' })];
    const result = applyBulkEdit(schedule, ['a', 'b'], { notes: 'Ta med dator', category: 'Läxa 3' }, noRules);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.schedule.map(e => [e.notes, e.category])).toEqual([
      ['Ta med dator', 'Läxa 3'],
      ['Ta med dator', 'Läxa 3']
    ]);
  });

  it('tömmer anteckningarna när värdet är en tom sträng', () => {
    const schedule = [entry({ instanceId: 'a', notes: 'Gammal' }), entry({ instanceId: 'b' })];
    const result = applyBulkEdit(schedule, ['a', 'b'], { notes: '' }, noRules);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.schedule.map(e => e.notes)).toEqual(['', undefined]);
    expect(result.changedCount).toBe(1);
  });

  it('byter färg', () => {
    const schedule = [entry({ instanceId: 'a' }), entry({ instanceId: 'b', color: '#123456' })];
    const result = applyBulkEdit(schedule, ['a', 'b'], { color: '#123456' }, noRules);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.schedule.map(e => e.color)).toEqual(['#123456', '#123456']);
    expect(result.changedCount).toBe(1);
  });

  it('prövar inte ämnesreglerna när bara anteckningarna byts', () => {
    const schedule = [
      entry({ instanceId: 'a', title: 'Matte 1' }),
      entry({ instanceId: 'x', title: 'Svenska', startTime: '08:30', endTime: '09:30' })
    ];
    const context = { ...noRules, restrictions: [rule('Matte*', 'Svenska*')] };
    const result = applyBulkEdit(schedule, ['a'], { notes: 'Prov' }, context);

    expect(result.ok).toBe(true);
  });
});

describe('applyBulkEdit – tid', () => {
  it('sätter samma tider i poster på olika dagar och räknar om längden', () => {
    const schedule = [
      entry({ instanceId: 'a', day: 'Måndag', startTime: '09:00', endTime: '10:00' }),
      entry({ instanceId: 'b', day: 'Onsdag', startTime: '13:00', endTime: '13:45', duration: 45 })
    ];
    const result = applyBulkEdit(schedule, ['a', 'b'], { time: { kind: 'set', start: '08:15', end: '09:45' } }, noRules);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.schedule.map(e => [e.day, e.startTime, e.endTime, e.duration])).toEqual([
      ['Måndag', '08:15', '09:45', 90],
      ['Onsdag', '08:15', '09:45', 90]
    ]);
  });

  it('flyttar varje post lika mycket', () => {
    const schedule = [
      entry({ instanceId: 'a', startTime: '09:00', endTime: '10:00' }),
      entry({ instanceId: 'b', startTime: '13:00', endTime: '13:45', duration: 45 })
    ];
    const result = applyBulkEdit(schedule, ['a', 'b'], { time: { kind: 'shift', minutes: 15 } }, noRules);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.schedule.map(e => [e.startTime, e.endTime, e.duration])).toEqual([
      ['09:15', '10:15', 60],
      ['13:15', '14:00', 45]
    ]);
  });

  it('nollställer platsen bland samtidiga poster när starten flyttas, men inte annars', () => {
    const schedule = [
      entry({ instanceId: 'a', startTime: '09:00', endTime: '10:00', laneOrder: 1 }),
      entry({ instanceId: 'b', startTime: '09:00', endTime: '10:00', laneOrder: 0 })
    ];
    const moved = applyBulkEdit(schedule, ['a'], { time: { kind: 'shift', minutes: 30 } }, noRules);
    const longer = applyBulkEdit(schedule, ['a'], { time: { kind: 'set', end: '10:30' } }, noRules);

    if (!moved.ok || !longer.ok) throw new Error('väntade ok');
    expect(moved.schedule[0].laneOrder).toBeUndefined();
    expect(longer.schedule[0].laneOrder).toBe(1);
  });

  it('stoppar allt när en post skulle hamna utanför schemat', () => {
    const schedule = [
      entry({ instanceId: 'a', startTime: '09:00', endTime: '10:00' }),
      entry({ instanceId: 'b', startTime: '16:00', endTime: '17:00' })
    ];
    const result = applyBulkEdit(schedule, ['a', 'b'], { time: { kind: 'shift', minutes: 30 } }, noRules);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.entry.instanceId).toBe('b');
    expect(result.entry.startTime).toBe('16:00');
    expect(result.message).toContain('16:30–17:30');
  });

  it('stoppar en sluttid som hamnar före starttiden', () => {
    const schedule = [entry({ instanceId: 'a', startTime: '10:00', endTime: '11:00' })];
    const result = applyBulkEdit(schedule, ['a'], { time: { kind: 'set', end: '09:30' } }, noRules);

    expect(result.ok).toBe(false);
  });

  it('prövar ämnesreglerna när tiden ändras, fast titeln är densamma', () => {
    const schedule = [
      entry({ instanceId: 'a', title: 'Matte 1', startTime: '08:00', endTime: '09:00' }),
      entry({ instanceId: 'x', title: 'Svenska', startTime: '10:00', endTime: '11:00' })
    ];
    const context = { ...noRules, restrictions: [rule('Matte*', 'Svenska*')] };
    const result = applyBulkEdit(schedule, ['a'], { time: { kind: 'set', start: '10:30' } }, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.entry.startTime).toBe('10:30');
  });

  it('varnar för tillgänglighet när tiden ändras, fast läraren är densamma', () => {
    const schedule = [entry({ instanceId: 'a', teacher: 'Hanna', startTime: '08:00', endTime: '09:00' })];
    const context = { ...noRules, availability: { Hanna: { Måndag: ['em' as const] } } };
    const result = applyBulkEdit(schedule, ['a'], { time: { kind: 'set', start: '14:00' } }, context);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.warnings).toHaveLength(1);
  });

  it('räknar inte en post vars tid redan stämmer som ändrad', () => {
    const schedule = [entry({ instanceId: 'a', startTime: '08:00', endTime: '09:00' })];
    const result = applyBulkEdit(schedule, ['a'], { time: { kind: 'set', start: '08:00' } }, noRules);

    if (!result.ok) throw new Error('väntade ok');
    expect(result.schedule).toBe(schedule);
  });
});

describe('bulkPatchChangesAny', () => {
  it('är falsk när ingenting skulle ändras', () => {
    const entries = [entry({ instanceId: 'a' })];
    expect(bulkPatchChangesAny(entries, { room: 'A12', time: { kind: 'set', start: '08:00' } })).toBe(false);
  });

  it('är sann när en tid skulle bli ogiltig, så att Spara kan visa varför', () => {
    const entries = [entry({ instanceId: 'a', startTime: '16:00', endTime: '17:00' })];
    expect(bulkPatchChangesAny(entries, { time: { kind: 'shift', minutes: 15 } })).toBe(true);
  });
});
