import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import { layoutMindmap } from '@/utils/mindmap/mindmapLayout';
import { findNode, moveNode, sanitizeMindmap, setOffset } from '@/utils/mindmap/mindmapTree';
import { crossLinkGeometry, crossLinkPath } from './mindmapCrossLinks';
import { addCrossLink, reverseCrossLink, sanitizeMindmapDoc, setCrossLinkAnchor, setCrossLinkShape } from './mindmapDoc';
import { anchorPoint, anchorPointOut, nearestSideTo, routeEdge, routeEnds, routeMidpoint, routeToSvg } from './mindmapEdges';
import { pruneEdgeAnchors, resetEdgeStyle, routeEdges, setEdgeAnchor, setEdgeShape } from './mindmapRouting';

/*
 * Linjernas egna val (docs/plans/mindmap-placering.md, del C): en linje i
 * trädet med egen form och egna fästen, och tvärlänkarna med samma val.
 */

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});
const measure = (text: string) => text.length * 10;
const layout = (doc: MindmapDoc) => layoutMindmap(doc, measure);
const tree = (): MindmapDoc => ({ root: n('R', [n('A', [n('A1'), n('A2')]), n('B', [n('B1')]), n('C')]) });
const box = (x: number, y: number, width = 40, height = 20) => ({ x, y, width, height });

describe('geometrin för fästen och pilar', () => {
  it('anchorPointOut ligger utanför sidan', () => {
    expect(anchorPointOut(box(0, 0), 'top', 4)).toEqual({ x: 20, y: -4 });
    expect(anchorPointOut(box(0, 0), 'right', 4)).toEqual({ x: 44, y: 10 });
  });

  it('nearestSideTo räknar mot rutans mått', () => {
    const b = box(0, 0, 200, 20);
    expect(nearestSideTo(b, { x: 180, y: -30 })).toBe('top');
    expect(nearestSideTo(b, { x: 260, y: 15 })).toBe('right');
    expect(nearestSideTo(b, { x: -5, y: 10 })).toBe('left');
    expect(nearestSideTo(b, { x: 100, y: 40 })).toBe('bottom');
  });

  it('routeMidpoint och routeEnds', () => {
    const straight = routeEdge({ start: { x: 0, y: 0 }, startSide: 'right', end: { x: 100, y: 0 }, endSide: 'left', shape: 'straight' });
    expect(routeMidpoint(straight)).toEqual({ x: 50, y: 0 });
    const elbow = routeEdge({ start: { x: 0, y: 0 }, startSide: 'right', end: { x: 40, y: 100 }, endSide: 'left', shape: 'elbow' });
    expect(routeMidpoint(elbow)).toEqual({ x: 20, y: 50 });
    const ends = routeEnds(elbow);
    expect(ends.endFrom).toEqual({ x: 20, y: 100 });
    expect(ends.startFrom).toEqual({ x: 20, y: 0 });
  });
});

