// @vitest-environment jsdom
import React, { act, MutableRefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannerArchiveSummary } from '@/types/schedule';

const service = vi.hoisted(() => ({
  listArchives: vi.fn(),
  acquireArchiveLock: vi.fn(),
  releaseArchiveLock: vi.fn(),
  releaseArchiveLockOnUnload: vi.fn(),
  getArchiveActivities: vi.fn(),
}));
vi.mock('@/services/plannerService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/plannerService')>();
  return { ...original, plannerService: service };
});

import { useArchiveManager } from '@/hooks/useArchiveManager';
import { ACTIVE_ARCHIVE_ID_KEY } from '@/config/plannerConstants';
import { trackLeaveSave } from '@/utils/leaveSave';
import type { ArchiveBase } from '@/hooks/usePlannerSync';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Props = Parameters<typeof useArchiveManager>[0];

/** En minimal renderHook. Repot har inget testbibliotek för React. */
const renderHook = (props: Props) => {
  const result: { current: ReturnType<typeof useArchiveManager> } = { current: undefined as never };
  const Probe = () => {
    result.current = useArchiveManager(props);
    return null;
  };
  const root = createRoot(document.createElement('div'));
  act(() => { root.render(React.createElement(Probe)); });
  return { result, unmount() { act(() => root.unmount()); } };
};

const summary = (id: string): PlannerArchiveSummary => ({
  id,
  name: id,
  ownerId: 'u1',
  ownerUsername: 'tobias',
  isOwner: true,
  sharedWith: [],
  lock: null,
  updatedAt: null,
  version: 1,
  kind: 'week',
});

const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

describe('useArchiveManager', () => {
  let saveNow: ReturnType<typeof vi.fn>;
  let failedTransiently: ReturnType<typeof vi.fn>;
  let showNotice: ReturnType<typeof vi.fn>;
  let props: Props;

  beforeEach(() => {
    Object.values(service).forEach(fn => fn.mockReset());
    window.localStorage.clear();
    window.localStorage.setItem(ACTIVE_ARCHIVE_ID_KEY, 'v35');
    service.listArchives.mockResolvedValue([summary('v35'), summary('v36')]);
    service.acquireArchiveLock.mockImplementation(async (id: string) => ({ acquired: true, archive: summary(id) }));
    service.releaseArchiveLock.mockResolvedValue(undefined);
    service.getArchiveActivities.mockImplementation(async (id: string) => ({ archive: summary(id), activities: [] }));
    saveNow = vi.fn();
    failedTransiently = vi.fn(() => false);
    showNotice = vi.fn();
    props = {
      commitSchedule: () => undefined,
      mapPlannerActivitiesToSchedule: () => [],
      showNotice,
      saveNowRef: { current: saveNow } as MutableRefObject<(() => Promise<boolean>) | null>,
      saveFailedTransientlyRef: { current: failedTransiently } as MutableRefObject<(() => boolean) | null>,
      archiveBaseRef: { current: null } as MutableRefObject<ArchiveBase | null>,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const opened = async () => {
    const h = renderHook(props);
    await settle();
    expect(h.result.current.activeArchiveId).toBe('v35');
    return h;
  };

  it('byter inte schema när sparningen misslyckades av ett nätfel (F10)', async () => {
    const h = await opened();
    saveNow.mockResolvedValue(false);
    failedTransiently.mockReturnValue(true);

    await act(async () => { await h.result.current.handleLoadWeek('v36'); });

    expect(h.result.current.activeArchiveId).toBe('v35');
    expect(service.getArchiveActivities).not.toHaveBeenCalled();
    expect(service.releaseArchiveLock).not.toHaveBeenCalled();
    expect(showNotice).toHaveBeenLastCalledWith(expect.stringContaining('byttes inte'), 'error');
    h.unmount();
  });

  it('byter schema med en varning när vyn ändå inte går att spara', async () => {
    const h = await opened();
    saveNow.mockResolvedValue(false);
    failedTransiently.mockReturnValue(false);

    await act(async () => { await h.result.current.handleLoadWeek('v36'); });

    expect(h.result.current.activeArchiveId).toBe('v36');
    expect(showNotice).toHaveBeenCalledWith('Den senaste ändringen sparades inte.', 'warning');
    h.unmount();
  });

  it('byter schema när allt är sparat', async () => {
    const h = await opened();
    saveNow.mockResolvedValue(true);

    await act(async () => { await h.result.current.handleLoadWeek('v36'); });

    expect(h.result.current.activeArchiveId).toBe('v36');
    expect(service.releaseArchiveLock).toHaveBeenCalledWith('v35');
    h.unmount();
  });

  it('läser in och tar låset först när sparningen från förra besöket är klar (F9)', async () => {
    let finish!: () => void;
    trackLeaveSave(new Promise<void>(resolve => { finish = resolve; }));

    const h = renderHook(props);
    await settle();
    expect(service.listArchives).not.toHaveBeenCalled();
    expect(service.acquireArchiveLock).not.toHaveBeenCalled();

    await act(async () => { finish(); });
    await settle();

    expect(service.acquireArchiveLock).toHaveBeenCalledWith('v35');
    expect(h.result.current.activeArchiveId).toBe('v35');
    h.unmount();
  });

  it('väntar inte för alltid på en sparning som aldrig svarar', async () => {
    vi.useFakeTimers();
    trackLeaveSave(new Promise(() => undefined));

    const h = renderHook(props);
    await settle();
    expect(service.listArchives).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(5000); });
    await settle();

    expect(service.listArchives).toHaveBeenCalled();
    h.unmount();
  });
});
