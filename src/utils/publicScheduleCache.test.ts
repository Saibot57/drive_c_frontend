import { describe, expect, it } from 'vitest';
import type { PublicSchedulePayload } from '@/types/schedule';
import {
  clearCachedSchedule,
  publicScheduleCacheKey,
  readCachedSchedule,
  sanitizeCachedSchedule,
  writeCachedSchedule,
} from './publicScheduleCache';

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
};

/** Lagring som är avstängd: varje anrop kastar, som i vissa privata fönster. */
const brokenStorage = () => ({
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); },
});

const payload: PublicSchedulePayload = {
  label: 'Allmän kurs',
  archiveName: 'v. 43',
  updatedAt: '2026-10-19T14:02:00',
  activities: [
    { id: 'a1', title: 'Svenska', day: 'Måndag', startTime: '08:30', endTime: '10:00', duration: 90 },
  ],
  colorTriggers: [],
  roomTriggers: [],
};

describe('publicScheduleCache', () => {
  it('har en versionerad nyckel per token', () => {
    expect(publicScheduleCacheKey('abc')).toBe('publicSchedule.cache.v1.abc');
    expect(publicScheduleCacheKey('abc')).not.toBe(publicScheduleCacheKey('def'));
  });

  it('läser tillbaka det som sparats', () => {
    const storage = memoryStorage();
    writeCachedSchedule('abc', payload, storage);
    expect(readCachedSchedule('abc', storage)).toEqual(payload);
    expect(JSON.parse(storage.data.get('publicSchedule.cache.v1.abc')!).updatedAt).toBe(payload.updatedAt);
  });

  it('blandar inte ihop två länkar', () => {
    const storage = memoryStorage();
    writeCachedSchedule('abc', payload, storage);
    expect(readCachedSchedule('def', storage)).toBeNull();
  });

  it('rensar bara den egna länkens kopia', () => {
    const storage = memoryStorage();
    writeCachedSchedule('abc', payload, storage);
    writeCachedSchedule('def', payload, storage);
    clearCachedSchedule('abc', storage);
    expect(readCachedSchedule('abc', storage)).toBeNull();
    expect(readCachedSchedule('def', storage)).toEqual(payload);
  });

  it('ger null för trasiga eller främmande data', () => {
    for (const raw of ['{inte json', 'null', '[]', '{}', JSON.stringify({ payload: { activities: 'x' } })]) {
      const storage = memoryStorage({ [publicScheduleCacheKey('abc')]: raw });
      expect(readCachedSchedule('abc', storage)).toBeNull();
    }
  });

  it('tvättar fält med fel typ och aktiviteter som inte är objekt', () => {
    const cached = sanitizeCachedSchedule({
      updatedAt: 42,
      payload: { label: 7, archiveName: 'v. 43', updatedAt: '2026-10-19T14:02:00', activities: [null, 'x', payload.activities[0]] },
    });
    expect(cached).toMatchObject({ label: null, archiveName: 'v. 43', updatedAt: '2026-10-19T14:02:00' });
    expect(cached?.activities).toEqual([payload.activities[0]]);
  });

  it('sväljer fel från lagringen', () => {
    const storage = brokenStorage();
    expect(() => writeCachedSchedule('abc', payload, storage)).not.toThrow();
    expect(() => clearCachedSchedule('abc', storage)).not.toThrow();
    expect(readCachedSchedule('abc', storage)).toBeNull();
  });

  it('klarar sig utan window, som på servern', () => {
    expect(readCachedSchedule('abc')).toBeNull();
    expect(() => writeCachedSchedule('abc', payload)).not.toThrow();
    expect(() => clearCachedSchedule('abc')).not.toThrow();
  });
});
