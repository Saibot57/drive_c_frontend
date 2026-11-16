// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const listArchives = vi.fn();
const getArchiveActivities = vi.fn();
vi.mock('@/services/plannerService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/plannerService')>();
  return {
    ...original,
    plannerService: {
      listArchives: (...args: unknown[]) => listArchives(...args),
      getArchiveActivities: (...args: unknown[]) => getArchiveActivities(...args),
    },
  };
});

import { SCHEDULE_NAME_KEY, SCHEDULE_REFRESH_MS, useNarvaroSchedule, useNarvaroScheduleName } from '@/hooks/useNarvaroSchedule';
import { ROOM_TRIGGERS_KEY } from '@/config/plannerConstants';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** En minimal renderHook. Repot har inget testbibliotek för React. */
function renderHook<P, R>(hook: (props: P) => R, initial: P) {
  const result: { current: R } = { current: undefined as never };
  let props = initial;
  const Probe = () => {
    result.current = hook(props);
    return null;
  };
  const root = createRoot(document.createElement('div'));
  act(() => { root.render(React.createElement(Probe)); });
  return {
    result,
    rerender(next: P) {
      props = next;
      act(() => { root.render(React.createElement(Probe)); });
    },
    unmount() { act(() => root.unmount()); },
  };
}

const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

const archive = (id: string, name: string) => ({
  id, name, ownerId: 'u1', ownerUsername: null, isOwner: true, sharedWith: [], lock: null, updatedAt: '2026-11-01', kind: 'week',
});
const activity = (id: string, title: string, notes = '') => ({
  id, title, teacher: 'Kim', room: '', notes, day: 'Måndag', startTime: '08:30', endTime: '10:00', duration: 90, color: '#ffffff',
});

type Props = { enabled: boolean; week: string };
const useSchedule = ({ enabled, week }: Props) => useNarvaroSchedule(enabled, week);

