// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { useMindmapNodeWidth } from '@/hooks/useMindmapNodeWidth';
import type { LaidOutNode } from '@/utils/mindmap/mindmapLayout';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** En minimal renderHook. Repot har inget testbibliotek för React. */
const renderHook = (zoom: number, onCommit: (id: string, width: number) => void) => {
  const result: { current: ReturnType<typeof useMindmapNodeWidth> } = { current: undefined as never };
  const Probe = () => {
    result.current = useMindmapNodeWidth({ zoom: () => zoom, onCommit });
    return null;
  };
  const root = createRoot(document.createElement('div'));
  act(() => { root.render(React.createElement(Probe)); });
  return { result, unmount: () => act(() => root.unmount()) };
};

const node: LaidOutNode = {
  id: 'a', label: 'A', x: 0, y: 0, width: 220, height: 26, labelWidth: 200,
  depth: 1, side: 'right', isRoot: false, hiddenCount: 0,
};

const down = (clientX: number) =>
  ({ button: 0, clientX, preventDefault: () => {}, stopPropagation: () => {} }) as unknown as React.PointerEvent<HTMLElement>;

const pointer = (type: string, clientX: number) => {
  const event = new MouseEvent(type, { clientX });
  act(() => { window.dispatchEvent(event); });
};

describe('useMindmapNodeWidth', () => {
  it('visar bredden under dragningen och sparar en gång vid släppet', () => {
    const onCommit = vi.fn();
    const { result, unmount } = renderHook(2, onCommit);
    act(() => result.current.begin(down(100), node));
    pointer('pointermove', 140);
    expect(result.current.resize).toEqual({ id: 'a', width: 220 });
    pointer('pointermove', 180);
    expect(result.current.resize).toEqual({ id: 'a', width: 240 });
    expect(onCommit).not.toHaveBeenCalled();
    pointer('pointerup', 180);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('a', 240);
    expect(result.current.resize).toBeNull();
    unmount();
  });

  it('avbryts med Esc och sparar ingenting', () => {
    const onCommit = vi.fn();
    const { result, unmount } = renderHook(1, onCommit);
    act(() => result.current.begin(down(100), node));
    pointer('pointermove', 150);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(result.current.resize).toBeNull();
    pointer('pointerup', 150);
    expect(onCommit).not.toHaveBeenCalled();
    unmount();
  });

  it('sparar ingenting för ett klick utan dragning eller ett avbrutet drag', () => {
    const onCommit = vi.fn();
    const { result, unmount } = renderHook(1, onCommit);
    act(() => result.current.begin(down(100), node));
    pointer('pointerup', 100);
    act(() => result.current.begin(down(100), node));
    pointer('pointermove', 150);
    pointer('pointercancel', 150);
    expect(onCommit).not.toHaveBeenCalled();
    unmount();
  });
});
