import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import { layoutMindmap } from '@/utils/mindmap/mindmapLayout';
import {
  isPresentKey,
  PRESENT_MARGIN,
  PRESENT_MAX_ZOOM,
  PRESENT_ZOOM,
  presentDoc,
  presentFocus,
  presentNext,
  presentPrev,
  presentProgress,
  presentSibling,
  presentStart,
  presentToggle,
  presentView,
  resolvePresentKey,
  type PresentState,
} from './mindmapPresent';

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode =>
  ({ id, label: id, children, ...extra });

/**
 * R
 * ├─ A ─ A1 ─ A1a
 * │    └ A2
 * ├─ B (utan barn)
 * └─ C ─ C1 ─ C1a
 */
const root = (): MindmapNode => n('R', [
  n('A', [n('A1', [n('A1a')]), n('A2')]),
  n('B'),
  n('C', [n('C1', [n('C1a')])], { collapsed: true }),
]);

const steps = (count: number, from: PresentState = presentStart(root())): PresentState[] => {
  const result = [from];
  for (let i = 0; i < count; i += 1) result.push(presentNext(root(), result[result.length - 1]));
  return result;
};

describe('stegen', () => {
  it('börjar på roten med allt hopfällt', () => {
    expect(presentStart(root())).toEqual({ expanded: [], current: 'R' });
  });

  it('fäller ut grenarna i läsordning, djupet först, och hoppar över noder utan barn', () => {
    const path = steps(4).map((s) => s.current);
    expect(path).toEqual(['R', 'A', 'A1', 'C', 'C1']);
    expect(steps(4)[4].expanded).toEqual(['A', 'A1', 'C', 'C1']);
  });

  it('stannar när allt är utfällt', () => {
    const done = steps(4)[4];
    expect(presentNext(root(), done)).toBe(done);
  });

  it('tillbaka är motsatsen till nästa, hela vägen', () => {
    const forward = steps(4);
    let state = forward[4];
    for (let i = 3; i >= 0; i -= 1) {
      state = presentPrev(root(), state);
      expect(state).toEqual(forward[i]);
    }
    expect(presentPrev(root(), state)).toBe(state);
  });

  it('tillbaka fäller ihop hela grenen under den utpekade', () => {
    const state: PresentState = { expanded: ['A', 'A1', 'C'], current: 'A' };
    expect(presentPrev(root(), state)).toEqual({ expanded: ['C'], current: 'R' });
  });

  it('tillbaka från en nod som inte är utfälld tar den senaste före den', () => {
    const state: PresentState = { expanded: ['A', 'A1'], current: 'B' };
    expect(presentPrev(root(), state)).toEqual({ expanded: ['A'], current: 'A' });
  });

  it('nästa börjar om från början när bara tidigare grenar är kvar', () => {
    const state: PresentState = { expanded: ['C', 'C1'], current: 'C1' };
    expect(presentNext(root(), state).current).toBe('A');
  });

  it('nästa fäller ut förfäderna till en gren som inte syns', () => {
    const state: PresentState = { expanded: [], current: 'A2' };
    // Efter A2 i läsordning kommer C; A1 ligger före.
    expect(presentNext(root(), state)).toEqual({ expanded: ['C'], current: 'C' });
    const deep: PresentState = { expanded: ['A', 'C'], current: 'C' };
    expect(presentNext(root(), deep)).toEqual({ expanded: ['A', 'C', 'C1'], current: 'C1' });
  });

  it('tål ett läge som pekar på noder som inte finns', () => {
    const odd: PresentState = { expanded: ['borta'], current: 'borta' };
    expect(presentNext(root(), odd).current).toBe('A');
    expect(presentPrev(root(), odd)).toEqual({ expanded: [], current: 'R' });
  });
});

describe('syskonhopp', () => {
  it('går till nästa och föregående syskon och fäller ut det', () => {
    const atA: PresentState = { expanded: ['A'], current: 'A' };
    const atB = presentSibling(root(), atA, 1);
    expect(atB).toEqual({ expanded: ['A'], current: 'B' });
    const atC = presentSibling(root(), atB, 1);
    expect(atC).toEqual({ expanded: ['A', 'C'], current: 'C' });
    expect(presentSibling(root(), atC, 1)).toBe(atC);
    expect(presentSibling(root(), atC, -1).current).toBe('B');
  });

  it('går från roten till första eller sista grenen', () => {
    expect(presentSibling(root(), presentStart(root()), 1)).toEqual({ expanded: ['A'], current: 'A' });
    expect(presentSibling(root(), presentStart(root()), -1)).toEqual({ expanded: ['C'], current: 'C' });
  });
});

