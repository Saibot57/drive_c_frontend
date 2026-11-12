import { describe, expect, it } from 'vitest';
import type { MindmapContent, MindmapNode } from '@/types/mindmap';
import { layoutMindmap } from '@/utils/mindmap/mindmapLayout';
import { clearOffsets, findNode, hasOffsets, setOffset } from '@/utils/mindmap/mindmapTree';
import {
  clearBranchOffsets,
  hasPlacement,
  placeNode,
  placeNodeAlone,
  placeRoot,
  previewMove,
  setRootOffset,
  snapDelta,
} from './mindmapPlacement';
import { placeRootInLayout, rootOrigin } from './mindmapRouting';

/*
 * Friare placering (docs/plans/mindmap-placering.md, del B): Alt+dra, roten,
 * rutnätet och städningen. Lägena mäts i sidans layout, med rotens
 * förskjutning, och räknas från rotens automatiska mitt.
 */

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});
const measure = (text: string) => text.length * 10;
const layout = (content: MindmapContent) => placeRootInLayout(layoutMindmap(content, measure), content);

/** Nodens övre vänstra hörn från rotens automatiska mitt. */
const at = (content: MindmapContent, id: string) => {
  const l = layout(content);
  const origin = rootOrigin(l, content);
  const node = l.byId.get(id)!;
  return { x: node.x - origin.x, y: node.y - origin.y };
};

const tree = (): MindmapContent => ({
  layout: 'both',
  root: n('R', [n('A', [n('A1'), n('A2', [n('A2x')])], { side: 'right' }), n('B', [], { side: 'right' }), n('C', [], { side: 'left' })]),
});

describe('placeNodeAlone', () => {
  it('flyttar noden, och barnen och deras grenar står kvar på pixeln', () => {
    const before = tree();
    const after = placeNodeAlone(before, 'A', { dx: 50, dy: -30 })!;
    expect(at(after, 'A')).toEqual({ x: at(before, 'A').x + 50, y: at(before, 'A').y - 30 });
    ['A1', 'A2', 'A2x', 'B', 'C'].forEach((id) => expect(at(after, id)).toEqual(at(before, id)));
  });

  it('lägger till på befintliga förskjutningar och tar bort en som blir noll', () => {
    const start = setOffset(setOffset(tree(), 'A', { dx: 10, dy: 0 }), 'A1', { dx: 20, dy: 5 });
    const after = placeNodeAlone(start, 'A', { dx: 20, dy: 5 })!;
    expect(findNode(after.root, 'A')!.offset).toEqual({ dx: 30, dy: 5 });
    expect(findNode(after.root, 'A1')!.offset).toBeUndefined();
    expect(findNode(after.root, 'A2')!.offset).toEqual({ dx: -20, dy: -5 });
  });

  it('byter inte sida och vägrar roten', () => {
    const after = placeNodeAlone(tree(), 'A', { dx: -900, dy: 0 })!;
    expect(findNode(after.root, 'A')!.side).toBe('right');
    expect(placeNodeAlone(tree(), 'R', { dx: 5, dy: 5 })).toBeNull();
    expect(placeNodeAlone(tree(), 'X', { dx: 5, dy: 5 })).toBeNull();
  });
});

