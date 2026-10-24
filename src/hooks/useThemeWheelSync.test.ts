// @vitest-environment jsdom
import React, { act, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThemeArea, ThemeWheel } from '@/types/themeWheel';

const service = vi.hoisted(() => ({
  listWheels: vi.fn(),
  listAreas: vi.fn(),
  getWheel: vi.fn(),
  createWheel: vi.fn(),
  updateWheel: vi.fn(),
  deleteWheel: vi.fn(),
  duplicateWheel: vi.fn(),
  shareWheel: vi.fn(),
  syncAreas: vi.fn(),
}));
vi.mock('@/services/themeWheelService', () => ({ themeWheelService: service }));

import { useThemeWheelSync } from '@/hooks/useThemeWheelSync';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const wheelA: ThemeWheel = {
  id: 'A',
  name: 'Hösten',
  startWeek: 34,
  startYear: 2026,
  weekCount: 20,
  holidayWeeks: [],
  blocks: [],
};
const wheelB: ThemeWheel = { ...wheelA, id: 'B', name: 'Våren' };

type Hook = ReturnType<typeof useThemeWheelSync>;

/**
 * Hjulet och biblioteket hålls i state som i ThemeWheelPlanner. Repot har
 * inget testbibliotek för React, så renderHook är skriven för hand.
 */
