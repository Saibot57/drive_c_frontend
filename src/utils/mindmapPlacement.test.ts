import { describe, expect, it } from 'vitest';
import type { MindmapContent, MindmapNode } from '@/types/mindmap';
import { edgePath, layoutMindmap, MINDMAP_METRICS as M } from '@/utils/mindmap/mindmapLayout';
import {
  clearOffsets,
  findNode,
  hasOffsets,
  rootChildSides,
  setOffset,
} from '@/utils/mindmap/mindmapTree';
import { placeNode } from './mindmapPlacement';

/*
 * Fri placering (docs/plans/mindmap-sida.md, steg 5): förskjutningen i den
 * delade layouten, trädfunktionerna och vad ett släpp på tom yta ger.
 */

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});
const measure = (text: string) => text.length * 10;
const layout = (content: MindmapContent) => layoutMindmap(content, measure);

const tree = (extraA: Partial<MindmapNode> = {}): MindmapContent => ({
  root: n('R', [n('A', [n('A1'), n('A2', [n('A2x')])], extraA), n('B'), n('C')]),
});

/** Nodens plats räknad från roten, så att kartans marginal inte spelar in. */
const fromRoot = (content: MindmapContent, id: string) => {
  const l = layout(content);
  const root = l.byId.get(content.root.id)!;
  const node = l.byId.get(id)!;
  return { x: node.x - root.x, y: node.y - root.y };
};

describe('layoutMindmap med offset', () => {
  it('en karta utan offset blir exakt som förut', () => {
    const plain = layout(tree());
    const zero = layout(setOffset(setOffset(tree(), 'A', { dx: 5, dy: 5 }), 'A', null));
    expect(zero.nodes).toEqual(plain.nodes);
    expect(zero.edges).toEqual(plain.edges);
    expect(zero.width).toBe(plain.width);
    expect(zero.height).toBe(plain.height);
  });

  it('en nod med offset flyttar hela sin gren, syskonen rörs inte', () => {
    const before = tree();
    const after = tree({ offset: { dx: 40, dy: -25 } });
    ['A', 'A1', 'A2', 'A2x'].forEach((id) => {
      expect(fromRoot(after, id)).toEqual({ x: fromRoot(before, id).x + 40, y: fromRoot(before, id).y - 25 });
    });
    ['B', 'C'].forEach((id) => expect(fromRoot(after, id)).toEqual(fromRoot(before, id)));
  });

  it('förskjutningar läggs ihop nedåt i grenen', () => {
    const before = tree();
    const after = setOffset(tree({ offset: { dx: 40, dy: 0 } }), 'A2', { dx: 10, dy: 30 });
    expect(fromRoot(after, 'A1').x).toBe(fromRoot(before, 'A1').x + 40);
    expect(fromRoot(after, 'A2')).toEqual({ x: fromRoot(before, 'A2').x + 50, y: fromRoot(before, 'A2').y + 30 });
    expect(fromRoot(after, 'A2x')).toEqual({ x: fromRoot(before, 'A2x').x + 50, y: fromRoot(before, 'A2x').y + 30 });
  });

  it('kanterna går till den förskjutna platsen', () => {
    const l = layout(tree({ offset: { dx: 40, dy: -25 } }));
    const a = l.byId.get('A')!;
    const root = l.byId.get('R')!;
    const toA = l.edges.find((e) => e.toId === 'A')!;
    expect(toA.x1).toBe(root.x + root.width);
    expect(toA.y1).toBe(root.y + root.height / 2);
    expect(toA.x2).toBe(a.x);
    expect(toA.y2).toBe(a.y + a.height / 2);
    // Kanten inne i den flyttade grenen flyttar med i båda ändar.
    const a1 = l.byId.get('A1')!;
    const toA1 = l.edges.find((e) => e.toId === 'A1')!;
    expect(toA1.x1).toBe(a.x + a.width);
    expect(toA1.x2).toBe(a1.x);
    expect(edgePath(toA1)).toContain(`M ${toA1.x1} ${toA1.y1}`);
  });

  it('kartans mått rymmer en nod som flyttats utåt, och marginalen står kvar', () => {
    const plain = layout(tree());
    const moved = layout(setOffset(tree(), 'C', { dx: 300, dy: 200 }));
    // C är kort och står närmast roten; flyttad 300 px når den förbi A2x.
    expect(moved.width).toBeGreaterThan(plain.width);
    expect(moved.width).toBe(Math.ceil(Math.max(...moved.nodes.map((node) => node.x + node.width)) + M.margin));
    expect(moved.height).toBeGreaterThan(plain.height);
    expect(moved.height).toBe(Math.ceil(Math.max(...moved.nodes.map((node) => node.y + node.height)) + M.margin));
    expect(Math.min(...moved.nodes.map((node) => node.x))).toBe(M.margin);
    expect(Math.min(...moved.nodes.map((node) => node.y))).toBe(M.margin);
  });

  it('rotens offset räknas inte, och en hopfälld gren flyttar bara sin synliga nod', () => {
    const rooted: MindmapContent = { root: n('R', [n('A')], { offset: { dx: 99, dy: 99 } }) };
    expect(layout(rooted).nodes).toEqual(layout({ root: n('R', [n('A')]) }).nodes);
    const collapsed: MindmapContent = {
      root: n('R', [n('A', [n('A1', [], { offset: { dx: 500, dy: 500 } })], { collapsed: true }), n('B')]),
    };
    expect(layout(collapsed).byId.has('A1')).toBe(false);
    expect(layout(collapsed).width).toBe(layout({ root: n('R', [n('A', [n('A1')], { collapsed: true }), n('B')]) }).width);
  });
});

