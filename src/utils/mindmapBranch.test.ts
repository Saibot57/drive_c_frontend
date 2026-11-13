import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import { layoutMindmap } from '@/utils/mindmap/mindmapLayout';
import { navigate, sideOf } from '@/utils/mindmap/mindmapTree';
import { crossLinkGeometry } from '@/utils/mindmapCrossLinks';
import {
  branchDoc,
  branchRootAction,
  branchRootId,
  clampToBranch,
  inBranch,
  isViewRootChild,
  offsetBy,
  resolveBranchKey,
  viewRootOf,
} from './mindmapBranch';

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode =>
  ({ id, label: id, children, ...extra });

/** R med A (höger: A1, A2(A2a)) och B (vänster: B1), och en länk in i och en ut ur A. */
const doc = (): MindmapDoc => ({
  root: n('R', [
    n('A', [n('A1'), n('A2', [n('A2a')])], { side: 'right', offset: { dx: 30, dy: -10 }, collapsed: true }),
    n('B', [n('B1')], { side: 'left' }),
  ]),
  layout: 'both',
  crossLinks: [
    { id: 'in', from: 'A1', to: 'A2a' },
    { id: 'ut', from: 'A1', to: 'B1' },
  ],
});

const measure = (text: string) => text.length * 10;

describe('branchRootId', () => {
  it('gäller en nod som finns och inte är roten', () => {
    expect(branchRootId(doc(), 'A')).toBe('A');
    expect(branchRootId(doc(), 'R')).toBeNull();
    expect(branchRootId(doc(), 'finns-inte')).toBeNull();
    expect(branchRootId(doc(), null)).toBeNull();
  });
});

describe('branchDoc', () => {
  it('ger samma dokument tillbaka utan gren', () => {
    const d = doc();
    expect(branchDoc(d, null)).toBe(d);
    expect(branchDoc(d, 'R')).toBe(d);
    expect(branchDoc(d, 'finns-inte')).toBe(d);
  });

  it('gör noden till rot utan förskjutning, hopfällning och sida', () => {
    const branch = branchDoc(doc(), 'A');
    expect(branch.root.id).toBe('A');
    expect(branch.root.offset).toBeUndefined();
    expect(branch.root.collapsed).toBeUndefined();
    expect(branch.root.side).toBeUndefined();
    expect(branch.root.children.map((c) => c.id)).toEqual(['A1', 'A2']);
  });

  it('grenens rot tappar sin plats (dir) men behåller riktningen för nya barn', () => {
    const d = doc();
    const placed = { ...d, root: { ...d.root, children: d.root.children.map((c) => (c.id === 'A' ? { ...c, dir: { side: 'left' as const }, childDir: { angle: 90 } } : c)) } };
    const branch = branchDoc(placed, 'A');
    expect(branch.root.dir).toBeUndefined();
    expect(branch.root.childDir).toEqual({ angle: 90 });
  });

  it('låter grenen ligga kvar på sin sida', () => {
    const right = branchDoc(doc(), 'A');
    expect(right.layout).toBe('both');
    expect(right.root.children.every((c) => c.side === 'right')).toBe(true);
    expect(sideOf(right, 'A2a')).toBe('right');

    const left = branchDoc(doc(), 'B');
    expect(left.root.children.every((c) => c.side === 'left')).toBe(true);
    const layout = layoutMindmap(left, measure);
    expect(layout.byId.get('B1')!.x).toBeLessThan(layout.byId.get('B')!.x);
  });

  it('ger höger sida i layouten right, också för en djupare nod', () => {
    const d: MindmapDoc = { ...doc(), layout: 'right' };
    expect(branchDoc(d, 'A2').root.children.map((c) => c.side)).toEqual(['right']);
  });

  it('tar bara med tvärlänkar som har båda ändar i grenen', () => {
    expect(branchDoc(doc(), 'A').crossLinks).toEqual([{ id: 'in', from: 'A1', to: 'A2a' }]);
    expect('crossLinks' in branchDoc(doc(), 'B')).toBe(false);
  });

  it('rör inte det ursprungliga dokumentet', () => {
    const d = doc();
    const before = JSON.stringify(d);
    branchDoc(d, 'A');
    expect(JSON.stringify(d)).toBe(before);
  });

  it('visar barnen till en hopfälld nod när den är grenens rot', () => {
    const layout = layoutMindmap(branchDoc(doc(), 'A'), measure);
    expect(layout.byId.has('A1')).toBe(true);
    expect(layout.byId.get('A')!.isRoot).toBe(true);
    // I hela kartan är A hopfälld och barnen syns inte.
    expect(layoutMindmap(doc(), measure).byId.has('A1')).toBe(false);
  });

  it('ritar bara länken inne i grenen', () => {
    const branch = branchDoc(doc(), 'A');
    const shapes = crossLinkGeometry(layoutMindmap(branch, measure), branch);
    expect(shapes.map((s) => s.id)).toEqual(['in']);
  });
});

