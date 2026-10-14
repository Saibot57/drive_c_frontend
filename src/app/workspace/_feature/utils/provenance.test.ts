import { describe, expect, it } from 'vitest';
import type { PlannerActivity } from '@/types/schedule';
import type { ThemeWheel } from '@/types/themeWheel';
import type { ScheduleDayContent } from '../types/scheduleDay.types';
import { buildWheelParts } from './wheelExplode';
import { buildScheduleDays } from './scheduleDayImport';
import {
  currentWheelPart,
  currentWheelParts,
  scheduleDayProvenance,
  scheduleSourceKey,
  wheelPartSignature,
} from './provenance';

const wheel = (blocks: ThemeWheel['blocks']): ThemeWheel => ({
  id: 'w1',
  name: 'Läsåret',
  startWeek: 34,
  startYear: 2026,
  weekCount: 40,
  holidayWeeks: [],
  blocks,
});

const blocks: ThemeWheel['blocks'] = [
  { instanceId: 'a', title: 'Antiken', color: '#fde68a', startWeek: 0, endWeek: 6 },
  { instanceId: 'b', title: 'Medeltiden', color: '#bfdbfe', startWeek: 7, endWeek: 14 },
  { instanceId: 'c', title: 'Ringen ovanför', color: '#bbf7d0', startWeek: 3, endWeek: 9 },
];

describe('currentWheelPart', () => {
  it('ger samma del ur en gemensam uppslagning som en egen byggning', () => {
    const frozen = buildWheelParts(wheel(blocks), 'explode', '2026-01-01T00:00:00.000Z')
      .map((d) => d.content);
    const parts = currentWheelParts(wheel(blocks), 'explode');

    expect(frozen).toHaveLength(blocks.length);
    frozen.forEach((part) => {
      const fresh = currentWheelPart(parts, part);
      expect(fresh).toEqual(part);
    });
  });

  it('behåller kortets capturedAt', () => {
    const [part] = buildWheelParts(wheel(blocks), 'unroll', '2025-08-01T00:00:00.000Z');
    const fresh = currentWheelPart(currentWheelParts(wheel(blocks), 'unroll'), part.content);

    expect(fresh?.capturedAt).toBe('2025-08-01T00:00:00.000Z');
  });

  it('ger null när blocket är borta', () => {
    const [part] = buildWheelParts(wheel(blocks), 'explode');
    const parts = currentWheelParts(wheel(blocks.slice(1)), 'explode');

    expect(currentWheelPart(parts, part.content)).toBeNull();
  });

  it('ser en ändring i hjulet', () => {
    const [part] = buildWheelParts(wheel(blocks), 'explode');
    const renamed = blocks.map((b) => (b.instanceId === 'a' ? { ...b, title: 'Grekland' } : b));
    const fresh = currentWheelPart(currentWheelParts(wheel(renamed), 'explode'), part.content);

    expect(fresh && wheelPartSignature(fresh)).not.toBe(wheelPartSignature(part.content));
  });
});

const lesson = (id: string, title: string): PlannerActivity => ({
  id, title, day: 'Måndag', startTime: '08:00', endTime: '09:00', duration: 60,
});

const monday = (source: Pick<ScheduleDayContent, 'archiveId' | 'archiveName'>): ScheduleDayContent =>
  buildScheduleDays([lesson('a', 'Svenska')], ['Måndag'], {
    archiveId: source.archiveId ?? null,
    archiveName: source.archiveName,
    sourceLabel: 'v.35',
  })[0].content;

describe('scheduleSourceKey', () => {
  it('håller isär id-kort och namnkort även när strängarna är lika', () => {
    expect(scheduleSourceKey({ archiveId: 'v.35', archiveName: 'v.35' }))
      .not.toBe(scheduleSourceKey({ archiveId: null, archiveName: 'v.35' }));
  });

  it('ger samma nyckel för två kort från samma schema', () => {
    expect(scheduleSourceKey({ archiveId: 'arc-1', archiveName: 'v.35' }))
      .toBe(scheduleSourceKey({ archiveId: 'arc-1', archiveName: 'v.35 (gammalt namn)' }));
  });

  it('skiljer gamla kort åt på namnet, och huvudschemat från ett schema utan namn', () => {
    expect(scheduleSourceKey({ archiveName: 'v.35' })).not.toBe(scheduleSourceKey({ archiveName: 'v.36' }));
    expect(scheduleSourceKey({ archiveName: null })).toBe(scheduleSourceKey({ archiveId: null, archiveName: null }));
  });
});

describe('scheduleDayProvenance', () => {
  const frozen = monday({ archiveId: 'arc-1', archiveName: 'v.35' });

  it('är färsk när källan säger samma sak', () => {
    const entry = scheduleDayProvenance(frozen, { found: true, activities: [lesson('a', 'Svenska')] });
    expect(entry.status).toBe('fresh');
    expect(entry.sourceKey).toBe('schedule:id:arc-1');
  });

  it('har drivit när källan ändrats, och uppdateringen behåller id:t', () => {
    const entry = scheduleDayProvenance(frozen, { found: true, activities: [lesson('a', 'Engelska')] });
    expect(entry.status).toBe('drifted');
    const fresh = entry.fresh as ScheduleDayContent;
    expect(fresh.archiveId).toBe('arc-1');
    expect(fresh.entries[0].title).toBe('Engelska');
  });

  it('använder schemats nuvarande namn när källan ger det', () => {
    const entry = scheduleDayProvenance(frozen, {
      found: true, activities: [lesson('a', 'Svenska')], label: 'v.35 (justerad)',
    });
    expect(entry.sourceLabel).toBe('v.35 (justerad)');
  });

  it('behåller kortets etikett när källan inte svarar', () => {
    expect(scheduleDayProvenance(frozen, { found: false, reason: 'missing' }))
      .toMatchObject({ status: 'missing', sourceLabel: 'v.35' });
    expect(scheduleDayProvenance(frozen, { found: false, reason: 'unknown' }))
      .toMatchObject({ status: 'unknown', sourceLabel: 'v.35' });
  });
});
