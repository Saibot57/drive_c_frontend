import { describe, expect, it } from 'vitest';
import {
  isBaseSchedule,
  optionsWithCurrent,
  partitionSchedules,
  scheduleKindLabel,
  scheduleKindOf,
} from './scheduleKind';
import type { ScheduleKind } from '@/types/schedule';

const archive = (id: string, kind?: ScheduleKind) => ({ id, kind });

describe('sorten', () => {
  it('läser basschema och veckoschema', () => {
    expect(isBaseSchedule(archive('a', 'base'))).toBe(true);
    expect(isBaseSchedule(archive('a', 'week'))).toBe(false);
    expect(scheduleKindOf(archive('a', 'base'))).toBe('base');
  });

  it('räknar ett schema utan sort som veckoschema', () => {
    expect(isBaseSchedule(archive('a'))).toBe(false);
    expect(scheduleKindOf(archive('a'))).toBe('week');
  });

  it('har ord för båda sorterna', () => {
    expect(scheduleKindLabel('base')).toBe('basschema');
    expect(scheduleKindLabel('week')).toBe('veckoschema');
  });
});

describe('partitionSchedules', () => {
  it('delar listan och behåller ordningen', () => {
    const list = [archive('v1'), archive('b1', 'base'), archive('v2', 'week'), archive('b2', 'base')];
    const { bases, weeks } = partitionSchedules(list);
    expect(bases.map(a => a.id)).toEqual(['b1', 'b2']);
    expect(weeks.map(a => a.id)).toEqual(['v1', 'v2']);
  });
});

describe('optionsWithCurrent', () => {
  const list = [archive('v1', 'week'), archive('b1', 'base'), archive('b2', 'base')];

  it('visar bara de som klarar filtret', () => {
    const result = optionsWithCurrent(list, isBaseSchedule, 'b1');
    expect(result.options.map(a => a.id)).toEqual(['b1', 'b2']);
    expect(result.outside).toBeNull();
  });

  it('behåller ett valt schema av den andra sorten', () => {
    const result = optionsWithCurrent(list, isBaseSchedule, 'v1');
    expect(result.options.map(a => a.id)).toEqual(['b1', 'b2']);
    expect(result.outside?.id).toBe('v1');
  });

  it('hittar inget utanför när inget är valt eller det valda saknas', () => {
    expect(optionsWithCurrent(list, isBaseSchedule, null).outside).toBeNull();
    expect(optionsWithCurrent(list, isBaseSchedule, 'borta').outside).toBeNull();
  });
});