describe('klick', () => {
  it('fäller ut och ihop en nod med barn', () => {
    const open = presentToggle(root(), presentStart(root()), 'A');
    expect(open).toEqual({ expanded: ['A'], current: 'A' });
    const deeper = presentToggle(root(), open, 'A1');
    expect(deeper.expanded).toEqual(['A', 'A1']);
    expect(presentToggle(root(), deeper, 'A')).toEqual({ expanded: [], current: 'A' });
  });

  it('pekar bara ut en nod utan barn, och roten', () => {
    const state: PresentState = { expanded: ['A'], current: 'A' };
    expect(presentToggle(root(), state, 'B')).toEqual({ expanded: ['A'], current: 'B' });
    expect(presentToggle(root(), state, 'R')).toEqual({ expanded: ['A'], current: 'R' });
    expect(presentToggle(root(), state, 'borta')).toBe(state);
  });
});

describe('presentProgress', () => {
  it('räknar utfällda grenar av alla', () => {
    expect(presentProgress(root(), presentStart(root()))).toEqual({ done: 0, total: 4 });
    expect(presentProgress(root(), steps(3)[3])).toEqual({ done: 3, total: 4 });
    expect(presentProgress(n('R', [n('A'), n('B')]), presentStart(root()))).toEqual({ done: 0, total: 0 });
  });
});

describe('presentDoc', () => {
  const doc = (): MindmapDoc => ({ root: root(), layout: 'right', crossLinks: [{ id: 'l', from: 'A2', to: 'B' }] });
  const collapsed = (d: MindmapDoc) => {
    const result: string[] = [];
    const walk = (node: MindmapNode) => {
      if (node.collapsed) result.push(node.id);
      node.children.forEach(walk);
    };
    walk(d.root);
    return result;
  };

  it('fäller ihop allt med barn som inte är utfällt, oavsett vad som är sparat', () => {
    expect(collapsed(presentDoc(doc(), presentStart(root())))).toEqual(['A', 'A1', 'C', 'C1']);
    // C är sparad som hopfälld; i presentationen gäller bara läget.
    expect(collapsed(presentDoc(doc(), { expanded: ['C'], current: 'C' }))).toEqual(['A', 'A1', 'C1']);
  });

  it('rör inte roten, noder utan barn, länkarna eller dokumentet', () => {
    const original = doc();
    const before = JSON.stringify(original);
    const shown = presentDoc(original, { expanded: ['A'], current: 'A' });
    expect(JSON.stringify(original)).toBe(before);
    expect(shown.root.collapsed).toBeUndefined();
    expect(shown.crossLinks).toBe(original.crossLinks);
    expect(shown.layout).toBe('right');
    expect(collapsed(shown)).not.toContain('B');
  });

  it('visar rotens barn från början', () => {
    const layout = layoutMindmap(presentDoc(doc(), presentStart(root())), (text) => text.length * 10);
    expect(['A', 'B', 'C'].every((id) => layout.byId.has(id))).toBe(true);
    expect(layout.byId.has('A1')).toBe(false);
  });
});

