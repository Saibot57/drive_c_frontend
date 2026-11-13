// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MindmapContent, MindmapNode } from '@/types/mindmap';
import { layoutMindmap, MINDMAP_WRAP } from './mindmapLayout';
import { renderMindmapCanvas, type MindmapPalette } from './mindmapDraw';

/*
 * Ritningen utan Mindmap-sidans val ska vara den workspace-kortet alltid
 * fått (docs/plans/mindmap-placering.md, skyddsregel 1). Canvas finns inte i
 * jsdom, så en kontext som spelar in anropen ersätter den.
 */

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});

const palette: MindmapPalette = {
  background: '#fff', line: '#000', text: '#111', nodeBg: '#eee', nodeBorder: '#999', rootBg: '#ddd', rootBorder: '#333',
  badgeBg: '#ccc', badgeText: '#222',
  colors: { green: '#0f0', yellow: '#ff0', blue: '#00f', pink: '#f0f', lilac: '#a0f', grey: '#888' },
  font: '14px sans', rootFont: '16px sans',
};

function recordingCanvas() {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === 'measureText') return (text: string) => ({ width: text.length * 8 });
      return (...args: unknown[]) => { calls.push(`${key}(${args.join(',')})`); };
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  const real = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => (tag === 'canvas' ? canvas : real(tag)));
  return calls;
}

const content: MindmapContent = {
  layout: 'both',
  root: n('R', [n('A', [n('A1', [], { offset: { dx: -200, dy: 40 } })], { side: 'right' }), n('B', [], { side: 'left' })]),
};

afterEach(() => vi.restoreAllMocks());

describe('renderMindmapCanvas', () => {
  it('utan `edges` ritas varje kant som kurvan den alltid varit', () => {
    const calls = recordingCanvas();
    renderMindmapCanvas(content, palette);
    const layout = layoutMindmap(content, (text) => text.length * 8);
    const curves = calls.filter((c) => c.startsWith('bezierCurveTo'));
    expect(curves).toEqual(layout.edges.map((e) => {
      const mid = (e.x1 + e.x2) / 2;
      return `bezierCurveTo(${mid},${e.y1},${mid},${e.y2},${e.x2},${e.y2})`;
    }));
  });

  it('med `edges` ritar anroparen kanterna, med linjens färg och bredd satt', () => {
    const calls = recordingCanvas();
    const edges = vi.fn((ctx: CanvasRenderingContext2D) => {
      expect(ctx.strokeStyle).toBe('#000');
      expect(ctx.lineWidth).toBe(1.5);
    });
    renderMindmapCanvas(content, palette, { edges });
    expect(edges).toHaveBeenCalledTimes(1);
    expect(calls.some((c) => c.startsWith('bezierCurveTo'))).toBe(false);
  });
});

describe('nodernas form', () => {
  const long = 'En lång etikett som bryts i flera rader på Mindmap-sidan när den är för bred';
  const wide: MindmapContent = { root: n('R', [n('L', [], { label: long }), n('S')]) };
  // pill() ritar ett piller med arc och en rundad rektangel med arcTo.
  const shapes = (calls: string[]) => ({
    arcs: calls.filter((c) => c.startsWith('arc(')).length,
    arcTos: calls.filter((c) => c.startsWith('arcTo(')),
  });

  it('utan radbrytning (kortet) är alla noder piller, också en lång', () => {
    const calls = recordingCanvas();
    renderMindmapCanvas(wide, palette);
    expect(shapes(calls).arcTos).toEqual([]);
    expect(shapes(calls).arcs).toBe(2 * 3);
  });

  it('en nod med flera rader har hörn med halva radhöjden, de andra är piller', () => {
    const calls = recordingCanvas();
    renderMindmapCanvas(wide, palette, { wrap: MINDMAP_WRAP });
    const { arcs, arcTos } = shapes(calls);
    expect(arcTos).toHaveLength(4);
    arcTos.forEach((c) => expect(c.endsWith(',13)')).toBe(true));
    expect(arcs).toBe(2 * 2);
  });
});