describe('navigering i grenen', () => {
  it('stannar vid grenens rot och går inte ut ur grenen', () => {
    const right = branchDoc(doc(), 'A');
    expect(navigate(right, 'A', 'left')).toBeNull();
    expect(navigate(right, 'A', 'right')).toBe('A1');
    expect(navigate(right, 'A1', 'left')).toBe('A');
    expect(navigate(right, 'A2', 'down')).toBeNull();

    const left = branchDoc(doc(), 'B');
    expect(navigate(left, 'B', 'right')).toBeNull();
    expect(navigate(left, 'B', 'left')).toBe('B1');
    expect(navigate(left, 'B1', 'right')).toBe('B');
  });
});

describe('det som visas', () => {
  it('har grenens rot som rot, eller kartans', () => {
    expect(viewRootOf(doc(), 'A').id).toBe('A');
    expect(viewRootOf(doc(), null).id).toBe('R');
    expect(viewRootOf(doc(), 'finns-inte').id).toBe('R');
  });

  it('vet vilka noder som syns', () => {
    expect(inBranch(doc(), 'A', 'A2a')).toBe(true);
    expect(inBranch(doc(), 'A', 'B1')).toBe(false);
    expect(inBranch(doc(), 'A', 'R')).toBe(false);
    expect(inBranch(doc(), null, 'B1')).toBe(true);
  });

  it('håller en markering inom grenen', () => {
    expect(clampToBranch(doc(), 'A', 'A2a')).toBe('A2a');
    expect(clampToBranch(doc(), 'A', 'B1')).toBe('A');
    expect(clampToBranch(doc(), 'A', null)).toBe('A');
    expect(clampToBranch(doc(), null, 'finns-inte')).toBe('R');
  });

  it('vet vilka noder som ligger direkt under den visade roten', () => {
    expect(isViewRootChild(doc(), 'A', 'A1')).toBe(true);
    expect(isViewRootChild(doc(), 'A', 'A2a')).toBe(false);
    expect(isViewRootChild(doc(), null, 'A')).toBe(true);
    expect(isViewRootChild(doc(), null, 'A1')).toBe(false);
  });
});

describe('tangenterna', () => {
  const key = (k: string, extra: Partial<Parameters<typeof resolveBranchKey>[0]> = {}) =>
    ({ key: k, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...extra });

  it('Alt+Enter växlar, med eller utan öppen gren', () => {
    expect(resolveBranchKey(key('Enter', { altKey: true }), false)).toBe('toggle');
    expect(resolveBranchKey(key('Enter', { altKey: true }), true)).toBe('toggle');
    expect(resolveBranchKey(key('Enter'), true)).toBeNull();
    expect(resolveBranchKey(key('Enter', { altKey: true, ctrlKey: true }), false)).toBeNull();
    expect(resolveBranchKey(key('Enter', { altKey: true, shiftKey: true }), false)).toBeNull();
  });

  it('Esc stänger bara en öppen gren', () => {
    expect(resolveBranchKey(key('Escape'), true)).toBe('exit');
    expect(resolveBranchKey(key('Escape'), false)).toBeNull();
    expect(resolveBranchKey(key('Escape', { altKey: true }), true)).toBeNull();
  });
});

describe('grenens rot beter sig som roten', () => {
  it('Enter ger ett barn', () => {
    expect(branchRootAction({ type: 'addSibling', where: 'after' })).toEqual({ type: 'addChild' });
  });

  it('den flyttas, dras in och fälls inte ihop', () => {
    expect(branchRootAction({ type: 'indent' })).toBe('ignore');
    expect(branchRootAction({ type: 'outdent' })).toBe('ignore');
    expect(branchRootAction({ type: 'move', direction: 'up' })).toBe('ignore');
    expect(branchRootAction({ type: 'toggleCollapse' })).toBe('ignore');
  });

  it('den tas inte bort och klipps inte ut', () => {
    expect(branchRootAction({ type: 'remove' })).toBe('refuse');
    expect(branchRootAction({ type: 'cut' })).toBe('refuse');
  });

  it('allt annat går som vanligt', () => {
    expect(branchRootAction({ type: 'addChild' })).toEqual({ type: 'addChild' });
    expect(branchRootAction({ type: 'copy' })).toEqual({ type: 'copy' });
    expect(branchRootAction({ type: 'color', color: 'green' })).toEqual({ type: 'color', color: 'green' });
    expect(branchRootAction({ type: 'undo' })).toEqual({ type: 'undo' });
  });
});

describe('offsetBy', () => {
  it('lägger förskjutningen på den som finns, i hela pixlar', () => {
    const moved = offsetBy(doc(), 'A', { dx: 10.4, dy: 5.6 });
    expect(moved?.root.children[0].offset).toEqual({ dx: 40, dy: -4 });
    expect(offsetBy(doc(), 'A1', { dx: 3, dy: 4 })?.root.children[0].children[0].offset).toEqual({ dx: 3, dy: 4 });
  });

  it('rör inte roten eller en nod som saknas', () => {
    expect(offsetBy(doc(), 'R', { dx: 1, dy: 1 })).toBeNull();
    expect(offsetBy(doc(), 'finns-inte', { dx: 1, dy: 1 })).toBeNull();
  });
});
