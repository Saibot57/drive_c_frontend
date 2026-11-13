import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import { layoutMindmap } from '@/utils/mindmap/mindmapLayout';
import { findNode } from '@/utils/mindmap/mindmapTree';
import { routeEdges } from './mindmapRouting';
import { placeNodes, previewDrag } from './mindmapPlacement';
import {
  applyToNodes,
  commonValue,
  edgesInRect,
  EMPTY_GROUP,
  mergeGroups,
  nodesInRect,
  rectBetween,
  removeNodes,
  segmentHitsRect,
  siblingIds,
  toggleCollapseNodes,
  toggleInGroup,
  topLevelIds,
  visibleGroup,
} from './mindmapSelection';

/* Markera flera (docs/plans/mindmap-arrangera.md, del A). */

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});
const measure = (text: string) => text.length * 10;

const doc = (): MindmapDoc => ({
  root: n('R', [n('A', [n('A1'), n('A2', [n('A2x')])]), n('B'), n('C', [n('C1')])]),
  layout: 'both',
});

describe('ramen', () => {
  it('rectBetween ger positiv bredd och höjd åt alla håll', () => {
    expect(rectBetween({ x: 10, y: 20 }, { x: 0, y: 5 })).toEqual({ x: 0, y: 5, width: 10, height: 15 });
  });

  it('segmentHitsRect: en sträcka rakt igenom rutan träffar utan ände inuti', () => {
    const r = { x: 0, y: 0, width: 10, height: 10 };
    expect(segmentHitsRect({ x: -5, y: 5 }, { x: 15, y: 5 }, r)).toBe(true);
    expect(segmentHitsRect({ x: -5, y: -5 }, { x: 15, y: -1 }, r)).toBe(false);
    expect(segmentHitsRect({ x: 5, y: 5 }, { x: 50, y: 50 }, r)).toBe(true);
  });

  it('nodesInRect tar noder som ramen bara nuddar', () => {
    const laid = layoutMindmap(doc(), measure);
    const b = laid.byId.get('B')!;
    const rect = { x: b.x + b.width - 2, y: b.y + b.height - 2, width: 30, height: 30 };
    expect(nodesInRect(laid, rect)).toEqual(['B']);
  });

  it('edgesInRect tar linjen som går genom ramen men inte noderna i ändarna', () => {
    const d = doc();
    const laid = layoutMindmap(d, measure);
    const routes = routeEdges(laid, d);
    const edge = laid.edges.find((e) => e.toId === 'B')!;
    const mid = { x: (edge.x1 + edge.x2) / 2, y: (edge.y1 + edge.y2) / 2 };
    const rect = { x: mid.x - 2, y: mid.y - 2, width: 4, height: 4 };
    expect(edgesInRect(routes, rect)).toContain('B');
    expect(nodesInRect(laid, rect)).toEqual([]);
  });
});

describe('markeringen', () => {
  it('toggleInGroup lägger till och tar bort', () => {
    const one = toggleInGroup(EMPTY_GROUP, 'node', 'A');
    expect(one).toEqual({ nodes: ['A'], edges: [] });
    expect(toggleInGroup(toggleInGroup(one, 'edge', 'B'), 'node', 'A')).toEqual({ nodes: [], edges: ['B'] });
  });

  it('mergeGroups utan dubbletter', () => {
    expect(mergeGroups({ nodes: ['A'], edges: ['B'] }, { nodes: ['A', 'C'], edges: ['B'] })).toEqual({ nodes: ['A', 'C'], edges: ['B'] });
  });

  it('visibleGroup släpper noder som inte syns och är samma objekt annars', () => {
    const d = doc();
    const laid = layoutMindmap({ ...d, root: { ...d.root, children: d.root.children.map((c) => (c.id === 'A' ? { ...c, collapsed: true } : c)) } }, measure);
    const routes = routeEdges(laid, d);
    expect(visibleGroup({ nodes: ['A1', 'B'], edges: ['A2', 'C1'] }, laid, routes)).toEqual({ nodes: ['B'], edges: ['C1'] });
    const same = { nodes: ['B'], edges: ['C1'] };
    expect(visibleGroup(same, laid, routes)).toBe(same);
  });

  it('siblingIds ger syskonen i trädets ordning; roten är ensam', () => {
    expect(siblingIds(doc(), 'B')).toEqual(['A', 'B', 'C']);
    expect(siblingIds(doc(), 'A2x')).toEqual(['A2x']);
    expect(siblingIds(doc(), 'R')).toEqual(['R']);
  });

  it('topLevelIds hoppar över noder under en annan markerad, men inte under roten', () => {
    expect(topLevelIds(doc(), ['A2x', 'A', 'C1'])).toEqual(['A', 'C1']);
    expect(topLevelIds(doc(), ['B', 'R'])).toEqual(['R', 'B']);
  });

  it('commonValue', () => {
    expect(commonValue([])).toBeUndefined();
    expect(commonValue(['a', 'a'])).toBe('a');
    expect(commonValue(['a', undefined])).toBe('mixed');
  });
});

