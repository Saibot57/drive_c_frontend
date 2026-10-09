import { describe, expect, it, vi } from 'vitest';
import {
  createScheduleFrom,
  CreateScheduleService,
  decodeScheduleSource,
  encodeScheduleSource,
  resolveScheduleSource,
} from './createSchedule';
import type { PlannerActivity, PlannerArchiveSummary } from '@/types/schedule';

const summary = (id: string, name: string): PlannerArchiveSummary => ({
  id,
  name,
  ownerId: 'u1',
  ownerUsername: null,
  isOwner: true,
  sharedWith: [],
  lock: null,
  updatedAt: null,
});

const activity = (id: string, title: string): PlannerActivity => ({
  id,
  title,
  day: 'Måndag',
  startTime: '08:00',
  endTime: '09:00',
} as PlannerActivity);

const makeService = (overrides: Partial<CreateScheduleService> = {}) => {
  const created = summary('new', 'v.43');
  const service: CreateScheduleService = {
    createArchive: vi.fn(async () => created),
    getArchiveActivities: vi.fn(async () => ({ activities: [activity('a1', 'Svenska'), activity('a2', 'Matte')] })),
    getPlannerActivities: vi.fn(async () => [activity('m1', 'Lunch')]),
    saveArchiveActivities: vi.fn(async (_id: string, list: PlannerActivity[]) => ({
      archive: { ...created, name: 'v.43 sparad' },
      activities: list,
    })),
    releaseArchiveLock: vi.fn(async () => undefined),
    ...overrides,
  };
  return service;
};

describe('createScheduleFrom', () => {
  it('kopierar ett sparat schema med nya id:n', async () => {
    const service = makeService();
    const result = await createScheduleFrom({
      name: 'v.43',
      source: { kind: 'archive', id: 'bas' },
      previousArchiveId: null,
      service,
    });

    expect(service.getArchiveActivities).toHaveBeenCalledWith('bas');
    expect(result.activities.map(a => a.title)).toEqual(['Svenska', 'Matte']);
    expect(result.activities.map(a => a.id)).not.toContain('a1');
    expect(service.saveArchiveActivities).toHaveBeenCalledWith('new', result.activities);
    expect(result.archive.name).toBe('v.43 sparad');
  });

  it('kopierar huvudschemat', async () => {
    const service = makeService();
    const result = await createScheduleFrom({
      name: 'v.43',
      source: { kind: 'main' },
      previousArchiveId: null,
      service,
    });

    expect(service.getPlannerActivities).toHaveBeenCalled();
    expect(service.getArchiveActivities).not.toHaveBeenCalled();
    expect(result.activities.map(a => a.title)).toEqual(['Lunch']);
  });

  it('sparar inga poster för ett tomt schema', async () => {
    const service = makeService();
    const result = await createScheduleFrom({
      name: 'v.43',
      source: { kind: 'empty' },
      previousArchiveId: null,
      service,
    });

    expect(service.saveArchiveActivities).not.toHaveBeenCalled();
    expect(result.activities).toEqual([]);
    expect(result.archive.id).toBe('new');
  });

  it('släpper låset på schemat som var öppet', async () => {
    const service = makeService();
    const result = await createScheduleFrom({
      name: 'v.43',
      source: { kind: 'archive', id: 'bas' },
      previousArchiveId: 'v42',
      service,
    });

    expect(service.releaseArchiveLock).toHaveBeenCalledWith('v42');
    expect(result.releasedArchiveId).toBe('v42');
  });

  it('skapar schemat även om låset inte gick att släppa', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = makeService({
      releaseArchiveLock: vi.fn(async () => { throw new Error('nät'); }),
    });
    const result = await createScheduleFrom({
      name: 'v.43',
      source: { kind: 'empty' },
      previousArchiveId: 'v42',
      service,
    });

    expect(result.archive.id).toBe('new');
    expect(result.releasedArchiveId).toBeNull();
    error.mockRestore();
  });

  it('skapar inget schema om källan inte går att läsa', async () => {
    const service = makeService({
      getArchiveActivities: vi.fn(async () => { throw new Error('404'); }),
    });

    await expect(createScheduleFrom({
      name: 'v.43',
      source: { kind: 'archive', id: 'borta' },
      previousArchiveId: 'v42',
      service,
    })).rejects.toThrow('404');
    expect(service.createArchive).not.toHaveBeenCalled();
    expect(service.releaseArchiveLock).not.toHaveBeenCalled();
  });
});

describe('källan som sparas', () => {
  it('går fram och tillbaka', () => {
    for (const source of [{ kind: 'empty' }, { kind: 'main' }, { kind: 'archive', id: 'x1' }] as const) {
      expect(decodeScheduleSource(encodeScheduleSource(source))).toEqual(source);
    }
  });

  it('faller tillbaka på tomt schema för okända värden', () => {
    expect(decodeScheduleSource(null)).toEqual({ kind: 'empty' });
    expect(decodeScheduleSource('archive:')).toEqual({ kind: 'empty' });
    expect(decodeScheduleSource('skräp')).toEqual({ kind: 'empty' });
  });

  it('släpper ett schema som inte finns kvar', () => {
    const archives = [summary('bas', 'Bas')];
    expect(resolveScheduleSource({ kind: 'archive', id: 'bas' }, archives, 'v42')).toEqual({ kind: 'archive', id: 'bas' });
    expect(resolveScheduleSource({ kind: 'archive', id: 'borta' }, archives, 'v42')).toEqual({ kind: 'empty' });
  });

  it('erbjuder huvudschemat bara när inget schema är öppet', () => {
    expect(resolveScheduleSource({ kind: 'main' }, [], null)).toEqual({ kind: 'main' });
    expect(resolveScheduleSource({ kind: 'main' }, [], 'v42')).toEqual({ kind: 'empty' });
  });
});
