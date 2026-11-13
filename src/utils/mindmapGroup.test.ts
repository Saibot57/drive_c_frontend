import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import { findNode } from '@/utils/mindmap/mindmapTree';
import { groupActionFor, groupEdgeAction, groupNodeAction } from './mindmapGroup';

/* Handlingar på flera markerade (docs/plans/mindmap-arrangera.md, del A). */

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});

const doc = (): MindmapDoc => ({
  root: n('R', [
    n('A', [n('A1', [], { offset: { dx: 4, dy: 4 } })], { offset: { dx: 10, dy: 0 } }),
    n('B', [], { offset: { dx: 0, dy: 9 } }),
    n('C', [n('C1')]),
  ], { offset: { dx: 3, dy: 3 } }),
});

describe('groupNodeAction', () => {
  it('färg och ikon på alla', () => {
    const painted = groupNodeAction(doc(), ['A', 'B'], { type: 'paint', choice: { color: 'green' }, wholeBranch: false })!.doc;
    expect(findNode(painted.root, 'A')!.color).toBe('green');
    expect(findNode(painted.root, 'B')!.color).toBe('green');
    expect(findNode(painted.root, 'C')!.color).toBeUndefined();
    const iconed = groupNodeAction(doc(), ['A', 'C'], { type: 'icon', icon: 'star' })!.doc;
    expect(findNode(iconed.root, 'C')!.icon).toBe('star');
  });

  it('färg på hela grenarna', () => {
    const painted = groupNodeAction(doc(), ['A', 'C'], { type: 'paint', choice: { color: 'blue' }, wholeBranch: true })!.doc;
    expect(findNode(painted.root, 'C1')!.color).toBe('blue');
  });

  it('städa upp tar bort förskjutningar i de markerade grenarna, inte i andra', () => {
    const tidy = groupNodeAction(doc(), ['A'], { type: 'tidy' })!.doc;
    expect(findNode(tidy.root, 'A')!.offset).toBeUndefined();
    expect(findNode(tidy.root, 'A1')!.offset).toBeUndefined();
    expect(findNode(tidy.root, 'B')!.offset).toEqual({ dx: 0, dy: 9 });
  });

  it('nollställ bara nodernas egna förskjutningar, också rotens', () => {
    const reset = groupNodeAction(doc(), ['A', 'R'], { type: 'resetOffset' })!.doc;
    expect(findNode(reset.root, 'A')!.offset).toBeUndefined();
    expect(findNode(reset.root, 'A1')!.offset).toEqual({ dx: 4, dy: 4 });
    expect(reset.root.offset).toBeUndefined();
  });

  it('ta bort och fälla ihop', () => {
    const removed = groupNodeAction(doc(), ['A', 'B'], { type: 'remove' })!;
    expect(removed.doc.root.children.map((c) => c.id)).toEqual(['C']);
    expect(removed.focusId).toBeDefined();
    const folded = groupNodeAction(doc(), ['A', 'C'], { type: 'toggleCollapse' })!.doc;
    expect(findNode(folded.root, 'A')!.collapsed).toBe(true);
  });

  it('ger null när inget ändras', () => {
    expect(groupNodeAction(doc(), ['C1'], { type: 'tidy' })).toBeNull();
  });
});

describe('groupEdgeAction', () => {
  it('form, fäste och återställ på alla markerade linjer', () => {
    const shaped = groupEdgeAction(doc(), ['A', 'B'], { type: 'shape', shape: 'straight' })!;
    expect(findNode(shaped.root, 'A')!.edge).toEqual({ shape: 'straight' });
    expect(findNode(shaped.root, 'B')!.edge).toEqual({ shape: 'straight' });
    const anchored = groupEdgeAction(shaped, ['A'], { type: 'anchor', end: 'to', side: 'top' })!;
    expect(findNode(anchored.root, 'A')!.edge).toEqual({ shape: 'straight', to: 'top' });
    const reset = groupEdgeAction(anchored, ['A', 'B'], { type: 'reset' })!;
    expect(findNode(reset.root, 'A')!.edge).toBeUndefined();
    expect(groupEdgeAction(reset, ['A'], { type: 'reset' })).toBeNull();
  });
});

describe('groupActionFor', () => {
  it('färg, ta bort och fäll ihop gäller gruppen; resten inte', () => {
    expect(groupActionFor({ type: 'color', color: 'pink' })).toEqual({ type: 'paint', choice: { color: 'pink' }, wholeBranch: false });
    expect(groupActionFor({ type: 'color', color: null })).toEqual({ type: 'paint', choice: null, wholeBranch: false });
    expect(groupActionFor({ type: 'remove' })).toEqual({ type: 'remove' });
    expect(groupActionFor({ type: 'toggleCollapse' })).toEqual({ type: 'toggleCollapse' });
    expect(groupActionFor({ type: 'addChild' })).toBeNull();
  });
});
