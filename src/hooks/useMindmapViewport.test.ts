// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MindmapViewport, useMindmapViewport } from '@/hooks/useMindmapViewport';
import { MINDMAP_VIEW_KEY, panBy, type MindmapRect } from '@/utils/mindmapViewport';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Props = Parameters<typeof useMindmapViewport>[0];

const SIZE = { width: 800, height: 600 };
const bounds: MindmapRect = { x: -50, y: -17, width: 100, height: 34 };

/** En minimal renderHook som också ritar ytan och lagret. Repot har inget testbibliotek för React. */
const renderViewport = (initial: Props) => {
  const result: { current: MindmapViewport } = { current: undefined as never };
  let props = initial;
  const Probe = () => {
    const viewport = useMindmapViewport(props);
    result.current = viewport;
    return React.createElement(
      'div',
      { ref: viewport.viewportRef, 'data-testid': 'viewport' },
      React.createElement('div', { ref: viewport.layerRef }),
    );
  };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(React.createElement(Probe)); });
  return {
    result,
    viewportEl: () => host.firstElementChild as HTMLDivElement,
    layerEl: () => host.firstElementChild?.firstElementChild as HTMLDivElement,
    rerender(next: Partial<Props>) {
      props = { ...props, ...next };
      act(() => { root.render(React.createElement(Probe)); });
    },
    unmount() {
      act(() => root.unmount());
      host.remove();
    },
  };
};

const stored = () => JSON.parse(window.localStorage.getItem(MINDMAP_VIEW_KEY) ?? '{}');

describe('useMindmapViewport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    // jsdom räknar ingen layout; ytan får fasta mått.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(SIZE.width);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(SIZE.height);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('passar in kartan första gången och sätter lagrets transform', () => {
    const h = renderViewport({ mapId: 'a', bounds, ready: true });
    expect(h.result.current.getView()).toEqual({ x: 400, y: 300, zoom: 1 });
    expect(h.layerEl().style.transform).toBe('translate(400px, 300px) scale(1)');
    // Den första vyn är inte användarens och sparas inte.
    act(() => { vi.advanceTimersByTime(2000); });
    expect(window.localStorage.getItem(MINDMAP_VIEW_KEY)).toBeNull();
    h.unmount();
  });

  it('väntar tills texten är mätt', () => {
    const h = renderViewport({ mapId: 'a', bounds, ready: false });
    expect(h.layerEl().style.transform).toBe('');
    h.result.current.change((view) => panBy(view, 10, 10));
    expect(h.result.current.getView()).toEqual({ x: 0, y: 0, zoom: 1 });
    h.rerender({ ready: true });
    expect(h.result.current.getView()).toEqual({ x: 400, y: 300, zoom: 1 });
    h.unmount();
  });

  it('läser kartans sparade vy', () => {
    window.localStorage.setItem(MINDMAP_VIEW_KEY, JSON.stringify({ a: { x: 120, y: 80, zoom: 2, at: 1 } }));
    const h = renderViewport({ mapId: 'a', bounds, ready: true });
    expect(h.result.current.getView()).toEqual({ x: 120, y: 80, zoom: 2 });
    h.unmount();
  });

  it('tål trasig lagring', () => {
    window.localStorage.setItem(MINDMAP_VIEW_KEY, '{inte json');
    const h = renderViewport({ mapId: 'a', bounds, ready: true });
    expect(h.result.current.getView()).toEqual({ x: 400, y: 300, zoom: 1 });
    h.unmount();
  });

  it('sparar en ändrad vy efter en stund, och meddelar den som prenumererar', () => {
    const h = renderViewport({ mapId: 'a', bounds, ready: true });
    const listener = vi.fn();
    h.result.current.subscribe(listener);
    act(() => { h.result.current.change((view) => panBy(view, 30, -20)); });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(h.layerEl().style.transform).toBe('translate(430px, 280px) scale(1)');
    expect(window.localStorage.getItem(MINDMAP_VIEW_KEY)).toBeNull();
    act(() => { vi.advanceTimersByTime(500); });
    expect(stored().a).toMatchObject({ x: 430, y: 280, zoom: 1 });
    h.unmount();
  });

  it('sparar den förra kartans vy under dess id när kartan byts', () => {
    const h = renderViewport({ mapId: 'a', bounds, ready: true });
    act(() => { h.result.current.change((view) => panBy(view, 30, 0)); });
    h.rerender({ mapId: 'b' });
    expect(stored().a).toMatchObject({ x: 430, y: 300 });
    expect(stored().b).toBeUndefined();
    // Den nya kartan börjar inpassad, inte där den förra stod.
    expect(h.result.current.getView()).toEqual({ x: 400, y: 300, zoom: 1 });
    h.unmount();
  });

  it('sparar det som väntar när sidan lämnas', () => {
    const h = renderViewport({ mapId: 'a', bounds, ready: true });
    act(() => { h.result.current.change((view) => panBy(view, 5, 5)); });
    h.unmount();
    expect(stored().a).toMatchObject({ x: 405, y: 305 });
  });

  it('håller kartan kvar i ytan', () => {
    const h = renderViewport({ mapId: 'a', bounds, ready: true });
    act(() => { h.result.current.change((view) => panBy(view, 99999, 0)); });
    // Kartans vänsterkant ligger kvar innanför ytans högerkant.
    expect(bounds.x + h.result.current.getView().x).toBeLessThan(SIZE.width);
    h.unmount();
  });

  it('hjulet panorerar, Ctrl+hjul zoomar, och sidan får inte händelsen', () => {
    const h = renderViewport({ mapId: 'a', bounds, ready: true });
    const pan = new WheelEvent('wheel', { deltaY: 40, cancelable: true, bubbles: true });
    act(() => { h.viewportEl().dispatchEvent(pan); });
    expect(pan.defaultPrevented).toBe(true);
    expect(h.result.current.getView()).toEqual({ x: 400, y: 260, zoom: 1 });

    const zoom = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, clientX: 400, clientY: 260, cancelable: true, bubbles: true });
    act(() => { h.viewportEl().dispatchEvent(zoom); });
    expect(zoom.defaultPrevented).toBe(true);
    const view = h.result.current.getView();
    expect(view.zoom).toBeGreaterThan(1);
    // Pekaren stod på rotens mitt (origo), som ligger kvar.
    expect(view.x).toBeCloseTo(400);
    expect(view.y).toBeCloseTo(260);
    h.unmount();
  });

  it('stegar zoomen, passar in och centrerar med mjuk övergång', () => {
    const h = renderViewport({ mapId: 'a', bounds, ready: true });
    act(() => { h.result.current.zoomStep(1); });
    expect(h.result.current.getView().zoom).toBe(1.1);
    expect(h.layerEl().dataset.smooth).toBe('true');
    act(() => { vi.advanceTimersByTime(300); });
    expect(h.layerEl().dataset.smooth).toBeUndefined();

    act(() => { h.result.current.center({ x: 200, y: 100, width: 0, height: 0 }); });
    expect(h.result.current.getView().x).toBeCloseTo(400 - 220);
    expect(h.result.current.getView().y).toBeCloseTo(300 - 110);
    act(() => { h.result.current.zoomStep(0); });
    expect(h.result.current.getView().zoom).toBe(1);
    act(() => { h.result.current.fit(); });
    expect(h.result.current.getView()).toEqual({ x: 400, y: 300, zoom: 1 });
    h.unmount();
  });
});
