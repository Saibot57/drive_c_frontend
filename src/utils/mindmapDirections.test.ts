import { describe, expect, it } from 'vitest';
import type { MindmapContent, MindmapNode } from '@/types/mindmap';
import { layoutMindmap, MINDMAP_METRICS as M, type MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { addChild, findNode, sanitizeMindmap } from '@/utils/mindmap/mindmapTree';
import { finishMindmapLayout } from './mindmapRouting';
import {
  angleTo,
  applyDirections,
  dirForNewChild,
  fanAngles,
  placeNewNode,
  pruneDirs,
  resolveDirectionKey,
  setChildDir,
  setDir,
  sideOfDir,
} from './mindmapDirections';

/* Riktningen för nya barn (docs/plans/mindmap-arrangera.md, del B). */

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});
const measure = (text: string) => text.length * 10;
const layoutOf = (content: MindmapContent) => finishMindmapLayout(layoutMindmap(content, measure), content);

const center = (l: MindmapLayoutResult, id: string) => {
  const b = l.byId.get(id)!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
/** Nodens mitt räknad från rotens mitt. */
const rel = (l: MindmapLayoutResult, id: string) => {
  const a = center(l, id);
  const root = l.nodes.find((x) => x.isRoot)!;
  return { x: Math.round(a.x - root.x - root.width / 2), y: Math.round(a.y - root.y - root.height / 2) };
};

/** Tobias bild: läget `right`, Rut dragen till vänster om roten, s ännu längre ut. */
const picture = (sKids: MindmapNode[] = []): MindmapContent => ({
  root: n('T', [
    n('Rut', [n('s', sKids, { offset: { dx: -260, dy: -40 } })], { offset: { dx: -330, dy: -60 } }),
    n('Pim'),
  ]),
  layout: 'right',
});

describe('applyDirections', () => {
  it('en karta utan dir ger samma layout, samma objekt', () => {
    const content = picture([n('x')]);
    const laid = layoutMindmap(content, measure);
    expect(applyDirections(laid, content)).toBe(laid);
  });

  it('childDir ensam flyttar ingenting', () => {
    const content = setChildDir(picture([n('x')]), 's', 45);
    const laid = layoutMindmap(content, measure);
    expect(applyDirections(laid, content)).toBe(laid);
  });

  it('ett barn med { side: left } står till vänster om föräldern, med luft hGap', () => {
    const content = setDir(picture([n('x')]), 'x', { side: 'left' });
    const l = layoutOf(content);
    const s = l.byId.get('s')!;
    const x = l.byId.get('x')!;
    expect(x.x + x.width).toBeCloseTo(s.x - M.hGap);
    expect(center(l, 'x').y).toBeCloseTo(center(l, 's').y);
    expect(x.side).toBe('left');
    // Linjen går från förälderns vänstra kant till barnets högra.
    const edge = l.edges.find((e) => e.toId === 'x')!;
    expect(edge.x1).toBeCloseTo(s.x);
    expect(edge.x2).toBeCloseTo(x.x + x.width);
  });

  it('en kolumn på sidan har barnen under varandra, centrerade mot föräldern', () => {
    const kids = ['x', 'y', 'z'].map((id) => n(id, [], { dir: { side: 'left' } }));
    const l = layoutOf(picture(kids));
    const ys = ['x', 'y', 'z'].map((id) => center(l, id).y);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
    expect(ys[1]).toBeCloseTo(center(l, 's').y);
    expect(l.byId.get('y')!.y).toBeGreaterThanOrEqual(l.byId.get('x')!.y + l.byId.get('x')!.height + M.vGap - 0.01);
  });

  it('en vinkel: ett barn rakt åt det hållet', () => {
    const content = { root: n('R', [n('A', [n('a', [], { dir: { angle: 270 } })])]) };
    const l = layoutOf(content);
    const a = center(l, 'a');
    const A = center(l, 'A');
    expect(a.x).toBeCloseTo(A.x);
    expect(a.y).toBeLessThan(A.y - l.byId.get('A')!.height / 2 - M.hGap + 0.01);
  });

  it('solfjäder: tre nya syskon åt samma håll, symmetriskt och medurs i trädets ordning', () => {
    let content: MindmapContent = { root: n('R', [n('A')]) };
    ['a', 'b', 'c'].forEach((id) => {
      const added = addChild(content, 'A', n(id))!;
      content = placeNewNode(content, added.content, id, { angle: 0 }, layoutOf);
    });
    const l = layoutOf(content);
    const A = center(l, 'A');
    const [a, b, c] = ['a', 'b', 'c'].map((id) => center(l, id));
    expect(b.y).toBeCloseTo(A.y);
    expect(a.y).toBeLessThan(b.y);
    expect(c.y).toBeGreaterThan(b.y);
    expect(A.y - a.y).toBeCloseTo(c.y - A.y);
    const ra = Math.hypot(a.x - A.x, a.y - A.y);
    const rc = Math.hypot(c.x - A.x, c.y - A.y);
    expect(ra).toBeCloseTo(rc);
    // Rutorna överlappar inte.
    const boxes = ['a', 'b', 'c'].map((id) => l.byId.get(id)!);
    expect(boxes[1].y).toBeGreaterThanOrEqual(boxes[0].y + boxes[0].height - 0.01);
  });

  it('grenen under ett barn följer med, och det som saknar dir speglas så att det växer utåt', () => {
    const content = picture([n('x', [n('x1')], { dir: { side: 'left' } })]);
    const l = layoutOf(content);
    const x = l.byId.get('x')!;
    const x1 = l.byId.get('x1')!;
    expect(x1.x + x1.width).toBeCloseTo(x.x - M.hGap);
    expect(x1.side).toBe('left');
  });

  it('barnets egen förskjutning läggs på platsen', () => {
    const plain = layoutOf(setDir(picture([n('x')]), 'x', { side: 'left' }));
    const shifted = layoutOf(setDir(picture([n('x', [], { offset: { dx: -10, dy: 20 } })]), 'x', { side: 'left' }));
    const d = (l: MindmapLayoutResult, id: string) => ({ x: center(l, id).x - center(l, 's').x, y: center(l, id).y - center(l, 's').y });
    expect(d(shifted, 'x').x - d(plain, 'x').x).toBeCloseTo(-10);
    expect(d(shifted, 'x').y - d(plain, 'x').y).toBeCloseTo(20);
  });

  it('hopfällda barn räknas inte', () => {
    const content = picture([n('x', [n('x1', [], { dir: { angle: 90 } })], { collapsed: true })]);
    expect(() => layoutOf(content)).not.toThrow();
    expect(layoutOf(content).byId.has('x1')).toBe(false);
  });
});

describe('plats i kolumnen (del E)', () => {
  /** Rotens barn i en kolumn till höger; Pim har en solfjäder snett uppåt. */
  const fanned = (): MindmapContent => {
    let content: MindmapContent = { root: n('T', [n('Rut', [n('s')]), n('Siv'), n('Pim'), n('Kaj')]), layout: 'right' };
    content = setChildDir(content, 'Pim', 300);
    ['A', 'B', 'C'].forEach((id) => {
      const added = addChild(content, 'Pim', n(id))!;
      content = placeNewNode(content, added.content, id, { angle: 300 }, layoutOf);
    });
    return content;
  };
  const overlaps = (l: MindmapLayoutResult, a: string, b: string) => {
    const p = l.byId.get(a)!;
    const q = l.byId.get(b)!;
    return p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
  };

  it('en solfjäder går inte in i grannens gren: syskonen flyttas isär', () => {
    const l = layoutOf(fanned());
    ['A', 'B', 'C'].forEach((kid) => ['Rut', 's', 'Siv'].forEach((other) => {
      expect(overlaps(l, kid, other), `${kid} och ${other}`).toBe(false);
    }));
    // Ordningen står kvar.
    const ys = ['Rut', 'Siv', 'Pim', 'Kaj'].map((id) => center(l, id).y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  it('kolumnen hålls centrerad mot föräldern', () => {
    const plainContent: MindmapContent = { root: n('T', [n('Rut', [n('s')]), n('Siv'), n('Pim'), n('Kaj')]), layout: 'right' };
    const mid = (l: MindmapLayoutResult) => (rel(l, 'Rut').y + rel(l, 'Kaj').y) / 2;
    const l = layoutOf(fanned());
    expect(mid(l)).toBeCloseTo(mid(layoutOf(plainContent)), 0);
    // Flytten delas: Rut går upp, Kaj går ned.
    expect(rel(l, 'Rut').y).toBeLessThan(rel(layoutOf(plainContent), 'Rut').y);
    expect(rel(l, 'Kaj').y).toBeGreaterThan(rel(layoutOf(plainContent), 'Kaj').y);
  });

  it('en kolumn där inget möts står kvar, också i en karta med riktningar', () => {
    const plain: MindmapContent = { root: n('T', [n('Rut', [n('s')]), n('Siv'), n('Pim'), n('Kaj')]), layout: 'right' };
    const withDir = setDir(plain, 's', { side: 'right' });
    const a = layoutOf(plain);
    const b = layoutOf(withDir);
    ['Rut', 'Siv', 'Pim', 'Kaj', 's'].forEach((id) => {
      expect(rel(b, id)).toEqual(rel(a, id));
    });
  });

  it('ett draget syskon räknas inte och flyttas inte', () => {
    const content = fanned();
    const dragged = { ...content, root: { ...content.root, children: content.root.children.map((c) => (c.id === 'Siv' ? { ...c, offset: { dx: 0, dy: 5 } } : c)) } };
    // Siv står där den delade layouten satte den, plus förskjutningen.
    expect(rel(layoutOf(dragged), 'Siv')).toEqual(rel(layoutMindmap(dragged, measure), 'Siv'));
  });
});

describe('dirForNewChild', () => {
  it('Tobias bild: ett nytt barn till s hamnar till vänster', () => {
    const content = picture();
    expect(dirForNewChild(content, 's', layoutOf(content))).toEqual({ side: 'left' });
  });

  it('en nod på sin layoutsida får inget fält, som förut', () => {
    const content = picture();
    expect(dirForNewChild(content, 'Pim', layoutOf(content))).toBeNull();
    expect(dirForNewChild(content, 'T', layoutOf(content))).toBeNull();
  });

  it('ordningen: bara nästa, förälderns inställning, arvet', () => {
    const content = setChildDir(setDir(picture(), 's', { angle: 190, base: 200 }), 'Rut', 300);
    const l = layoutOf(content);
    expect(dirForNewChild(content, 's', l, 30)).toEqual({ angle: 30 });
    expect(dirForNewChild(content, 'Rut', l)).toEqual({ angle: 300 });
    expect(dirForNewChild(content, 's', l)).toEqual({ angle: 200 });
    // Arvet går genom en nod utan dir.
    const deeper = addChild(content, 's', n('u'))!.content;
    expect(dirForNewChild(deeper, 'u', layoutOf(deeper))).toEqual({ angle: 200 });
  });

  it('roten: bara nästa och rotens inställning', () => {
    const content = setChildDir(picture(), 'T', 90);
    expect(dirForNewChild(content, 'T', layoutOf(content))).toEqual({ angle: 90 });
  });
});

describe('placeNewNode', () => {
  it('ett draget syskon står kvar när ett nytt kommer till solfjädern; de andra fördelas om', () => {
    const before: MindmapContent = { root: n('R', [n('A', [
      n('a', [], { dir: { angle: 350, base: 0 } }),
      n('b', [], { dir: { angle: 10, base: 0 }, offset: { dx: 15, dy: 5 } }),
    ])]) };
    const added = addChild(before, 'A', n('c'))!;
    const after = placeNewNode(before, added.content, 'c', { angle: 0 }, layoutOf);
    const was = layoutOf(before);
    const now = layoutOf(after);
    const rel = (l: MindmapLayoutResult, id: string) => ({ x: center(l, id).x - center(l, 'A').x, y: center(l, id).y - center(l, 'A').y });
    expect(rel(now, 'b').x).toBeCloseTo(rel(was, 'b').x);
    expect(rel(now, 'b').y).toBeCloseTo(rel(was, 'b').y);
    expect(findNode(after.root, 'b')!.dir).toEqual({ angle: 10, base: 0 });
    expect((findNode(after.root, 'a')!.dir as { gap?: number }).gap).toBeGreaterThanOrEqual(M.hGap);
    // a och c delar solfjädern, symmetriskt kring 0°.
    const a = findNode(after.root, 'a')!.dir as { angle: number };
    const c = findNode(after.root, 'c')!.dir as { angle: number };
    expect((a.angle + 180) % 360 - 180).toBeCloseTo(-((c.angle + 180) % 360 - 180), 0);
    expect(a.angle).toBeGreaterThan(180);
  });

  it('ett nytt barn åt en sida: dragna syskon står kvar', () => {
    const before: MindmapContent = { root: n('R', [n('A', [
      n('a', [], { dir: { side: 'left' } }),
      n('b', [], { dir: { side: 'left' }, offset: { dx: 15, dy: 5 } }),
    ])]) };
    const added = addChild(before, 'A', n('c'))!;
    const after = placeNewNode(before, added.content, 'c', { side: 'left' }, layoutOf);
    const rel = (l: MindmapLayoutResult, id: string) => ({ x: center(l, id).x - center(l, 'A').x, y: center(l, id).y - center(l, 'A').y });
    expect(rel(layoutOf(after), 'b').y).toBeCloseTo(rel(layoutOf(before), 'b').y, 0);
    expect(rel(layoutOf(after), 'a').y).not.toBeCloseTo(rel(layoutOf(before), 'a').y, 0);
  });

  it('fanAngles: ett barn rakt åt hållet, flera symmetriskt och högst 160° breda', () => {
    const box = { x: 0, y: 0, width: 60, height: 26 };
    expect(fanAngles(box, [box], 90)).toEqual({ angles: [90], gap: M.hGap });
    const three = fanAngles(box, [box, box, box], 0);
    expect(three.angles).toEqual([338, 0, 22]);
    expect(three.gap).toBeGreaterThanOrEqual(M.hGap);
    const many = fanAngles(box, Array.from({ length: 30 }, () => box), 0);
    const signed = many.angles.map((a) => ((a + 180) % 360) - 180);
    expect(Math.max(...signed) - Math.min(...signed)).toBeLessThanOrEqual(160.1);
    expect(signed[0]).toBeCloseTo(-signed[29], 0);
    expect(many.gap).toBeGreaterThan(three.gap);
  });

  it('syskonen i en sned solfjäder överlappar inte', () => {
    let content: MindmapContent = { root: n('R', [n('A')]) };
    ['aaaaaa', 'bbbbbb', 'cccccc', 'dddddd'].forEach((id) => {
      const added = addChild(content, 'A', n(id))!;
      content = placeNewNode(content, added.content, id, { angle: 315 }, layoutOf);
    });
    const l = layoutOf(content);
    const ids = ['aaaaaa', 'bbbbbb', 'cccccc', 'dddddd'];
    ids.slice(1).forEach((id, i) => {
      const a = l.byId.get(ids[i])!;
      const b = l.byId.get(id)!;
      const apartX = a.x + a.width <= b.x + 0.01 || b.x + b.width <= a.x + 0.01;
      const apartY = a.y + a.height <= b.y + 0.01 || b.y + b.height <= a.y + 0.01;
      expect(apartX || apartY).toBe(true);
    });
  });

  it('utan riktning: dokumentet som det är', () => {
    const before = picture();
    const added = addChild(before, 'Pim')!;
    expect(placeNewNode(before, added.content, added.id, null, layoutOf)).toBe(added.content);
  });
});

describe('fälten', () => {
  it('tvätten tar vinkel och sida, normaliserar och kastar fel form', () => {
    const content = sanitizeMindmap({ root: { id: 'r', label: 'r', children: [
      { id: 'a', label: 'a', children: [], dir: { angle: -90, base: 'x' }, childDir: { angle: 725 } },
      { id: 'd', label: 'd', children: [], dir: { angle: 10, base: -5, gap: 40.4 } },
      { id: 'b', label: 'b', children: [], dir: { side: 'left' } },
      { id: 'c', label: 'c', children: [], dir: { side: 'up' }, childDir: { angle: 'x' } },
    ] } });
    expect(findNode(content.root, 'a')!.dir).toEqual({ angle: 270 });
    expect(findNode(content.root, 'a')!.childDir).toEqual({ angle: 5 });
    expect(findNode(content.root, 'b')!.dir).toEqual({ side: 'left' });
    expect(findNode(content.root, 'd')!.dir).toEqual({ angle: 10, base: 355, gap: 40 });
    expect(findNode(content.root, 'c')!.dir).toBeUndefined();
    expect(findNode(content.root, 'c')!.childDir).toBeUndefined();
  });

  it('setDir och setChildDir tar bort med null; roten får ingen dir', () => {
    const withDir = setDir(picture(), 'Pim', { side: 'left' });
    expect(findNode(setDir(withDir, 'Pim', null).root, 'Pim')!.dir).toBeUndefined();
    expect(setDir(picture(), 'T', { side: 'left' }).root.dir).toBeUndefined();
    expect(findNode(setChildDir(setChildDir(picture(), 'T', 10), 'T', null).root, 'T')!.childDir).toBeUndefined();
  });

  it('pruneDirs tar bort dir på en nod med ny förälder men inte childDir', () => {
    const prev = setChildDir(setDir(picture(), 'Pim', { angle: 10 }), 'Pim', 20);
    const pim = findNode(prev.root, 'Pim')!;
    const next: MindmapContent = { ...prev, root: { ...prev.root, children: [{ ...prev.root.children[0], children: [...prev.root.children[0].children, pim] }] } };
    const pruned = pruneDirs(prev, next);
    expect(findNode(pruned.root, 'Pim')!.dir).toBeUndefined();
    expect(findNode(pruned.root, 'Pim')!.childDir).toEqual({ angle: 20 });
    expect(pruneDirs(prev, prev)).toBe(prev);
  });

  it('små hjälpare', () => {
    expect(angleTo({ x: 0, y: 0 }, { x: 0, y: -5 })).toBe(270);
    expect(angleTo({ x: 0, y: 0 }, { x: -1, y: 0 })).toBe(180);
    expect(sideOfDir({ angle: 135 })).toBe('left');
    expect(sideOfDir({ angle: 90 })).toBe('right');
    expect(resolveDirectionKey({ code: 'KeyR', altKey: true, shiftKey: false, ctrlKey: false, metaKey: false })).toBe('set');
    expect(resolveDirectionKey({ code: 'KeyR', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false })).toBe('once');
    expect(resolveDirectionKey({ code: 'KeyR', altKey: false, shiftKey: false, ctrlKey: false, metaKey: false })).toBeNull();
    expect(resolveDirectionKey({ code: 'KeyR', altKey: true, shiftKey: false, ctrlKey: true, metaKey: false })).toBeNull();
  });
});