describe('vyn', () => {
  const size = { width: 1200, height: 800 };

  it('visar allt, förstorat men inte hur mycket som helst, när det ryms', () => {
    const view = presentView({ width: 200, height: 100 }, null, size);
    expect(view.zoom).toBe(PRESENT_MAX_ZOOM);
    // Centrerat.
    expect(view.x).toBe(Math.round((1200 - 200 * PRESENT_MAX_ZOOM) / 2));
    expect(view.y).toBe(Math.round((800 - 100 * PRESENT_MAX_ZOOM) / 2));

    const snug = presentView({ width: 800, height: 300 }, { x: 0, y: 0, width: 50, height: 20 }, size);
    expect(snug.zoom).toBeCloseTo((1200 - 2 * PRESENT_MARGIN) / 800);
    expect(snug.x).toBe(PRESENT_MARGIN);
  });

  it('visar det utpekade i läsbar storlek när allt inte ryms', () => {
    const focus = { x: 2000, y: 1000, width: 300, height: 120 };
    const view = presentView({ width: 4000, height: 2000 }, focus, size);
    expect(view.zoom).toBe(PRESENT_ZOOM);
    // Fokus mitt hamnar i skärmens mitt.
    expect((focus.x + focus.width / 2) * view.zoom + view.x).toBeCloseTo(600, 0);
    expect((focus.y + focus.height / 2) * view.zoom + view.y).toBeCloseTo(400, 0);
  });

  it('zoomar ut när det utpekade inte ryms, men aldrig längre än hela kartan', () => {
    const focus = { x: 0, y: 0, width: 2208, height: 400 };
    const view = presentView({ width: 4000, height: 2000 }, focus, size);
    expect(view.zoom).toBeCloseTo(0.5);
    const huge = presentView({ width: 4000, height: 2000 }, { x: 0, y: 0, width: 4000, height: 2000 }, size);
    expect(huge.zoom).toBeCloseTo((1200 - 2 * PRESENT_MARGIN) / 4000);
  });

  it('lämnar inte mer luft än marginalen vid kartans kant', () => {
    const corner = { x: 0, y: 0, width: 100, height: 30 };
    const view = presentView({ width: 4000, height: 2000 }, corner, size);
    expect(view.x).toBe(PRESENT_MARGIN);
    expect(view.y).toBe(PRESENT_MARGIN);
    const far = { x: 3900, y: 1970, width: 100, height: 30 };
    const end = presentView({ width: 4000, height: 2000 }, far, size);
    expect(end.x).toBe(Math.round(1200 - PRESENT_MARGIN - 4000 * end.zoom));
    expect(end.y).toBe(Math.round(800 - PRESENT_MARGIN - 2000 * end.zoom));
  });

  it('tål en yta utan mått', () => {
    expect(presentView({ width: 100, height: 100 }, null, { width: 0, height: 0 })).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('fokus är den utpekade noden med förälder och synliga barn', () => {
    const doc: MindmapDoc = { root: root(), layout: 'right' };
    const state: PresentState = { expanded: ['A'], current: 'A' };
    const shown = presentDoc(doc, state);
    const layout = layoutMindmap(shown, (text) => text.length * 10);
    const focus = presentFocus(layout, shown.root, state)!;
    const box = (id: string) => layout.byId.get(id)!;
    expect(focus.x).toBe(box('R').x);
    expect(focus.x + focus.width).toBe(Math.max(box('A1').x + box('A1').width, box('A2').x + box('A2').width));
    expect(focus.y).toBeLessThanOrEqual(box('A1').y);
    expect(presentFocus(layout, shown.root, { expanded: [], current: 'borta' })).toBeNull();
  });
});

describe('tangenterna', () => {
  const key = (k: string, extra: Partial<Parameters<typeof resolvePresentKey>[0]> = {}) =>
    ({ key: k, code: '', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...extra });

  it('Alt+P startar, läst på tangentens plats', () => {
    expect(isPresentKey(key('π', { altKey: true, code: 'KeyP' }))).toBe(true);
    expect(isPresentKey(key('p', { code: 'KeyP' }))).toBe(false);
    expect(isPresentKey(key('p', { altKey: true, ctrlKey: true, code: 'KeyP' }))).toBe(false);
    expect(isPresentKey(key('P', { altKey: true, shiftKey: true, code: 'KeyP' }))).toBe(false);
  });

  it('stegar fram och tillbaka, också med en fjärr', () => {
    expect([' ', 'ArrowRight', 'Enter', 'PageDown'].map((k) => resolvePresentKey(key(k)))).toEqual(['next', 'next', 'next', 'next']);
    expect(['ArrowLeft', 'Backspace', 'PageUp'].map((k) => resolvePresentKey(key(k)))).toEqual(['prev', 'prev', 'prev']);
    expect(resolvePresentKey(key(' ', { shiftKey: true }))).toBe('prev');
  });

  it('hoppar mellan grenar, går till början och avslutar', () => {
    expect(resolvePresentKey(key('ArrowDown'))).toBe('down');
    expect(resolvePresentKey(key('ArrowUp'))).toBe('up');
    expect(resolvePresentKey(key('Home'))).toBe('home');
    expect(resolvePresentKey(key('Escape'))).toBe('exit');
  });

  it('lämnar bokstäver och tangenter med Ctrl, Alt eller Meta', () => {
    expect(resolvePresentKey(key('n'))).toBeNull();
    expect(resolvePresentKey(key('ArrowRight', { ctrlKey: true }))).toBeNull();
    expect(resolvePresentKey(key(' ', { altKey: true }))).toBeNull();
    expect(resolvePresentKey(key('Escape', { metaKey: true }))).toBeNull();
  });
});
