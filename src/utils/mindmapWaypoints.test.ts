import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import { layoutMindmap } from '@/utils/mindmap/mindmapLayout';
import { findNode, moveNode, sanitizeMindmap, setOffset } from '@/utils/mindmap/mindmapTree';
import { crossLinkGeometry } from './mindmapCrossLinks';
import { addCrossLink, reverseCrossLink, sanitizeMindmapDoc, setCrossLinkPoints } from './mindmapDoc';
import { longestSegmentMiddle, routeEdge, routeToSvg, waypointInsertIndex } from './mindmapEdges';
import {
  boxCenter,
  finishMindmapLayout,
  includeWaypoints,
  pruneEdgeAnchors,
  resetEdgeStyle,
  routeEdges,
  setEdgePoints,
  setEdgeShape,
} from './mindmapRouting';

/* Brytpunkter (docs/plans/mindmap-placering.md, del D). */

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});
const measure = (text: string) => text.length * 10;
const tree = (): MindmapDoc => ({ root: n('R', [n('A', [n('A1'), n('A2')]), n('B', [n('B1')]), n('C')]) });
const layout = (doc: MindmapDoc) => finishMindmapLayout(layoutMindmap(doc, measure), doc);
const last = (route: ReturnType<typeof routeEdge>) => route[route.length - 1];

describe('routeEdge genom punkter', () => {
  const start = { x: 0, y: 0 };
  const end = { x: 100, y: 100 };
  const points = [{ x: 50, y: -40 }];

  it('rak blir en bruten linje genom punkterna', () => {
    expect(routeToSvg(routeEdge({ start, startSide: 'right', end, endSide: 'left', shape: 'straight', points }))).toBe('M 0 0 L 50 -40 L 100 100');
  });

  it('vinklad går rätvinkligt: ut längs startsidan, in längs ändsidan', () => {
    expect(routeToSvg(routeEdge({ start, startSide: 'right', end, endSide: 'left', shape: 'elbow', points })))
      .toBe('M 0 0 L 50 0 L 50 -40 L 50 100 L 100 100');
    expect(routeToSvg(routeEdge({ start, startSide: 'bottom', end, endSide: 'top', shape: 'elbow', points })))
      .toBe('M 0 0 L 0 -40 L 50 -40 L 100 -40 L 100 100');
  });

  it('kurvan går genom varje punkt och börjar längs startsidan', () => {
    const route = routeEdge({ start, startSide: 'right', end, endSide: 'left', shape: 'curve', points });
    expect(route.map((c) => c.type)).toEqual(['M', 'C', 'C']);
    const first = route[1] as Extract<typeof route[number], { type: 'C' }>;
    expect({ x: first.x, y: first.y }).toEqual(points[0]);
    expect(first.c1y).toBe(0);
    expect(first.c1x).toBeGreaterThan(0);
    expect({ x: last(route).x, y: last(route).y }).toEqual(end);
  });

  it('utan punkter som förut', () => {
    const a = routeEdge({ start, startSide: 'right', end, endSide: 'left', shape: 'curve' });
    const b = routeEdge({ start, startSide: 'right', end, endSide: 'left', shape: 'curve', points: [] });
    expect(b).toEqual(a);
  });
});

describe('var en ny punkt hamnar', () => {
  it('mellan de ändar vars sträcka ligger närmast', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 200, y: 0 };
    const points = [{ x: 100, y: 100 }];
    expect(waypointInsertIndex(start, points, end, { x: 40, y: 45 })).toBe(0);
    expect(waypointInsertIndex(start, points, end, { x: 160, y: 45 })).toBe(1);
    expect(waypointInsertIndex(start, [], end, { x: 90, y: 3 })).toBe(0);
  });

  it('mitt på den längsta sträckan', () => {
    expect(longestSegmentMiddle({ x: 0, y: 0 }, [{ x: 10, y: 0 }], { x: 110, y: 0 })).toEqual({ index: 1, at: { x: 60, y: 0 } });
  });
});

