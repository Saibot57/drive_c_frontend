import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import { edgePath, layoutMindmap } from '@/utils/mindmap/mindmapLayout';
import type { RouteCommand } from './mindmapEdges';
import { resolveLines, routeEdges, setLines } from './mindmapRouting';
import { routeToSvg } from './mindmapEdges';

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});
const measure = (text: string) => text.length * 10;

/** Som kartan "Förskjutna": förskjutna barn på båda sidor om roten. */
const doc = (extra: Partial<MindmapDoc> = {}): MindmapDoc => ({
  layout: 'both',
  root: n('R', [
    n('A', [n('A1', [], { offset: { dx: -260, dy: 60 } }), n('A2', [], { offset: { dx: 0, dy: -120 } }), n('A3')], { side: 'right' }),
    n('B', [n('B1'), n('B2')], { side: 'right', offset: { dx: 120, dy: 80 } }),
    n('C', [n('C1', [], { offset: { dx: 200, dy: -60 } }), n('C2')], { side: 'left', offset: { dx: 40, dy: -140 } }),
  ]),
  ...extra,
});

const ends = (route: RouteCommand[]) => {
  const first = route[0];
  const last = route[route.length - 1];
  return { x1: first.x, y1: first.y, x2: last.x, y2: last.y };
};

describe('routeEdges', () => {
  it('en karta utan val ritas exakt som edgePath, också med förskjutningar', () => {
    const d = doc();
    const layout = layoutMindmap(d, measure);
    const routed = routeEdges(layout, d);
    expect(routed.map((e) => routeToSvg(e.route))).toEqual(layout.edges.map(edgePath));
    expect(routed.map((e) => `${e.fromId}>${e.toId}`)).toEqual(layout.edges.map((e) => `${e.fromId}>${e.toId}`));
  });

  it('formen gäller också med fästet efter grensidan', () => {
    const d = doc({ lines: { shape: 'straight' } });
    const layout = layoutMindmap(d, measure);
    const a1 = routeEdges(layout, d).find((e) => e.toId === 'A1')!;
    const edge = layout.edges.find((e) => e.toId === 'A1')!;
    expect(a1.route).toEqual([{ type: 'M', x: edge.x1, y: edge.y1 }, { type: 'L', x: edge.x2, y: edge.y2 }]);
  });

  it('närmaste kant vänder linjen till ett barn som dragits förbi föräldern', () => {
    const d = doc({ lines: { anchor: 'nearest' } });
    const layout = layoutMindmap(d, measure);
    const a = layout.byId.get('A')!;
    const a1 = layout.byId.get('A1')!;
    expect(a1.x + a1.width).toBeLessThan(a.x);
    const route = routeEdges(layout, d).find((e) => e.toId === 'A1')!.route;
    expect(ends(route)).toEqual({ x1: a.x, y1: a.y + a.height / 2, x2: a1.x + a1.width, y2: a1.y + a1.height / 2 });
  });

  it('närmaste kant går upp och ned när barnet står rakt ovanför', () => {
    const d = doc({ lines: { anchor: 'nearest' } });
    const layout = layoutMindmap(d, measure);
    const a = layout.byId.get('A')!;
    const a2 = layout.byId.get('A2')!;
    // A2 står ovanför A men fortfarande till höger om den: höger och vänster.
    const route = routeEdges(layout, d).find((e) => e.toId === 'A2')!.route;
    expect(ends(route).x1).toBe(a.x + a.width);
    expect(ends(route).x2).toBe(a2.x);

    const above: MindmapDoc = { root: n('R', [n('X', [], { offset: { dx: -60, dy: -100 } })]), lines: { anchor: 'nearest' } };
    const lay = layoutMindmap(above, measure);
    const r = lay.byId.get('R')!;
    const x = lay.byId.get('X')!;
    const up = routeEdges(lay, above)[0].route;
    expect(ends(up)).toEqual({ x1: r.x + r.width / 2, y1: r.y, x2: x.x + x.width / 2, y2: x.y + x.height });
  });

  it('en orörd karta får samma ändar med båda fästena', () => {
    const plain: MindmapDoc = {
      layout: 'both',
      root: n('R', [n('A', [n('A1'), n('A2'), n('A3'), n('A4')], { side: 'right' }), n('B', [n('B1'), n('B2')], { side: 'left' })]),
    };
    const layout = layoutMindmap(plain, measure);
    const side = routeEdges(layout, plain).map((e) => ends(e.route));
    const nearest = routeEdges(layout, { lines: { anchor: 'nearest' } }).map((e) => ends(e.route));
    nearest.forEach((p, i) => {
      expect(p.x1).toBeCloseTo(side[i].x1, 6);
      expect(p.y1).toBeCloseTo(side[i].y1, 6);
      expect(p.x2).toBeCloseTo(side[i].x2, 6);
      expect(p.y2).toBeCloseTo(side[i].y2, 6);
    });
  });
});

describe('resolveLines och setLines', () => {
  it('saknade val ger kurva efter grensidan', () => {
    expect(resolveLines(undefined)).toEqual({ shape: 'curve', anchor: 'side' });
    expect(resolveLines({ shape: 'elbow' })).toEqual({ shape: 'elbow', anchor: 'side' });
  });

  it('setLines sparar båda valen och ändrar bara det som anges', () => {
    const d = setLines(doc(), { shape: 'straight' });
    expect(d.lines).toEqual({ shape: 'straight', anchor: 'side' });
    expect(setLines(d, { anchor: 'nearest' }).lines).toEqual({ shape: 'straight', anchor: 'nearest' });
  });
});