describe('roten', () => {
  it('flyttas ensam; grenarna står kvar', () => {
    const before = tree();
    const after = placeRoot(before, { dx: 120.4, dy: -60 });
    expect(after.root.offset).toEqual({ dx: 120, dy: -60 });
    expect(at(after, 'R')).toEqual({ x: at(before, 'R').x + 120, y: at(before, 'R').y - 60 });
    ['A', 'A1', 'A2x', 'B', 'C'].forEach((id) => expect(at(after, id)).toEqual(at(before, id)));
  });

  it('linjerna från roten följer med, och måtten rymmer roten', () => {
    const before = tree();
    const after = placeRoot(before, { dx: 0, dy: -400 });
    const l = layout(after);
    const r = l.byId.get('R')!;
    expect(r.y).toBe(12);
    expect(l.height).toBeGreaterThan(layout(before).height + 300);
    l.edges.filter((e) => e.fromId === 'R').forEach((e) => expect(e.y1).toBeCloseTo(r.y + r.height / 2, 6));
  });

  it('utan förskjutning är layouten densamma', () => {
    const plain = layoutMindmap(tree(), measure);
    expect(placeRootInLayout(plain, tree())).toBe(plain);
    expect(setRootOffset(tree(), { dx: 0, dy: 0 }).root.offset).toBeUndefined();
    expect(placeRoot(placeRoot(tree(), { dx: 5, dy: 0 }), { dx: -5, dy: 0 }).root.offset).toBeUndefined();
  });

  it('hela kartans städning tar också bort rotens förskjutning', () => {
    const moved = placeRoot(tree(), { dx: 5, dy: 5 });
    expect(hasPlacement(moved)).toBe(true);
    expect(hasPlacement(tree())).toBe(false);
    expect(clearOffsets(moved).root.offset).toBeUndefined();
  });
});

describe('sidbytet med en flyttad rot', () => {
  it('en gren som redan står på andra sidan om roten byter inte sida', () => {
    // Roten långt åt höger: B står nu till vänster om den, fast sidan är höger.
    const moved = placeRoot(tree(), { dx: 600, dy: 0 });
    const next = placeNode(moved, 'B', { dx: -10, dy: 0 }, layout)!;
    expect(findNode(next.root, 'B')!.side).toBe('right');
    expect(at(next, 'B').x).toBe(at(moved, 'B').x - 10);
  });

  it('en gren som dras över rotens mitt byter sida som förut', () => {
    const next = placeNode(tree(), 'B', { dx: -400, dy: 0 }, layout)!;
    expect(findNode(next.root, 'B')!.side).toBe('left');
  });
});

describe('previewMove', () => {
  it('följer samma regler som släppet', () => {
    const d = { dx: 40, dy: 10 };
    expect(previewMove(tree(), 'R', d, false)).toEqual(placeRoot(tree(), d));
    expect(previewMove(tree(), 'A', d, true)).toEqual(placeNodeAlone(tree(), 'A', d));
    expect(findNode(previewMove(tree(), 'A', d, false).root, 'A')!.offset).toEqual(d);
  });
});

describe('snapDelta', () => {
  it('lägger hörnet på rutnätet', () => {
    expect(snapDelta({ x: 13, y: -7 }, { dx: 30, dy: 2 })).toEqual({ dx: 27, dy: 7 });
    expect(snapDelta({ x: 0, y: 0 }, { dx: 9, dy: 11 }, 20)).toEqual({ dx: 0, dy: 20 });
  });
});

describe('clearBranchOffsets', () => {
  it('tar bort förskjutningarna i grenen och lämnar resten', () => {
    let c = setOffset(tree(), 'A', { dx: 5, dy: 5 });
    c = setOffset(c, 'A2x', { dx: 1, dy: 1 });
    c = setOffset(c, 'B', { dx: 2, dy: 2 });
    const next = clearBranchOffsets(c, 'A');
    expect(findNode(next.root, 'A')!.offset).toBeUndefined();
    expect(findNode(next.root, 'A2x')!.offset).toBeUndefined();
    expect(findNode(next.root, 'B')!.offset).toEqual({ dx: 2, dy: 2 });
  });

  it('ger samma dokument när inget finns att städa, och städar från roten', () => {
    const c = tree();
    expect(clearBranchOffsets(c, 'A')).toBe(c);
    const moved = setOffset(placeRoot(c, { dx: 3, dy: 3 }), 'C', { dx: 1, dy: 0 });
    expect(hasPlacement(clearBranchOffsets(moved, 'R'))).toBe(false);
  });
});
