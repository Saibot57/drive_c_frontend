import { describe, expect, it } from 'vitest';
import type { MindmapContent, MindmapNode } from '@/types/mindmap';
import { layoutMindmap, MINDMAP_METRICS as M, type MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { findNode } from '@/utils/mindmap/mindmapTree';
import { finishMindmapLayout } from './mindmapRouting';
import { areaSlots, arrange } from './mindmapArrange';

/* Arrangera de markerade (docs/plans/mindmap-arrangera.md, del D). */

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});
const measure = (text: string) => text.length * 10;
const layoutOf = (content: MindmapContent) => finishMindmapLayout(layoutMindmap(content, measure), content);
const center = (l: MindmapLayoutResult, id: string) => {
  const b = l.byId.get(id)!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const rel = (l: MindmapLayoutResult, id: string, from: string) => {
  const a = center(l, id);
  const b = center(l, from);
  return { x: a.x - b.x, y: a.y - b.y };
};

/** Fyra på nivå 1, utspridda för hand som på Tobias bild. */
const four = (): MindmapContent => ({
  root: n('T', [
    n('Rut', [n('s')], { offset: { dx: -330, dy: -60 } }),
    n('Siv', [], { offset: { dx: -330, dy: 60 } }),
    n('Pim', [], { offset: { dx: 40, dy: -60 } }),
    n('Kaj', [], { offset: { dx: 40, dy: 60 } }),
  ]),
  layout: 'right',
});
const ids = ['Rut', 'Siv', 'Pim', 'Kaj'];
const run = (pattern: Parameters<typeof arrange>[2], content = four(), which = ids, area = null as Parameters<typeof arrange>[4]) =>
  layoutOf(arrange(content, which, pattern, layoutOf(content), area));

const noOverlap = (l: MindmapLayoutResult, list: string[]) => {
  list.forEach((a, i) => list.slice(i + 1).forEach((b) => {
    const p = l.byId.get(a)!;
    const q = l.byId.get(b)!;
    const apart = p.x + p.width <= q.x + 0.5 || q.x + q.width <= p.x + 0.5 || p.y + p.height <= q.y + 0.5 || q.y + q.height <= p.y + 0.5;
    expect(apart, `${a} och ${b}`).toBe(true);
  }));
};

describe('arrange', () => {
  it('a) hörn: var och en i det hörn den står närmast, och grenen följer med', () => {
    const l = run('corners');
    expect(rel(l, 'Rut', 'T').x).toBeLessThan(0);
    expect(rel(l, 'Rut', 'T').y).toBeLessThan(0);
    expect(rel(l, 'Siv', 'T').x).toBeLessThan(0);
    expect(rel(l, 'Siv', 'T').y).toBeGreaterThan(0);
    expect(rel(l, 'Pim', 'T').x).toBeGreaterThan(0);
    expect(rel(l, 'Pim', 'T').y).toBeLessThan(0);
    expect(rel(l, 'Kaj', 'T').x).toBeGreaterThan(0);
    expect(rel(l, 'Kaj', 'T').y).toBeGreaterThan(0);
    // Symmetriskt: Rut och Kaj lika långt från roten i höjdled.
    expect(rel(l, 'Rut', 'T').y).toBeCloseTo(-rel(l, 'Kaj', 'T').y, 0);
    // s följer med Rut.
    const before = layoutOf(four());
    expect(rel(l, 's', 'Rut').x).toBeCloseTo(rel(before, 's', 'Rut').x, 0);
    noOverlap(l, ['T', ...ids]);
  });

  it('a) hörn med sex: 2+1+2+1, utan överlapp', () => {
    const content: MindmapContent = { root: n('R', ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => n(id))) };
    const l = run('corners', content, ['a', 'b', 'c', 'd', 'e', 'f']);
    const quadrant = (id: string) => `${rel(l, id, 'R').x < 0 ? 'v' : 'h'}${rel(l, id, 'R').y < 0 ? 'u' : 'n'}`;
    const counts = ['a', 'b', 'c', 'd', 'e', 'f'].reduce<Record<string, number>>((acc, id) => ({ ...acc, [quadrant(id)]: (acc[quadrant(id)] ?? 0) + 1 }), {});
    expect(Object.values(counts).sort()).toEqual([1, 1, 2, 2]);
    noOverlap(l, ['R', 'a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('b) cirkel: lika långt mellan grannarna, och var och en nära där den stod', () => {
    const l = run('circle');
    const angles = ids.map((id) => Math.atan2(rel(l, id, 'T').y, rel(l, id, 'T').x) * 180 / Math.PI);
    const sorted = [...angles].sort((a, b) => a - b);
    sorted.slice(1).forEach((a, i) => expect(a - sorted[i]).toBeCloseTo(90, 0));
    // Rut stod uppe till vänster och hamnar på vänster eller övre platsen.
    expect(rel(l, 'Rut', 'T').x <= 1 && rel(l, 'Rut', 'T').y <= 1).toBe(true);
    noOverlap(l, ['T', ...ids]);
  });

  it('c) två sidor: två till vänster och två till höger, i ordning uppifrån', () => {
    const l = run('sides');
    expect(rel(l, 'Rut', 'T').x).toBeLessThan(0);
    expect(rel(l, 'Siv', 'T').x).toBeLessThan(0);
    expect(rel(l, 'Pim', 'T').x).toBeGreaterThan(0);
    expect(rel(l, 'Rut', 'T').y).toBeLessThan(rel(l, 'Siv', 'T').y);
    expect(rel(l, 'Pim', 'T').y).toBeLessThan(rel(l, 'Kaj', 'T').y);
    noOverlap(l, ['T', ...ids]);
  });

  it('c) två sidor jämnar ut: tre till vänster blir två och två', () => {
    const content = four();
    const moved = { ...content, root: { ...content.root, children: content.root.children.map((c) => (c.id === 'Pim' ? { ...c, offset: { dx: -200, dy: -150 } } : c)) } };
    const l = run('sides', moved);
    const lefts = ids.filter((id) => rel(l, id, 'T').x < 0);
    expect(lefts).toHaveLength(2);
  });

  it('d) en sida: alla till höger i en kolumn, alla ovanför i en rad', () => {
    const r = run('right');
    ids.forEach((id) => expect(rel(r, id, 'T').x).toBeGreaterThan(0));
    noOverlap(r, ['T', ...ids]);
    const up = run('above');
    ids.forEach((id) => expect(rel(up, id, 'T').y).toBeLessThan(0));
    // Ordningen efter var de står nu: vänster till höger.
    expect(rel(up, 'Rut', 'T').x).toBeLessThan(rel(up, 'Pim', 'T').x);
    noOverlap(up, ['T', ...ids]);
  });

  it('flera föräldrar: varje syskongrupp runt sin förälder', () => {
    const content: MindmapContent = { root: n('R', [n('A', [n('a1'), n('a2')]), n('B', [n('b1'), n('b2')])]) };
    const l = run('above', content, ['a1', 'a2', 'b1', 'b2']);
    expect(rel(l, 'a1', 'A').y).toBeLessThan(0);
    expect(rel(l, 'b1', 'B').y).toBeLessThan(0);
    expect(Math.abs(rel(l, 'a1', 'A').x + rel(l, 'a2', 'A').x) / 2).toBeLessThan(1);
  });

  it('en nod under en annan markerad följer sin gren; roten flyttas inte runt sig själv', () => {
    const content = four();
    const once = arrange(content, ['Rut', 's', 'T'], 'right', layoutOf(content));
    expect(findNode(once.root, 's')!.offset).toBeUndefined();
    expect(once.root.offset).toBeUndefined();
  });

  it('e) område: en rad i ett brett område, närmast där de stod', () => {
    const before = layoutOf(four());
    const t = center(before, 'T');
    const area = { x: t.x - 300, y: t.y + 200, width: 600, height: 60 };
    const l = layoutOf(arrange(four(), ids, 'area', before, area));
    const ys = ids.map((id) => rel(l, id, 'T').y);
    ys.forEach((y) => expect(y).toBeCloseTo(ys[0], 0));
    // Rut och Siv stod till vänster och hamnar till vänster.
    expect(rel(l, 'Rut', 'T').x).toBeLessThan(rel(l, 'Pim', 'T').x);
    expect(rel(l, 'Siv', 'T').x).toBeLessThan(rel(l, 'Kaj', 'T').x);
  });

  it('areaSlots: rad, kolumn och rutnät', () => {
    expect(areaSlots({ x: 0, y: 0, width: 300, height: 30 }, 3).map((p) => p.y)).toEqual([15, 15, 15]);
    expect(areaSlots({ x: 0, y: 0, width: 30, height: 300 }, 3).map((p) => p.x)).toEqual([15, 15, 15]);
    const grid = areaSlots({ x: 0, y: 0, width: 200, height: 200 }, 4);
    expect(new Set(grid.map((p) => p.x)).size).toBe(2);
    expect(new Set(grid.map((p) => p.y)).size).toBe(2);
    expect(areaSlots({ x: 0, y: 0, width: 200, height: 200 }, 0)).toEqual([]);
  });

  it('samma dokument när ingenting ska flyttas', () => {
    const content = four();
    const once = arrange(content, ids, 'circle', layoutOf(content));
    expect(arrange(once, ids, 'circle', layoutOf(once))).toBe(once);
    expect(M.hGap).toBeGreaterThan(0);
  });
});