const renderWheelSync = (showNotice: (message: string, tone: string) => void = () => undefined) => {
  const result: {
    current: Hook;
    wheel: ThemeWheel;
    rename: (name: string) => void;
    setAreas: (areas: ThemeArea[]) => void;
  } = {
    current: undefined as never,
    wheel: undefined as never,
    rename: () => undefined,
    setAreas: () => undefined,
  };
  const Probe = () => {
    const [wheel, setWheel] = useState<ThemeWheel>({ ...wheelA, id: '' });
    const [areas, setAreas] = useState<ThemeArea[]>([]);
    const commit = useCallback((updater: (prev: ThemeWheel) => ThemeWheel) => setWheel(updater), []);
    result.current = useThemeWheelSync({
      wheel,
      commit,
      manualAreas: areas,
      setManualAreas: setAreas,
      showNotice,
    });
    result.wheel = wheel;
    result.rename = name => setWheel(prev => ({ ...prev, name }));
    result.setAreas = setAreas;
    return null;
  };
  const root = createRoot(document.createElement('div'));
  act(() => { root.render(React.createElement(Probe)); });
  return {
    result,
    unmount() { act(() => root.unmount()); },
  };
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

/** Namnen som skickats till PUT /wheels/<id>, i ordning. */
const sent = () => service.updateWheel.mock.calls.map(call => `${call[0]}:${(call[1] as ThemeWheel).name}`);

/** Ett fel som backend svarat med, till exempel 400 eller 409. */
const httpError = (message: string, status: number) => Object.assign(new Error(message), { status });

describe('useThemeWheelSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(service).forEach(fn => fn.mockReset());
    window.localStorage.clear();
    service.listWheels.mockResolvedValue([
      { id: 'A', name: 'Hösten', startWeek: 34, startYear: 2026, weekCount: 20 },
      { id: 'B', name: 'Våren', startWeek: 2, startYear: 2027, weekCount: 20 },
    ]);
    service.listAreas.mockResolvedValue([]);
    service.getWheel.mockImplementation(async (id: string) => (id === 'A' ? wheelA : wheelB));
    service.updateWheel.mockImplementation(async (id: string, wheel: ThemeWheel) => ({ ...wheel, id }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const loaded = async () => {
    const h = renderWheelSync();
    await settle();
    expect(h.result.current.loadStatus).toBe('loaded');
    expect(h.result.wheel.id).toBe('A');
    return h;
  };

  it('sparar inte ett hjul som just lästs in', async () => {
    const h = await loaded();
    await advance(5000);
    expect(service.updateWheel).not.toHaveBeenCalled();
    h.unmount();
    expect(service.updateWheel).not.toHaveBeenCalled();
  });

  it('sparar en ändring en sekund efter att det blivit stilla, och bara en gång', async () => {
    const h = await loaded();
    act(() => h.result.rename('Hösten 2026'));
    await advance(500);
    act(() => h.result.rename('Hösten 26'));
    await advance(999);
    expect(service.updateWheel).not.toHaveBeenCalled();
    await advance(1);
    await advance(5000);

    expect(sent()).toEqual(['A:Hösten 26']);
    expect(h.result.current.saveStatus).toBe('saved');
    h.unmount();
  });

  it('sparar ändringen när man byter hjul inom sekunden (F8)', async () => {
    const h = await loaded();
    act(() => h.result.rename('Hösten 2026'));
    await advance(400);

    await act(async () => { await h.result.current.selectWheel('B'); });
    await settle();

    expect(sent()).toEqual(['A:Hösten 2026']);
    expect(h.result.wheel.id).toBe('B');
    // Svaret för A får inte göra B:s nyss inlästa läge till en ändring.
    await advance(5000);
    expect(service.updateWheel).toHaveBeenCalledTimes(1);
    h.unmount();
  });

  it('sparar ändringen när sidan lämnas inom appen (F8)', async () => {
    const h = await loaded();
    act(() => h.result.rename('Hösten 2026'));
    await advance(400);

    h.unmount();
    await settle();

    expect(sent()).toEqual(['A:Hösten 2026']);
    expect(service.updateWheel.mock.calls[0][2]).toEqual({ keepalive: true });
  });

  it('sparar ändringen när fliken stängs (F8)', async () => {
    const h = await loaded();
    act(() => h.result.rename('Hösten 2026'));
    await advance(400);

    act(() => { window.dispatchEvent(new Event('pagehide')); });
    await settle();

    expect(sent()).toEqual(['A:Hösten 2026']);
    expect(service.updateWheel.mock.calls[0][2]).toEqual({ keepalive: true });
    h.unmount();
  });

  it('sparar ändringen när fliken döljs, som på en iPad (F8)', async () => {
    const h = await loaded();
    act(() => h.result.rename('Hösten 2026'));
    await advance(400);

    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await settle();
    visibility.mockRestore();

    expect(sent()).toEqual(['A:Hösten 2026']);
    expect(service.updateWheel.mock.calls[0][2]).toEqual({ keepalive: true });
    h.unmount();
  });

  it('sparar bibliotekets ändring när sidan lämnas (F8)', async () => {
    service.syncAreas.mockImplementation(async (areas: ThemeArea[]) => areas);
    const h = await loaded();
    act(() => h.result.setAreas([{ id: 'x', title: 'Vikingatiden', color: '#336699' }]));
    await advance(400);

    h.unmount();
    await settle();

    expect(service.syncAreas).toHaveBeenCalledTimes(1);
    expect(service.syncAreas.mock.calls[0][1]).toEqual({ keepalive: true });
  });

  it('har högst en sparning i flykt per hjul och skickar det senaste efteråt (F12)', async () => {
    let finishFirst!: (wheel: ThemeWheel) => void;
    service.updateWheel
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
    const h = await loaded();

    act(() => h.result.rename('v1'));
    await advance(1000);
    act(() => h.result.rename('v2'));
    await advance(1000);
    // v1 hänger. v2 får inte skickas bredvid, för då avgör servern ordningen.
    expect(sent()).toEqual(['A:v1']);

    await act(async () => { finishFirst({ ...wheelA, name: 'v1' }); });
    await settle();
    await advance(0);

    expect(sent()).toEqual(['A:v1', 'A:v2']);
    expect(h.result.current.saveStatus).toBe('saved');
    // Svaret för v1 fick inte skriva tillbaka det gamla namnet i vyn.
    expect(h.result.wheel.name).toBe('v2');
    h.unmount();
  });

  it('sparar en ändring tillbaka till det sparade medan en sparning är i flykt (F12)', async () => {
    let finishFirst!: (wheel: ThemeWheel) => void;
    service.updateWheel
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
    const h = await loaded();

    act(() => h.result.rename('Fel namn'));
    await advance(1000);
    // Ångra tillbaka till det som var sparat innan.
    act(() => h.result.rename('Hösten'));
    await advance(1000);
    await act(async () => { finishFirst({ ...wheelA, name: 'Fel namn' }); });
    await settle();
    await advance(0);

    expect(sent()).toEqual(['A:Fel namn', 'A:Hösten']);
    h.unmount();
  });

  it('byter inte hjul när ändringen inte kunde sparas av ett nätfel', async () => {
    const showNotice = vi.fn();
    service.updateWheel.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const h = renderWheelSync(showNotice);
    await settle();
    act(() => h.result.rename('Hösten 2026'));
    await advance(400);

    await act(async () => { await h.result.current.selectWheel('B'); });
    await settle();

    expect(sent()).toEqual(['A:Hösten 2026']);
    expect(h.result.wheel.id).toBe('A');
    expect(h.result.wheel.name).toBe('Hösten 2026');
    expect(showNotice).toHaveBeenLastCalledWith(expect.stringContaining('byttes inte'), 'error');

    // Nästa försök går igenom, och då byts hjulet.
    await act(async () => { await h.result.current.selectWheel('B'); });
    await settle();
    expect(sent()).toEqual(['A:Hösten 2026', 'A:Hösten 2026']);
    expect(h.result.wheel.id).toBe('B');
    h.unmount();
  });

  it('ett fel som inte går över stoppar inte bytet', async () => {
    const showNotice = vi.fn();
    service.updateWheel.mockRejectedValue(httpError('Namnet är för långt.', 400));
    const h = renderWheelSync(showNotice);
    await settle();
    act(() => h.result.rename('x'.repeat(300)));
    await advance(400);

    await act(async () => { await h.result.current.selectWheel('B'); });
    await settle();

    expect(showNotice).toHaveBeenCalledWith('Namnet är för långt.', 'error');
    expect(h.result.wheel.id).toBe('B');
    // Det som inte går att spara skickas inte igen när sidan lämnas.
    h.unmount();
    expect(service.updateWheel).toHaveBeenCalledTimes(1);
  });

  it('skickar ingenting till ett hjul som tagits bort', async () => {
    service.deleteWheel.mockResolvedValue(undefined);
    const h = await loaded();
    act(() => h.result.rename('Ska bort'));
    await advance(400);

    service.listWheels.mockResolvedValue([
      { id: 'B', name: 'Våren', startWeek: 2, startYear: 2027, weekCount: 20 },
    ]);
    await act(async () => { await h.result.current.deleteWheel('A'); });
    await settle();
    await advance(5000);
    h.unmount();

    expect(h.result.wheel.id).toBe('B');
    expect(service.updateWheel).not.toHaveBeenCalled();
  });

  it('laddar inte upp ett gammalt lokalt utkast i ett konto utan hjul (dataintegritet F24)', async () => {
    // Nyckeln var inte knuten till någon användare. På en delad dator hamnade
    // utkastet i det konto som först öppnade temakalendern.
    window.localStorage.setItem('theme_wheel_draft_v1', JSON.stringify({ ...wheelA, name: 'Någon annans' }));
    service.listWheels.mockResolvedValue([]);
    service.createWheel.mockImplementation(async (wheel: ThemeWheel) => ({ ...wheel, id: 'N' }));

    const h = renderWheelSync();
    await settle();
    h.unmount();

    expect(service.createWheel).toHaveBeenCalledTimes(1);
    expect((service.createWheel.mock.calls[0][0] as ThemeWheel).name).toBe('Nytt tema');
    expect(h.result.wheel.name).toBe('Nytt tema');
  });
});