describe('setOffset, hasOffsets och clearOffsets', () => {
  it('sätter och tar bort en förskjutning', () => {
    const moved = setOffset(tree(), 'A2', { dx: 12, dy: -3 });
    expect(findNode(moved.root, 'A2')!.offset).toEqual({ dx: 12, dy: -3 });
    expect(hasOffsets(moved)).toBe(true);
    const back = setOffset(moved, 'A2', null);
    expect(Object.keys(findNode(back.root, 'A2')!)).not.toContain('offset');
    expect(hasOffsets(back)).toBe(false);
  });

  it('noll och ogiltiga tal räknas som ingen förskjutning', () => {
    const before = tree();
    expect(setOffset(before, 'A', { dx: 0, dy: 0 }).root).toBe(before.root);
    expect(setOffset(before, 'A', { dx: Number.NaN, dy: 4 }).root).toBe(before.root);
    expect(findNode(setOffset(setOffset(before, 'A', { dx: 1, dy: 1 }), 'A', { dx: 0, dy: 0 }).root, 'A')!.offset).toBeUndefined();
  });

  it('roten går inte att förskjuta', () => {
    const before = tree();
    expect(setOffset(before, 'R', { dx: 10, dy: 10 })).toBe(before);
  });

  it('clearOffsets tar bort alla, också i hopfällda grenar, och lämnar resten', () => {
    const moved = setOffset(setOffset(tree({ collapsed: true, color: 'green' }), 'A2x', { dx: 1, dy: 2 }), 'B', { dx: 3, dy: 4 });
    const cleared = clearOffsets(moved);
    expect(hasOffsets(cleared)).toBe(false);
    expect(findNode(cleared.root, 'A')!.color).toBe('green');
    expect(findNode(cleared.root, 'A')!.collapsed).toBe(true);
    // En gren utan förskjutningar är samma objekt som förut.
    expect(findNode(cleared.root, 'C')).toBe(findNode(moved.root, 'C'));
  });

  it('clearOffsets på en karta utan förskjutningar ger samma karta', () => {
    const before = tree();
    expect(clearOffsets(before)).toBe(before);
  });
});

