// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Surface, SurfaceElement, WorkspaceElement } from '../types/workspace.types';

const service = vi.hoisted(() => ({
  getSurfaces: vi.fn(),
  getSurfaceElements: vi.fn(),
  updateElement: vi.fn(),
  updatePlacement: vi.fn(),
  updateSurface: vi.fn(),
}));
vi.mock('../services/workspaceService', () => ({ workspaceService: service }));

import { WorkspaceProvider } from './WorkspaceContext';
import { useWorkspaceData } from './useWorkspaceData';
import { DEBOUNCE_CONTENT_MS, DEBOUNCE_POSITION_MS } from '../types/constants';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const element: WorkspaceElement = {
  id: 'e1',
  user_id: 'u1',
  type: 'text',
  title: 'Anteckning',
  content: { text: 'Från början' },
  created_at: '2026-10-01T08:00:00Z',
  updated_at: '2026-10-01T08:00:00Z',
};

const placement: SurfaceElement = {
  id: 'p1',
  surface_id: 's1',
  element_id: 'e1',
  position_x: 0,
  position_y: 0,
  width: 320,
  height: 200,
  is_locked: false,
  is_on_canvas: true,
  z_index: 1,
  element,
};

/** En minimal renderHook. Repot har inget testbibliotek för React. */
const renderHook = () => {
  const result: { current: ReturnType<typeof useWorkspaceData> } = { current: undefined as never };
  const Probe = () => {
    result.current = useWorkspaceData();
    return null;
  };
  const root = createRoot(document.createElement('div'));
  act(() => {
    root.render(React.createElement(WorkspaceProvider, null, React.createElement(Probe)));
  });
  return { result, unmount() { act(() => root.unmount()); } };
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

/** Texterna som skickats till PUT /elements/<id>, i ordning. */
const sentTexts = () => service.updateElement.mock.calls.map(
  call => ((call[1] as { content?: { text: string } }).content?.text),
);

const hide = () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  visibility.mockRestore();
};

describe('useWorkspaceData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(service).forEach(fn => fn.mockReset());
    window.localStorage.clear();
    service.getSurfaces.mockResolvedValue([{ id: 's1', name: 'Yta 1', sort_order: 0, is_archived: false } as Surface]);
    service.getSurfaceElements.mockResolvedValue([placement]);
    service.updateElement.mockImplementation(async (id: string, data: object) => ({ ...element, id, ...data }));
    service.updatePlacement.mockImplementation(async (id: string, data: object) => ({ ...placement, id, ...data }));
    service.updateSurface.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const loaded = async () => {
    const h = renderHook();
    await act(async () => { await h.result.current.loadSurfaces(); });
    await settle();
    expect(h.result.current.state.elements.e1).toBeDefined();
    return h;
  };

  it('en dragning blir en skrivning när den släpps', async () => {
    const h = await loaded();
    act(() => {
      h.result.current.movePlacement('p1', 10, 10);
      h.result.current.movePlacement('p1', 20, 20);
      h.result.current.movePlacement('p1', 30, 30);
    });
    await advance(DEBOUNCE_POSITION_MS - 1);
    expect(service.updatePlacement).not.toHaveBeenCalled();
    await advance(1);

    expect(service.updatePlacement.mock.calls).toEqual([['p1', { position_x: 30, position_y: 30 }, { keepalive: false }]]);
    h.unmount();
  });

  it('har högst en skrivning i flykt per kort och skickar det senaste efteråt (F12)', async () => {
    let finishFirst!: () => void;
    service.updateElement.mockImplementationOnce(
      () => new Promise(resolve => { finishFirst = () => resolve(element); }),
    );
    const h = await loaded();

    act(() => h.result.current.updateElementContent('e1', { text: 'v1' }));
    await advance(DEBOUNCE_CONTENT_MS);
    act(() => h.result.current.updateElementContent('e1', { text: 'v2' }));
    await advance(DEBOUNCE_CONTENT_MS);
    // v1 hänger. v2 får inte skickas bredvid, för då avgör servern ordningen.
    expect(sentTexts()).toEqual(['v1']);

    await act(async () => { finishFirst(); });
    await settle();
    await advance(0);

    expect(sentTexts()).toEqual(['v1', 'v2']);
    expect(h.result.current.saveStatus).toBe('saved');
    h.unmount();
  });

  it('Uppdatera från källan skrivs inte över av en väntande textändring (F12)', async () => {
    const h = await loaded();
    act(() => h.result.current.updateElementContent('e1', { text: 'Skrivet nyss' }));
    await advance(100);

    await act(async () => {
      await h.result.current.refreshFromSource([{ elementId: 'e1', content: { text: 'Från källan' } }], 'v.38');
    });
    await advance(DEBOUNCE_CONTENT_MS * 4);

    // Den väntande texten ersattes av källan i stället för att landa efter den.
    expect(sentTexts()).toEqual(['Från källan']);
    expect(h.result.current.state.elements.e1.content).toEqual({ text: 'Från källan' });
    h.unmount();
  });

  it('skickar texten med keepalive när fliken stängs', async () => {
    const h = await loaded();
    act(() => h.result.current.updateElementContent('e1', { text: 'Sista ordet' }));
    await advance(100);

    act(() => { window.dispatchEvent(new Event('pagehide')); });
    await settle();

    expect(sentTexts()).toEqual(['Sista ordet']);
    expect(service.updateElement.mock.calls[0][2]).toEqual({ keepalive: true });
    h.unmount();
  });

  it('skickar det som väntar med keepalive när workspace lämnas', async () => {
    const h = await loaded();
    act(() => h.result.current.movePlacement('p1', 50, 60));
    await advance(100);

    h.unmount();
    await settle();

    expect(service.updatePlacement.mock.calls).toEqual([['p1', { position_x: 50, position_y: 60 }, { keepalive: true }]]);
  });

  it('en skrivning som stoppades av nätet skickas igen när fliken döljs', async () => {
    service.updateElement.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const h = await loaded();
    act(() => h.result.current.updateElementContent('e1', { text: 'Viktigt' }));
    await advance(DEBOUNCE_CONTENT_MS);
    expect(h.result.current.saveStatus).toBe('error');

    hide();
    await settle();

    expect(sentTexts()).toEqual(['Viktigt', 'Viktigt']);
    expect(h.result.current.saveStatus).toBe('saved');
    h.unmount();
  });

  it('en skrivning som servern avvisat skickas inte igen', async () => {
    service.updateElement.mockRejectedValue(Object.assign(new Error('Elementet finns inte'), { status: 404 }));
    const h = await loaded();
    act(() => h.result.current.updateElementContent('e1', { text: 'Borta' }));
    await advance(DEBOUNCE_CONTENT_MS);

    hide();
    h.unmount();
    await settle();

    expect(service.updateElement).toHaveBeenCalledTimes(1);
  });

  it('visar felet när en skrivning misslyckas', async () => {
    service.updateElement.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const h = await loaded();
    act(() => h.result.current.updateElementContent('e1', { text: 'x' }));
    await advance(DEBOUNCE_CONTENT_MS);

    expect(h.result.current.plannerNotice?.message).toContain('Kunde inte spara innehållet');
    h.unmount();
  });
});
