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

  it('visar varför autosparet misslyckades', async () => {
    const showNotice = vi.fn();
    save.mockRejectedValueOnce(new Error('Kunde inte spara schemat. Post 1: title har 151 tecken, högst 150 får plats'));
    const h = renderHook({ ...props, showNotice });

    h.rerender({ schedule: [entry('a', 'Matte')] });
    await autosave();

    expect(h.result.current.saveStatus).toBe('error');
    expect(showNotice).toHaveBeenCalledWith(
      'Kunde inte spara schemat. Post 1: title har 151 tecken, högst 150 får plats',
      'error',
    );
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

  it('sparar ett schema som tömts (F11)', async () => {
    save.mockResolvedValueOnce(archive(4)).mockResolvedValueOnce(archive(5));
    const h = renderHook(props);

    h.rerender({ schedule: [entry('a', 'Matte')] });
    await autosave();
    // Veckans sista post tas bort. Förr stod det "Sparat", men servern
    // behöll posten, och den kom tillbaka vid nästa omladdning.
    h.rerender({ schedule: [] });
    await autosave();

    expect(sentTitles()).toEqual([['Matte'], []]);
    expect(sentVersions()).toEqual([3, 4]);
    expect(h.result.current.saveStatus).toBe('saved');
    h.unmount();
  });

  it('skriver inget när ett tomt schema är oförändrat', async () => {
    const h = renderHook(props);
    await autosave();
    h.rerender({ serverSyncToken: 1 });
    await autosave();

    expect(save).not.toHaveBeenCalled();
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

  // --- Dataintegritet F9: sparning när sidan lämnas ---

  const sentOptions = () => save.mock.calls.map(call => call[3]);

  const hide = () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    visibility.mockRestore();
  };

  it('sparar vid stängning och låter servern släppa låset (F9)', async () => {
    save.mockResolvedValue(archive(4));
    const h = renderHook(props);
    h.rerender({ schedule: [entry('a', 'Sista ändringen')] });
    await act(async () => { vi.advanceTimersByTime(400); });

    act(() => { window.dispatchEvent(new Event('pagehide')); });
    await settle();

    expect(sentTitles()).toEqual([['Sista ändringen']]);
    expect(sentVersions()).toEqual([3]);
    expect(sentOptions()).toEqual([{ keepalive: true, releaseLock: true }]);
    // Autosparets sekund skickar inte samma vecka en gång till.
    await autosave();
    expect(save).toHaveBeenCalledTimes(1);
    h.unmount();
  });

  it('sparar när fliken döljs, utan att släppa låset (F9)', async () => {
    save.mockResolvedValue(archive(4));
    const h = renderHook(props);
    h.rerender({ schedule: [entry('a', 'Matte')] });
    await act(async () => { vi.advanceTimersByTime(400); });

    hide();
    await settle();

    expect(sentTitles()).toEqual([['Matte']]);
    expect(sentOptions()).toEqual([{ keepalive: true }]);
    expect(h.result.current.saveStatus).toBe('saved');
    h.unmount();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('sparar när planeraren lämnas inom appen (F9)', async () => {
    save.mockResolvedValue(archive(4));
    const h = renderHook(props);
    h.rerender({ schedule: [entry('a', 'Matte')] });
    await act(async () => { vi.advanceTimersByTime(400); });

    h.unmount();
    await settle();

    expect(sentTitles()).toEqual([['Matte']]);
    expect(sentOptions()).toEqual([{ keepalive: true, releaseLock: true }]);
  });

  it('väntar in en sparning i flykt innan den sparar vid sidbyte (F9)', async () => {
    let finishFirst!: (value: unknown) => void;
    save
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockResolvedValue(archive(5));
    const h = renderHook(props);
    h.rerender({ schedule: [entry('a', 'A')] });
    await act(async () => { vi.advanceTimersByTime(1000); });
    h.rerender({ schedule: [entry('a', 'A'), entry('b', 'B')] });

    h.unmount();
    await settle();
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => { finishFirst(archive(4)); });
    await settle();

    expect(sentTitles()).toEqual([['A'], ['A', 'B']]);
    // Bygger på versionen den första sparningen gav, inte en gissning.
    expect(sentVersions()).toEqual([3, 4]);
    expect(sentOptions()[1]).toEqual({ keepalive: true, releaseLock: true });
  });

  it('sparar ett tömt schema vid stängning (F9 och F11)', async () => {
    save.mockResolvedValueOnce(archive(4)).mockResolvedValueOnce(archive(5));
    const h = renderHook(props);
    h.rerender({ schedule: [entry('a', 'Matte')] });
    await autosave();
    h.rerender({ schedule: [] });

    act(() => { window.dispatchEvent(new Event('pagehide')); });
    await settle();

    expect(sentTitles()).toEqual([['Matte'], []]);
    expect(sentVersions()).toEqual([3, 4]);
    h.unmount();
  });

  it('skickar inget när sidan lämnas och allt är sparat', async () => {
    save.mockResolvedValue(archive(4));
    const h = renderHook(props);
    h.rerender({ schedule: [entry('a', 'Matte')] });
    await autosave();

    act(() => { window.dispatchEvent(new Event('pagehide')); });
    hide();
    h.unmount();
    await settle();

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('skickar inget när sidan lämnas i läsläge', async () => {
    const h = renderHook({ ...props, isReadOnly: true });
    h.rerender({ schedule: [entry('a', 'Någon annans')] });

    act(() => { window.dispatchEvent(new Event('pagehide')); });
    h.unmount();
    await settle();

    expect(save).not.toHaveBeenCalled();
  });

  it('varnar vid stängning när något inte är sparat', async () => {
    let finish!: (value: unknown) => void;
    save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const h = renderHook(props);
    const closing = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(closing()).toBe(false);
    h.rerender({ schedule: [entry('a', 'Matte')] });
    // Väntar på autosparet.
    expect(closing()).toBe(true);
    await act(async () => { vi.advanceTimersByTime(1000); });
    // En sparning är på väg. Hinner en annan flik spara först förloras den.
    expect(closing()).toBe(true);
    await act(async () => { finish(archive(4)); });
    await settle();
    expect(closing()).toBe(false);
    h.unmount();
  });

  // --- Dataintegritet F10: nya försök efter ett misslyckat autospar ---

  it('försöker igen efter ett nätfel (F10)', async () => {
    const showNotice = vi.fn();
    save.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(archive(4));
    const h = renderHook({ ...props, showNotice });
    h.rerender({ schedule: [entry('a', 'Matte')] });
    await autosave();
    expect(h.result.current.saveStatus).toBe('error');

    await act(async () => { vi.advanceTimersByTime(1999); });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(1); });
    await settle();

    expect(sentTitles()).toEqual([['Matte'], ['Matte']]);
    expect(h.result.current.saveStatus).toBe('saved');
    expect(showNotice).toHaveBeenCalledTimes(1);
    h.unmount();
  });

  it('fortsätter försöka under ett långt avbrott, som oftast var 30:e sekund (F10)', async () => {
    const showNotice = vi.fn();
    save.mockRejectedValue(new TypeError('Failed to fetch'));
    const h = renderHook({ ...props, showNotice });
    h.rerender({ schedule: [entry('a', 'Matte')] });
    await autosave();

    // 2, 4, 8, 16 och sedan 30 s mellan försöken.
    for (const wait of [2000, 4000, 8000, 16000, 30000, 30000]) {
      const before = save.mock.calls.length;
      await act(async () => { vi.advanceTimersByTime(wait - 1); });
      expect(save).toHaveBeenCalledTimes(before);
      await act(async () => { vi.advanceTimersByTime(1); });
      await settle();
      expect(save).toHaveBeenCalledTimes(before + 1);
    }
    // En notis, inte en per försök.
    expect(showNotice).toHaveBeenCalledTimes(1);

    save.mockResolvedValue(archive(4));
    await act(async () => { vi.advanceTimersByTime(30000); });
    await settle();
    expect(h.result.current.saveStatus).toBe('saved');
    h.unmount();
  });

  it('försöker igen direkt när nätet kommer tillbaka (F10)', async () => {
    save.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(archive(4));
    const h = renderHook(props);
    h.rerender({ schedule: [entry('a', 'Matte')] });
    await autosave();

    act(() => { window.dispatchEvent(new Event('online')); });
    await settle();

    expect(save).toHaveBeenCalledTimes(2);
    expect(h.result.current.saveStatus).toBe('saved');
    h.unmount();
  });

  it('ett nytt försök sparar ett tömt schema (F10 och F11)', async () => {
    save
      .mockResolvedValueOnce(archive(4))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(archive(5));
    const h = renderHook(props);
    h.rerender({ schedule: [entry('a', 'Matte')] });
    await autosave();
    h.rerender({ schedule: [] });
    await autosave();
    await act(async () => { vi.advanceTimersByTime(2000); });
    await settle();

    expect(sentTitles()).toEqual([['Matte'], [], []]);
    expect(h.result.current.saveStatus).toBe('saved');
    h.unmount();
  });

  it('en ny ändring tar över från det väntande försöket (F10)', async () => {
    save.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(archive(4));
    const h = renderHook(props);
    h.rerender({ schedule: [entry('a', 'Matte')] });
    await autosave();
    await act(async () => { vi.advanceTimersByTime(500); });
    h.rerender({ schedule: [entry('a', 'Matte'), entry('b', 'Bild')] });
    await autosave();

    expect(sentTitles()).toEqual([['Matte'], ['Matte', 'Bild']]);
    await act(async () => { vi.advanceTimersByTime(60000); });
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    h.unmount();
  });

  it('försöker inte igen när servern avvisar veckan (F10)', async () => {
    save.mockRejectedValue(Object.assign(new Error('Kunde inte spara schemat. För lång titel.'), { status: 400 }));
    const h = renderHook(props);
    h.rerender({ schedule: [entry('a', 'x'.repeat(200))] });
    await autosave();
    await act(async () => { vi.advanceTimersByTime(120000); });
    await settle();

    expect(save).toHaveBeenCalledTimes(1);
    expect(h.result.current.saveStatus).toBe('error');
    h.unmount();
  });

  it('försöker inte igen efter byte till ett annat schema (F10)', async () => {
    save.mockRejectedValue(new TypeError('Failed to fetch'));
    const h = renderHook(props);
    h.rerender({ schedule: [entry('a', 'Matte')] });
    await autosave();

    baseRef.current = { archiveId: 'v36', version: 1 };
    h.rerender({ activeArchiveId: 'v36', schedule: [], serverSyncToken: 1 });
    await act(async () => { vi.advanceTimersByTime(120000); });
    await settle();

    expect(save).toHaveBeenCalledTimes(1);
    h.unmount();
  });

  it('säger om Spara nu misslyckades av ett fel som kan gå över', async () => {
    save
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(Object.assign(new Error('För lång titel.'), { status: 400 }));
    const h = renderHook(props);
    h.rerender({ schedule: [entry('a', 'Matte')] });

    let saved: boolean | undefined;
    await act(async () => { saved = await h.result.current.saveNow(); });
    expect(saved).toBe(false);
    expect(h.result.current.saveFailedTransiently()).toBe(true);

    await act(async () => { saved = await h.result.current.saveNow(); });
    expect(saved).toBe(false);
    expect(h.result.current.saveFailedTransiently()).toBe(false);
    h.unmount();
  });
});