describe('en linje i trädet', () => {
  it('egen form vinner över kartans', () => {
    const doc = setEdgeShape(tree(), 'A1', 'straight');
    const routes = routeEdges(layout(doc), doc);
    expect(routes.find((e) => e.toId === 'A1')!.route.map((c) => c.type)).toEqual(['M', 'L']);
    expect(routes.find((e) => e.toId === 'A2')!.route.map((c) => c.type)).toEqual(['M', 'C']);
  });

  it('egna fästen, och fästet som inte valts följer kartan', () => {
    const doc = setEdgeAnchor(tree(), 'A1', 'from', 'bottom');
    const l = layout(doc);
    const a = l.byId.get('A')!;
    const a1 = l.byId.get('A1')!;
    const route = routeEdges(l, doc).find((e) => e.toId === 'A1')!.route;
    expect(route[0]).toEqual({ type: 'M', ...anchorPoint(a, 'bottom') });
    const last = route[route.length - 1];
    expect({ x: last.x, y: last.y }).toEqual(anchorPoint(a1, 'left'));
  });

  it('utan egna val ritas linjen som förut, också med rot i doc', () => {
    const doc = tree();
    const l = layout(doc);
    expect(routeEdges(l, doc).map((e) => routeToSvg(e.route))).toEqual(routeEdges(l, { lines: undefined }).map((e) => routeToSvg(e.route)));
  });

  it('setEdgeShape, setEdgeAnchor och resetEdgeStyle', () => {
    let doc = setEdgeShape(tree(), 'B1', 'elbow');
    doc = setEdgeAnchor(doc, 'B1', 'to', 'top');
    expect(findNode(doc.root, 'B1')!.edge).toEqual({ shape: 'elbow', to: 'top' });
    expect(setEdgeAnchor(doc, 'B1', 'to', 'top')).toBe(doc);
    doc = setEdgeShape(doc, 'B1', null);
    expect(findNode(doc.root, 'B1')!.edge).toEqual({ to: 'top' });
    doc = resetEdgeStyle(doc, 'B1');
    expect('edge' in findNode(doc.root, 'B1')!).toBe(false);
    expect(setEdgeShape(tree(), 'R', 'straight').root.edge).toBeUndefined();
  });

  it('en ny förälder tar bort fästena men behåller formen', () => {
    const doc = setEdgeAnchor(setEdgeShape(tree(), 'A1', 'straight'), 'A1', 'from', 'top');
    const moved = moveNode(doc, 'A1', 'C') as MindmapDoc;
    const pruned = pruneEdgeAnchors(doc, moved);
    expect(findNode(pruned.root, 'A1')!.edge).toEqual({ shape: 'straight' });
    // Samma förälder: inget ändras.
    const shifted = setOffset(doc, 'A1', { dx: 5, dy: 5 }) as MindmapDoc;
    expect(pruneEdgeAnchors(doc, shifted)).toBe(shifted);
  });

  it('tvätten behåller kända val och tar bort okända', () => {
    const clean = sanitizeMindmap({ root: { id: 'r', label: 'R', children: [
      { id: 'a', label: 'A', children: [], edge: { shape: 'elbow', from: 'top', to: 'sideways' } },
      { id: 'b', label: 'B', children: [], edge: { shape: 'zigzag' } },
      { id: 'c', label: 'C', children: [], edge: 'curve' },
    ] } });
    expect(clean.root.children[0].edge).toEqual({ shape: 'elbow', from: 'top' });
    expect('edge' in clean.root.children[1]).toBe(false);
    expect('edge' in clean.root.children[2]).toBe(false);
  });
});

describe('tvärlänkarnas val', () => {
  const linked = () => {
    const result = addCrossLink(tree(), 'A1', 'C')!;
    return { doc: result.doc, id: result.id };
  };

  it('en länk utan val ritas som förut', () => {
    const { doc } = linked();
    const [shape] = crossLinkGeometry(layout(doc), doc);
    expect(shape.route).toBeUndefined();
    expect(crossLinkPath(shape)).toMatch(/ Q /);
  });

  it('en länk med form följer samma linjer som grenarna, med pil i rätt riktning', () => {
    const { doc, id } = linked();
    const d = setCrossLinkShape(doc, id, 'elbow');
    const [shape] = crossLinkGeometry(layout(d), d);
    expect(shape.route).toBeDefined();
    expect(crossLinkPath(shape)).toBe(routeToSvg(shape.route!));
    expect(shape.heads).toHaveLength(1);
    expect(shape.heads[0][0]).toEqual(shape.end);
  });

  it('ett valt fäste flyttar änden, också på den böjda kurvan', () => {
    const { doc, id } = linked();
    const d = setCrossLinkAnchor(doc, id, 'from', 'bottom');
    const l = layout(d);
    const [shape] = crossLinkGeometry(l, d);
    expect(shape.start).toEqual(anchorPointOut(l.byId.get('A1')!, 'bottom', 4));
    expect(shape.route).toBeUndefined();
  });

  it('byt riktning tar med fästena, och tvätten behåller valen', () => {
    const { doc, id } = linked();
    const d = reverseCrossLink(setCrossLinkAnchor(setCrossLinkShape(doc, id, 'straight'), id, 'from', 'top'), id);
    expect(d.crossLinks![0]).toMatchObject({ from: 'C', to: 'A1', toAnchor: 'top', shape: 'straight' });
    expect(d.crossLinks![0].fromAnchor).toBeUndefined();
    const clean = sanitizeMindmapDoc({ ...d, crossLinks: [{ ...d.crossLinks![0], shape: 'zigzag', fromAnchor: 'up' }] });
    expect(clean.crossLinks![0]).toEqual({ id, from: 'C', to: 'A1', toAnchor: 'top' });
    expect(setCrossLinkShape(d, id, null).crossLinks![0].shape).toBeUndefined();
  });
});