describe('ändringar på flera', () => {
  it('applyToNodes ger samma dokument när inget ändras', () => {
    const d = doc();
    expect(applyToNodes(d, ['A', 'X'], () => null)).toBe(d);
  });

  it('removeNodes tar bort grenarna men aldrig roten eller grenvyns rot', () => {
    const result = removeNodes(doc(), ['A', 'A2', 'R', 'C'], 'C')!;
    expect(findNode(result.doc.root, 'A')).toBeNull();
    expect(findNode(result.doc.root, 'C')).not.toBeNull();
    expect(findNode(result.doc.root, result.focusId)).not.toBeNull();
    expect(removeNodes(doc(), ['R'])).toBeNull();
  });

  it('removeNodes tar bort tvärlänkar till de borttagna', () => {
    const d: MindmapDoc = { ...doc(), crossLinks: [{ id: 'l1', from: 'B', to: 'A2x' }] };
    expect(removeNodes(d, ['A'])!.doc.crossLinks ?? []).toEqual([]);
  });

  it('toggleCollapseNodes fäller ihop alla, och ut när alla redan är ihop', () => {
    const once = toggleCollapseNodes(doc(), ['A', 'B', 'C']);
    expect(findNode(once.root, 'A')!.collapsed).toBe(true);
    expect(findNode(once.root, 'C')!.collapsed).toBe(true);
    expect(findNode(once.root, 'B')!.collapsed).toBeUndefined();
    const twice = toggleCollapseNodes(once, ['A', 'C']);
    expect(findNode(twice.root, 'A')!.collapsed).toBeFalsy();
  });
});

describe('placeNodes', () => {
  it('flyttar varje gren en gång och roten ensam', () => {
    const moved = placeNodes(doc(), ['A', 'A2', 'B', 'R'], { dx: 10.4, dy: -5 });
    expect(findNode(moved.root, 'A')!.offset).toEqual({ dx: 10, dy: -5 });
    expect(findNode(moved.root, 'A2')!.offset).toBeUndefined();
    expect(findNode(moved.root, 'B')!.offset).toEqual({ dx: 10, dy: -5 });
    expect(moved.root.offset).toEqual({ dx: 10, dy: -5 });
  });

  it('lägger till på en befintlig förskjutning, och noll ändrar ingenting', () => {
    const d = placeNodes(doc(), ['B'], { dx: 5, dy: 5 });
    expect(findNode(placeNodes(d, ['B'], { dx: 1, dy: 2 }).root, 'B')!.offset).toEqual({ dx: 6, dy: 7 });
    expect(placeNodes(d, ['B'], { dx: 0.2, dy: 0 })).toBe(d);
  });

  it('previewDrag med grupp flyttar gruppen, utan grupp en nod', () => {
    const group = previewDrag(doc(), { id: 'A', dx: 3, dy: 4, alone: false, group: ['A', 'C'] });
    expect(findNode(group.root, 'C')!.offset).toEqual({ dx: 3, dy: 4 });
    const single = previewDrag(doc(), { id: 'A', dx: 3, dy: 4, alone: false });
    expect(findNode(single.root, 'C')!.offset).toBeUndefined();
  });
});