describe('brytpunkter på en gren', () => {
  it('räknas från förälderns mitt och följer med när föräldern flyttas', () => {
    const doc = setEdgePoints(tree(), 'A1', [{ x: 30, y: -50 }]);
    const route = (d: MindmapDoc) => {
      const l = layout(d);
      const r = routeEdges(l, d).find((e) => e.toId === 'A1')!.route;
      const c = boxCenter(l.byId.get('A')!);
      const p = r.find((cmd) => cmd.type !== 'M')!;
      return { rel: { x: p.x - c.x, y: p.y - c.y } };
    };
    expect(route(doc).rel).toEqual({ x: 30, y: -50 });
    const moved = setOffset(doc, 'A', { dx: 80, dy: 40 }) as MindmapDoc;
    expect(route(moved).rel).toEqual({ x: 30, y: -50 });
  });

  it('kartans mått rymmer en punkt långt utanför', () => {
    const plain = layout(tree());
    const doc = setEdgePoints(tree(), 'A1', [{ x: 0, y: -900 }]);
    const l = layout(doc);
    expect(l.height).toBeGreaterThan(plain.height + 800);
    const a = l.byId.get('A')!;
    expect(boxCenter(a).y - 900).toBeGreaterThanOrEqual(12);
    expect(includeWaypoints(plain, tree())).toBe(plain);
  });

  it('en ny förälder tar bort punkterna, återställ också', () => {
    const doc = setEdgeShape(setEdgePoints(tree(), 'A1', [{ x: 1, y: 2 }]), 'A1', 'straight');
    const pruned = pruneEdgeAnchors(doc, moveNode(doc, 'A1', 'C') as MindmapDoc);
    expect(findNode(pruned.root, 'A1')!.edge).toEqual({ shape: 'straight' });
    expect(findNode(resetEdgeStyle(doc, 'A1').root, 'A1')!.edge).toBeUndefined();
    expect(findNode(setEdgePoints(doc, 'A1', []).root, 'A1')!.edge).toEqual({ shape: 'straight' });
  });

  it('tvätten behåller ändliga punkter avrundade, högst 20', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ x: i + 0.4, y: -i }));
    const clean = sanitizeMindmap({ root: { id: 'r', label: 'R', children: [
      { id: 'a', label: 'A', children: [], edge: { points: [{ x: 1.6, y: 2 }, { x: 'x', y: 1 }, null, { x: Infinity, y: 0 }] } },
      { id: 'b', label: 'B', children: [], edge: { points: many } },
      { id: 'c', label: 'C', children: [], edge: { points: [] } },
    ] } });
    expect(clean.root.children[0].edge).toEqual({ points: [{ x: 2, y: 2 }] });
    expect(clean.root.children[1].edge!.points).toHaveLength(20);
    expect('edge' in clean.root.children[2]).toBe(false);
  });
});

describe('brytpunkter på en tvärlänk', () => {
  const linked = () => {
    const result = addCrossLink(tree(), 'A1', 'C')!;
    return { doc: result.doc, id: result.id };
  };

  it('en böjd länk med punkter går som en kurva genom dem', () => {
    const { doc, id } = linked();
    const d = setCrossLinkPoints(doc, id, [{ x: 0, y: -80 }]);
    const l = layout(d);
    const [shape] = crossLinkGeometry(l, d);
    expect(shape.route).toBeDefined();
    const a = boxCenter(l.byId.get('A1')!);
    const c = boxCenter(l.byId.get('C')!);
    const through = shape.route!.find((cmd) => cmd.type === 'C')!;
    expect(through.x).toBeCloseTo((a.x + c.x) / 2, 6);
    expect(through.y).toBeCloseTo((a.y + c.y) / 2 - 80, 6);
  });

  it('byt riktning vänder punkterna, och tvätten behåller dem', () => {
    const { doc, id } = linked();
    const d = setCrossLinkPoints(doc, id, [{ x: 1, y: 1 }, { x: 2, y: 2 }]);
    expect(reverseCrossLink(d, id).crossLinks![0].points).toEqual([{ x: 2, y: 2 }, { x: 1, y: 1 }]);
    expect(sanitizeMindmapDoc(d).crossLinks![0].points).toEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
    expect(setCrossLinkPoints(d, id, null).crossLinks![0].points).toBeUndefined();
  });
});
