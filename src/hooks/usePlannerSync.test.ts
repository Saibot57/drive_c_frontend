// @vitest-environment jsdom
import React, { act, MutableRefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduledEntry } from '@/types/schedule';

const save = vi.fn();
vi.mock('@/services/plannerService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/plannerService')>();
  return {
    ...original,
    plannerService: {
      saveArchiveActivities: (...args: unknown[]) => save(...args),
      getArchiveActivities: vi.fn(),
    },
  };
});

import { ArchiveConflictError } from '@/services/plannerService';
import { ArchiveBase, usePlannerSync } from '@/hooks/usePlannerSync';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Props = Parameters<typeof usePlannerSync>[0];

/** En minimal renderHook. Repot har inget testbibliotek för React. */
const renderHook = (initial: Props) => {
  const result: { current: ReturnType<typeof usePlannerSync> } = { current: undefined as never };
  let props = initial;
  const Probe = () => {
    result.current = usePlannerSync(props);
    return null;
  };
  const root = createRoot(document.createElement('div'));
  act(() => { root.render(React.createElement(Probe)); });
  return {
    result,
    rerender(next: Partial<Props>) {
      props = { ...props, ...next };
      act(() => { root.render(React.createElement(Probe)); });
    },
    unmount() { act(() => root.unmount()); },
  };
};

const entry = (id: string, title: string): ScheduledEntry => ({
  id,
  instanceId: id,
  title,
  teacher: '',
  room: '',
  color: '#ffffff',
  duration: 60,
  day: 'Måndag',
  startTime: '08:00',
  endTime: '09:00',
} as ScheduledEntry);

const archive = (version: number) => ({ archive: { id: 'v35', version }, activities: [] });

const sentTitles = () => save.mock.calls.map(call => (call[1] as { title: string }[]).map(a => a.title));
const sentVersions = () => save.mock.calls.map(call => call[2]);

const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
};

/** Väntar ut autosparets sekund och låter svaret landa. */
const autosave = async () => {
  await act(async () => { vi.advanceTimersByTime(1000); });
  await settle();
};

describe('usePlannerSync', () => {
  let baseRef: MutableRefObject<ArchiveBase | null>;
  let props: Props;

  beforeEach(() => {
    vi.useFakeTimers();
    save.mockReset();
    // Vyn har läst in v.35 i version 3.
    baseRef = { current: { archiveId: 'v35', version: 3 } };
    props = {
      schedule: [],
      commitSchedule: () => undefined,
      activeArchiveId: 'v35',
      initialArchiveId: null,
      isReadOnly: false,
      serverSyncToken: 0,
      onLockLost: () => undefined,
      archiveBaseRef: baseRef,
      showNotice: () => undefined,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skickar versionen vyn bygger på och tar nästa ur svaret', async () => {
    save.mockResolvedValueOnce(archive(4)).mockResolvedValueOnce(archive(5));
    const h = renderHook(props);

    h.rerender({ schedule: [entry('a', 'Matte')] });
    await autosave();
    h.rerender({ schedule: [entry('a', 'Matte'), entry('b', 'Bild')] });
    await autosave();

    expect(sentVersions()).toEqual([3, 4]);
    expect(baseRef.current).toEqual({ archiveId: 'v35', version: 5 });
    h.unmount();
  });

  it('skickar null när versionen gäller ett annat schema', async () => {
    baseRef.current = { archiveId: 'v34', version: 7 };
    save.mockResolvedValueOnce(archive(1));
    const h = renderHook(props);

    h.rerender({ schedule: [entry('a', 'Matte')] });
    await autosave();

    expect(sentVersions()).toEqual([null]);
    h.unmount();
  });

  it('stannar vid en konflikt och skriver inget förrän användaren valt', async () => {
    save.mockRejectedValueOnce(new ArchiveConflictError('Schemat har ändrats i en annan flik.', 9));
    const h = renderHook(props);

    h.rerender({ schedule: [entry('a', 'Gamla fliken')] });
    await autosave();

    expect(h.result.current.conflict).toEqual({
      archiveId: 'v35',
      serverVersion: 9,
      message: 'Schemat har ändrats i en annan flik.',
    });
    expect(h.result.current.saveStatus).toBe('error');

    // Fortsatta ändringar sparas inte, och Spara nu svarar att inget sparades.
    h.rerender({ schedule: [entry('a', 'Gamla fliken'), entry('b', 'Mer')] });
    await autosave();
    let saved: boolean | undefined;
    await act(async () => { saved = await h.result.current.saveNow(); });

    expect(save).toHaveBeenCalledTimes(1);
    expect(saved).toBe(false);
    h.unmount();
  });

  it('Behåll min version sparar vyn ovanpå serverns version', async () => {
    save
      .mockRejectedValueOnce(new ArchiveConflictError('Ändrat.', 9))
      .mockResolvedValueOnce(archive(10));
    const h = renderHook(props);

    h.rerender({ schedule: [entry('a', 'Min version')] });
    await autosave();
    let kept: boolean | undefined;
    await act(async () => { kept = await h.result.current.keepMine(); });

    expect(kept).toBe(true);
    expect(sentVersions()).toEqual([3, 9]);
    expect(sentTitles()[1]).toEqual(['Min version']);
    expect(h.result.current.conflict).toBeNull();
    expect(baseRef.current).toEqual({ archiveId: 'v35', version: 10 });
    h.unmount();
  });

  it('en inläsning från servern löser konflikten', async () => {
    save.mockRejectedValueOnce(new ArchiveConflictError('Ändrat.', 9));
    const h = renderHook(props);

    h.rerender({ schedule: [entry('a', 'Gamla fliken')] });
    await autosave();
    expect(h.result.current.conflict).not.toBeNull();

    // Ladda den sparade versionen: arkivhanteraren sätter versionen och
    // stegar token i samma rendering som det inlästa schemat.
    baseRef.current = { archiveId: 'v35', version: 9 };
    h.rerender({ schedule: [entry('k', 'Kvällens lektion')], serverSyncToken: 1 });
    await autosave();

    expect(h.result.current.conflict).toBeNull();
    // Det inlästa är redan sparat och skrivs inte tillbaka.
    expect(save).toHaveBeenCalledTimes(1);
    h.unmount();
  });

  it('sparar en ändring som görs medan en annan sparning pågår (F1)', async () => {
    let finishFirst!: (value: unknown) => void;
    save
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockResolvedValue(archive(5));
    const h = renderHook(props);

    // A sparas och servern är långsam.
    h.rerender({ schedule: [entry('a', 'A')] });
    await act(async () => { vi.advanceTimersByTime(1000); });
    // Under tiden läggs B till, och dess autospar köas.
    h.rerender({ schedule: [entry('a', 'A'), entry('b', 'B')] });
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => { finishFirst(archive(4)); });
    await settle();
    await act(async () => { vi.advanceTimersByTime(0); });
    await settle();

    expect(sentTitles()).toEqual([['A'], ['A', 'B']]);
    // Den köade sparningen bygger på versionen den första gav.
    expect(sentVersions()).toEqual([3, 4]);
    expect(h.result.current.saveStatus).toBe('saved');
    h.unmount();
  });
});