describe('placeNode', () => {
  it('flyttar noden så långt som den drogs, avrundat', () => {
    const placed = placeNode(tree(), 'A2', { dx: 30.4, dy: -12.6 }, layout)!;
    expect(findNode(placed.root, 'A2')!.offset).toEqual({ dx: 30, dy: -13 });
  });

  it('lägger ett nytt drag ovanpå den förskjutning som fanns', () => {
    const once = placeNode(tree(), 'B', { dx: 20, dy: 10 }, layout)!;
    const twice = placeNode(once, 'B', { dx: -5, dy: 15 }, layout)!;
    expect(findNode(twice.root, 'B')!.offset).toEqual({ dx: 15, dy: 25 });
  });

  it('ett drag tillbaka till ursprunget tar bort förskjutningen', () => {
    const once = placeNode(tree(), 'B', { dx: 20, dy: 10 }, layout)!;
    const back = placeNode(once, 'B', { dx: -20, dy: -10 }, layout)!;
    expect(findNode(back.root, 'B')!.offset).toBeUndefined();
  });

  it('roten och en nod som inte finns går inte att placera', () => {
    expect(placeNode(tree(), 'R', { dx: 10, dy: 10 }, layout)).toBeNull();
    expect(placeNode(tree(), 'finns-inte', { dx: 10, dy: 10 }, layout)).toBeNull();
  });

  it('i layouten right finns ingen gräns vid roten', () => {
    const placed = placeNode(tree(), 'A', { dx: -2000, dy: 0 }, layout)!;
    expect(findNode(placed.root, 'A')!.offset).toEqual({ dx: -2000, dy: 0 });
    expect(findNode(placed.root, 'A')!.side).toBeUndefined();
  });

  describe('i layouten both', () => {
    const both = (): MindmapContent => ({
      layout: 'both',
      root: n('R', [n('A', [n('A1')], { side: 'right' }), n('B', [], { side: 'left' }), n('C')]),
    });

    it('en gren under roten som dras över roten byter sida och hamnar där den släpptes', () => {
      const before = fromRoot(both(), 'A');
      const placed = placeNode(both(), 'A', { dx: -400, dy: 30 }, layout)!;
      expect(findNode(placed.root, 'A')!.side).toBe('left');
      const after = fromRoot(placed, 'A');
      expect(after.x).toBe(before.x - 400);
      expect(after.y).toBe(before.y + 30);
    });

    it('syskonen står kvar på sin sida när en gren byter sida', () => {
      const content = both();
      const sidesBefore = rootChildSides(content);
      const placed = placeNode(content, 'A', { dx: -400, dy: 0 }, layout)!;
      const sidesAfter = rootChildSides(placed);
      expect(sidesAfter.get('B')).toBe(sidesBefore.get('B'));
      expect(sidesAfter.get('C')).toBe(sidesBefore.get('C'));
      // C hade ingen sparad sida; den sparas, så att den inte räknas om.
      expect(findNode(placed.root, 'C')!.side).toBe(sidesBefore.get('C'));
    });

    it('ett drag som stannar på samma sida ändrar inte sidan', () => {
      const placed = placeNode(both(), 'A', { dx: 50, dy: 80 }, layout)!;
      expect(findNode(placed.root, 'A')!.side).toBe('right');
      expect(findNode(placed.root, 'A')!.offset).toEqual({ dx: 50, dy: 80 });
    });

    it('en djupare nod stannar vid rotens mitt i stället för att korsa den', () => {
      const placed = placeNode(both(), 'A1', { dx: -2000, dy: 10 }, layout)!;
      expect(findNode(placed.root, 'A')!.side).toBe('right');
      const l = layout(placed);
      const root = l.byId.get('R')!;
      const a1 = l.byId.get('A1')!;
      expect(a1.x + a1.width / 2).toBeCloseTo(root.x + root.width / 2, 0);
      expect(findNode(placed.root, 'A1')!.offset!.dy).toBe(10);
    });

    it('en gren på vänster sida kan dras till höger', () => {
      const placed = placeNode(both(), 'B', { dx: 500, dy: 0 }, layout)!;
      expect(findNode(placed.root, 'B')!.side).toBe('right');
      expect(fromRoot(placed, 'B').x).toBe(fromRoot(both(), 'B').x + 500);
    });
  });
});