describe('useNarvaroSchedule', () => {
  beforeEach(() => {
    listArchives.mockReset();
    getArchiveActivities.mockReset();
    listArchives.mockResolvedValue([archive('a46', 'v. 46'), archive('a47', 'v. 47')]);
    getArchiveActivities.mockImplementation(async (id: string) => ({
      archive: archive(id, id === 'a47' ? 'v. 47' : 'v. 46'),
      activities: [activity(`${id}-1`, `Tema ${id}`, 'Historia')],
    }));
  });
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('hämtar den aktuella veckan en gång', async () => {
    const { result, rerender, unmount } = renderHook(useSchedule, { enabled: true, week: 'w2026-47' });
    await settle();
    rerender({ enabled: true, week: 'w2026-47' });
    await settle();
    expect(listArchives).toHaveBeenCalledTimes(1);
    expect(getArchiveActivities).toHaveBeenCalledTimes(1);
    expect(getArchiveActivities).toHaveBeenCalledWith('a47');
    const w = result.current.weeks['w2026-47'];
    expect(w?.archiveId).toBe('a47');
    expect(w?.name).toBe('v. 47');
    expect(w?.entries.map(e => [e.title, e.notes, e.instanceId])).toEqual([['Tema a47', 'Historia', 'a47-1']]);
    unmount();
  });

  it('hämtar inget när den är avstängd', async () => {
    const { result, unmount } = renderHook(useSchedule, { enabled: false, week: 'w2026-47' });
    await settle();
    act(() => result.current.ensureWeek('w2026-46'));
    await settle();
    expect(listArchives).not.toHaveBeenCalled();
    expect(result.current.weeks).toEqual({});
    unmount();
  });

  it('ett fel ger null', async () => {
    getArchiveActivities.mockRejectedValue(new Error('HTTP 500'));
    const { result, unmount } = renderHook(useSchedule, { enabled: true, week: 'w2026-47' });
    await settle();
    expect(result.current.weeks['w2026-47']).toBeNull();
    unmount();
  });

  it('en lista som inte går att hämta ger null', async () => {
    listArchives.mockRejectedValue(new Error('nätet'));
    const { result, unmount } = renderHook(useSchedule, { enabled: true, week: 'w2026-47' });
    await settle();
    expect(result.current.weeks['w2026-47']).toBeNull();
    expect(getArchiveActivities).not.toHaveBeenCalled();
    unmount();
  });

  it('en vecka utan schema ger null utan att fråga efter passen', async () => {
    const { result, unmount } = renderHook(useSchedule, { enabled: true, week: 'w2026-48' });
    await settle();
    expect(result.current.weeks['w2026-48']).toBeNull();
    expect(getArchiveActivities).not.toHaveBeenCalled();
    unmount();
  });

  it('ensureWeek hämtar en annan vecka, en gång', async () => {
    const { result, unmount } = renderHook(useSchedule, { enabled: true, week: 'w2026-47' });
    await settle();
    expect(result.current.weeks['w2026-46']).toBeUndefined();
    act(() => result.current.ensureWeek('w2026-46'));
    act(() => result.current.ensureWeek('w2026-46'));
    await settle();
    expect(result.current.weeks['w2026-46']?.archiveId).toBe('a46');
    expect(getArchiveActivities).toHaveBeenCalledTimes(2);
    expect(listArchives).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('hämtar om när fönstret får fokus, högst en gång i minuten', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0));
    const { result, unmount } = renderHook(useSchedule, { enabled: true, week: 'w2026-47' });
    await settle();
    act(() => { window.dispatchEvent(new Event('focus')); });
    await settle();
    expect(getArchiveActivities).toHaveBeenCalledTimes(1);

    getArchiveActivities.mockResolvedValue({ archive: archive('a47', 'v. 47'), activities: [activity('x', 'Ändrat')] });
    vi.setSystemTime(new Date(Date.now() + SCHEDULE_REFRESH_MS + 1));
    act(() => { window.dispatchEvent(new Event('focus')); });
    await settle();
    expect(listArchives).toHaveBeenCalledTimes(2);
    expect(getArchiveActivities).toHaveBeenCalledTimes(2);
    expect(result.current.weeks['w2026-47']?.entries.map(e => e.title)).toEqual(['Ändrat']);
    unmount();
  });

  it('läser salsreglerna från planerarens nyckel', async () => {
    window.localStorage.setItem(ROOM_TRIGGERS_KEY, JSON.stringify([{ id: 'r', word: 'tema', room: 'Aulan' }]));
    const { result, unmount } = renderHook(useSchedule, { enabled: false, week: 'w2026-47' });
    expect(result.current.resolveRoom('Tema Rosa', '')).toBe('Aulan');
    expect(result.current.resolveRoom('Tema Rosa', 'Rådhuset')).toBe('Rådhuset');
    expect(result.current.resolveColor('Tema Rosa', '#123456')).toBe('#123456');
    unmount();
  });
});

describe('useNarvaroScheduleName', () => {
  type NameProps = { username: string; teachers: string[] };
  const useName = ({ username, teachers }: NameProps) => useNarvaroScheduleName(username, teachers);
  afterEach(() => window.localStorage.clear());

  it('användarnamnet bland lärarna gäller utan att fråga', () => {
    const { result, unmount } = renderHook(useName, { username: 'kim', teachers: ['Kim', 'Robin'] });
    expect(result.current.name).toBe('Kim');
    unmount();
  });

  it('frågar när användarnamnet inte är en lärare, och minns valet', () => {
    const { result, unmount } = renderHook(useName, { username: 'Admin', teachers: ['Kim', 'Robin'] });
    expect(result.current.name).toBe('');
    act(() => result.current.setName('Robin '));
    expect(result.current.name).toBe('Robin');
    expect(JSON.parse(window.localStorage.getItem(SCHEDULE_NAME_KEY) ?? 'null')).toBe('Robin');
    unmount();

    const again = renderHook(useName, { username: 'Admin', teachers: ['Kim'] });
    expect(again.result.current.name).toBe('Robin');
    again.unmount();
  });
});
