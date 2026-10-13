import { describe, expect, it } from 'vitest';
import type { PlannerActivity } from '@/types/schedule';
import { buildScheduleDays } from './scheduleDayImport';

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
