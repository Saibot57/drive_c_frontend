// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarDayData } from '@/services/monthCalendarService';

const service = vi.hoisted(() => ({
  getDays: vi.fn(),
  getSettings: vi.fn(),
  patchDay: vi.fn(),
  patchSettings: vi.fn(),
}));
vi.mock('@/services/monthCalendarService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/monthCalendarService')>();
  return { ...original, default: service, monthCalendarService: service };
});

import { useCalendarData } from '@/hooks/useCalendarData';
import { TEXT_AUTOSAVE_DELAY_MS } from '@/config/monthCalendarConstants';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** En minimal renderHook. Repot har inget testbibliotek för React. */
const renderHook = () => {
  const result: { current: ReturnType<typeof useCalendarData> } = { current: undefined as never };
  const Probe = () => {
    result.current = useCalendarData(2026, 9);
    return null;
  };
  const root = createRoot(document.createElement('div'));
  act(() => { root.render(React.createElement(Probe)); });
  return { result, unmount() { act(() => root.unmount()); } };
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
};

const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

const advance = async (ms: number) => {
  await act(async () => { vi.advanceTimersByTime(ms); });
  await settle();
};

const serverDay = (key: string, text: string): CalendarDayData => ({
  local_date: key,
  quick_text: text,
  note_document: null,
  highlights: [],
  updated_at: '2026-10-01T08:00:00Z',
});

describe('useCalendarData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(service).forEach(fn => fn.mockReset());
    service.getSettings.mockResolvedValue({ highlight_band_count: 3 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('en långsam hämtning skriver inte över text som väntar på att sparas (F15)', async () => {
    const days = deferred<CalendarDayData[]>();
    service.getDays.mockReturnValue(days.promise);
    let finishFirst!: () => void;
    service.patchDay
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = () => resolve(undefined); }))
      .mockResolvedValue(undefined);
    const h = renderHook();
    const key = h.result.current.cells[10].key;

    act(() => h.result.current.setQuickText(key, 'a'));
    await advance(TEXT_AUTOSAVE_DELAY_MS);
    act(() => h.result.current.setQuickText(key, 'ab'));
    // Första sparningen blir klar medan "ab" väntar.
    await act(async () => { finishFirst(); });
    await settle();

    // Hämtningen läste servern innan något sparats.
    await act(async () => { days.resolve([serverDay(key, 'gammal')]); });
    await settle();

    expect(h.result.current.getDay(key).quick_text).toBe('ab');
    h.unmount();
  });

  it('en långsam hämtning skriver inte över text som redan sparats (F15)', async () => {
    const days = deferred<CalendarDayData[]>();
    service.getDays.mockReturnValue(days.promise);
    service.patchDay.mockResolvedValue(undefined);
    const h = renderHook();
    const key = h.result.current.cells[10].key;

    act(() => h.result.current.setQuickText(key, 'abc'));
    await advance(TEXT_AUTOSAVE_DELAY_MS);
    expect(service.patchDay).toHaveBeenCalledTimes(1);

    // Hämtningen startade före sparningen och har serverns gamla text.
    await act(async () => { days.resolve([serverDay(key, 'gammal')]); });
    await settle();

    expect(h.result.current.getDay(key).quick_text).toBe('abc');
    h.unmount();
  });

  it('hämtningen fyller i dagar som inte ändrats här', async () => {
    const days = deferred<CalendarDayData[]>();
    service.getDays.mockReturnValue(days.promise);
    service.patchDay.mockResolvedValue(undefined);
    const h = renderHook();
    const edited = h.result.current.cells[10].key;
    const other = h.result.current.cells[11].key;

    act(() => h.result.current.setQuickText(edited, 'lokalt'));
    await advance(TEXT_AUTOSAVE_DELAY_MS);
    await act(async () => { days.resolve([serverDay(edited, 'gammal'), serverDay(other, 'från servern')]); });
    await settle();

    expect(h.result.current.getDay(other).quick_text).toBe('från servern');
    expect(h.result.current.getDay(edited).quick_text).toBe('lokalt');
    h.unmount();
  });
});
