import { describe, expect, it } from 'vitest';
import type { MindmapContent, MindmapNode } from '@/types/mindmap';
import { layoutMindmap, type MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { clearOffsets, findNode } from '@/utils/mindmap/mindmapTree';
import { finishMindmapLayout } from './mindmapRouting';
import { clearBranchOffsets, setRootOffset } from './mindmapPlacement';
import { hasDirections, tidyAll, tidyBranch } from './mindmapTidy';

/* Städa upp efter riktningen (docs/plans/mindmap-arrangera.md, del C). */

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});
const measure = (text: string) => text.length * 10;
const layoutOf = (content: MindmapContent) => finishMindmapLayout(layoutMindmap(content, measure), content);
const center = (l: MindmapLayoutResult, id: string) => {
  const b = l.byId.get(id)!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

/** Tobias bild: Rut dragen till vänster om roten, s ännu längre ut, s med barn. */
const picture = (): MindmapContent => ({
  root: n('T', [
    n('Rut', [n('s', [n('s1', [], { offset: { dx: 10, dy: 30 } }), n('s2', [n('s2a')])], { offset: { dx: -260, dy: -40 } })], { offset: { dx: -330, dy: -60 } }),
    n('Pim', [n('p1', [], { offset: { dx: 5, dy: 5 } })]),
  ]),
  layout: 'right',
});

describe('tidyBranch', () => {
  it('en karta utan riktningar och utan noder på fel sida städas som förut', () => {
    const content = picture();
    expect(tidyBranch(content, 'Pim', layoutOf)).toEqual(clearBranchOffsets(content, 'Pim'));
    const plain: MindmapContent = { root: n('R', [n('A', [n('A1', [], { offset: { dx: 3, dy: 4 } })], { offset: { dx: 9, dy: 9 } })]) };
    expect(tidyAll(plain, layoutOf)).toEqual(setRootOffset(clearOffsets(plain), null));
  });

  it('Tobias bild: städa s:s gren ställer s och allt under bort från roten, aldrig inåt', () => {
    const tidy = tidyBranch(picture(), 's', layoutOf);
    expect(findNode(tidy.root, 's')!.offset).toBeUndefined();
    expect(findNode(tidy.root, 's')!.dir).toEqual({ side: 'left' });
    expect(findNode(tidy.root, 's1')!.dir).toEqual({ side: 'left' });
    expect(findNode(tidy.root, 's2a')!.dir).toEqual({ side: 'left' });
    const l = layoutOf(tidy);
    expect(center(l, 's').x).toBeLessThan(center(l, 'Rut').x);
    expect(center(l, 's1').x).toBeLessThan(center(l, 's').x);
    expect(center(l, 's2a').x).toBeLessThan(center(l, 's2').x);
    // Rut står kvar där den drogs.
    expect(findNode(tidy.root, 'Rut')!.offset).toEqual({ dx: -330, dy: -60 });
  });

  it('en nod med vald riktning får barnen i en solfjäder åt den', () => {
    const content: MindmapContent = { root: n('R', [n('A', [
      n('a', [], { offset: { dx: 40, dy: 0 } }), n('b'), n('c', [], { dir: { side: 'left' } }),
    ], { childDir: { angle: 270 } })]) };
    const tidy = tidyBranch(content, 'A', layoutOf);
    const dirs = ['a', 'b', 'c'].map((id) => findNode(tidy.root, id)!.dir as { angle: number; base: number });
    expect(dirs.map((d) => d.base)).toEqual([270, 270, 270]);
    expect(dirs[1].angle).toBe(270);
    expect(dirs[0].angle).toBeLessThan(270);
    expect(dirs[2].angle).toBeGreaterThan(270);
    expect(findNode(tidy.root, 'a')!.offset).toBeUndefined();
    const l = layoutOf(tidy);
    expect(center(l, 'b').y).toBeLessThan(center(l, 'A').y);
  });

  it('en solfjäder utan vald riktning läggs om, med de dragna tillbaka i den', () => {
    const content: MindmapContent = { root: n('R', [n('A', [
      n('a', [], { dir: { angle: 340, base: 0, r: 90 } }),
      n('b', [], { dir: { angle: 20, base: 0 }, offset: { dx: 60, dy: 60 } }),
    ])]) };
    const tidy = tidyBranch(content, 'A', layoutOf);
    const a = findNode(tidy.root, 'a')!.dir as { angle: number; base: number };
    const b = findNode(tidy.root, 'b')!.dir as { angle: number; base: number };
    expect(a.base).toBe(0);
    expect(((a.angle + 180) % 360) - 180).toBeCloseTo(-(((b.angle + 180) % 360) - 180));
    expect(findNode(tidy.root, 'b')!.offset).toBeUndefined();
  });

  it('en sida från förra städningen räknas om: hela kartan sätter s tillbaka på layoutens sida', () => {
    const once = tidyBranch(picture(), 's', layoutOf);
    const all = tidyAll(once, layoutOf);
    expect(findNode(all.root, 's')!.dir).toBeUndefined();
    expect(findNode(all.root, 's1')!.dir).toBeUndefined();
    const l = layoutOf(all);
    expect(center(l, 's').x).toBeGreaterThan(center(l, 'Rut').x);
  });

  it('roten städar hela kartan, också rotens förskjutning', () => {
    const content = setRootOffset(picture(), { dx: 50, dy: 0 });
    const tidy = tidyBranch(content, 'T', layoutOf);
    expect(tidy.root.offset).toBeUndefined();
    expect(findNode(tidy.root, 'Rut')!.offset).toBeUndefined();
    expect(findNode(tidy.root, 'p1')!.offset).toBeUndefined();
  });

  it('hasDirections', () => {
    expect(hasDirections(picture().root)).toBe(false);
    expect(hasDirections(n('R', [n('A', [], { childDir: { angle: 1 } })]))).toBe(true);
  });
});
