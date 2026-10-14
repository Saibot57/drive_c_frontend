import { describe, expect, it } from 'vitest';
import type { PlannerActivity } from '@/types/schedule';
import { buildScheduleDays, orderScheduleSources, scheduleSourceLabel } from './scheduleDayImport';

const activity = (id: string, day: string, startTime: string, endTime: string): PlannerActivity => ({
  id, title: id, day, startTime, endTime, duration: 0,
});

const activities = [
  activity('a', 'Måndag', '08:00', '09:00'),
  activity('b', 'Tisdag', '10:00', '11:30'),
];

describe('buildScheduleDays', () => {
  it('skriver schemats id och namn i varje dag', () => {
    const drafts = buildScheduleDays(activities, ['Måndag', 'Tisdag'], {
      archiveId: 'arc-1',
      archiveName: 'v.35',
      sourceLabel: 'v.35 · anna',
    });

    expect(drafts).toHaveLength(2);
    drafts.forEach(({ content }) => {
      expect(content.archiveId).toBe('arc-1');
      expect(content.archiveName).toBe('v.35');
      expect(content.sourceLabel).toBe('v.35 · anna');
    });
  });
});

describe('scheduleSourceLabel', () => {
  it('ger ett eget schema dess namn', () => {
    expect(scheduleSourceLabel({ name: 'v.35', isOwner: true, ownerUsername: 'tobias' })).toBe('v.35');
  });

  it('ger ett delat schema ägarens namn efter', () => {
    expect(scheduleSourceLabel({ name: 'v.35', isOwner: false, ownerUsername: 'anna' })).toBe('v.35 · anna');
  });

  it('klarar ett delat schema utan känd ägare', () => {
    expect(scheduleSourceLabel({ name: 'v.35', isOwner: false, ownerUsername: null })).toBe('v.35');
  });
});

describe('orderScheduleSources', () => {
  const archive = (name: string, isOwner: boolean, updatedAt: string | null) => ({ name, isOwner, updatedAt });

  it('delar i egna och delade, senast ändrat först', () => {
    const { own, shared } = orderScheduleSources([
      archive('v.34', true, '2026-08-20T10:00:00'),
      archive('Annas v.35', false, '2026-08-27T10:00:00'),
      archive('v.35', true, '2026-08-27T10:00:00'),
      archive('Gammalt', true, null),
      archive('Annas v.34', false, '2026-08-20T10:00:00'),
    ]);

    expect(own.map((a) => a.name)).toEqual(['v.35', 'v.34', 'Gammalt']);
    expect(shared.map((a) => a.name)).toEqual(['Annas v.35', 'Annas v.34']);
  });
});
