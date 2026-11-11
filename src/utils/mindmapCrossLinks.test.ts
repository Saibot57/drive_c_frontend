import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import { MAX_CROSS_LINK_LABEL_LENGTH } from '@/types/mindmapDoc';
import { layoutMindmap } from '@/utils/mindmap/mindmapLayout';
import { moveNode, setOffset, toggleCollapsed } from '@/utils/mindmap/mindmapTree';
import {
  crossLinkGeometry,
  crossLinkHeadPoints,
  crossLinkLines,
  crossLinkOutline,
  crossLinkPath,
  isCrossLinkKey,
} from './mindmapCrossLinks';
import {
  addCrossLink,
  pruneCrossLinks,
  removeCrossLink,
  removeNodeFromDoc,
  reverseCrossLink,
  sanitizeMindmapDoc,
  setCrossLinkArrow,
  setCrossLinkColor,
  setCrossLinkLabel,
} from './mindmapDoc';

/*
 * Tvärlänkar (docs/plans/mindmap-sida.md, steg 6): reglerna för vilka som
 * får finnas, och formen de ritas med på skärmen och i exporten.
 */

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});
const measure = (text: string) => text.length * 10;
const layout = (doc: MindmapDoc) => layoutMindmap(doc, measure);

const tree = (): MindmapDoc => ({
  root: n('R', [n('A', [n('A1'), n('A2')]), n('B', [n('B1')]), n('C')]),
});
const linked = (from: string, to: string, base: MindmapDoc = tree()) => {
  const result = addCrossLink(base, from, to)!;
  return { doc: result.doc, id: result.id };
};

describe('addCrossLink', () => {
  it('lägger till en länk med ett eget id', () => {
    const { doc, id } = linked('A1', 'B1');
    expect(doc.crossLinks).toEqual([{ id, from: 'A1', to: 'B1' }]);
    expect(id).toBeTruthy();
  });

  it('följer MindMups regler', () => {
    const base = tree();
    expect(addCrossLink(base, 'A', 'A')).toBeNull();
    expect(addCrossLink(base, 'A', 'A1')).toBeNull();
    expect(addCrossLink(base, 'A1', 'A')).toBeNull();
    expect(addCrossLink(base, 'A', 'finns-inte')).toBeNull();
    // Far- och barnbarn är inte förälder och barn, och syskon går bra.
    expect(addCrossLink(base, 'R', 'A1')).not.toBeNull();
    expect(addCrossLink(base, 'A1', 'A2')).not.toBeNull();
  });

  it('tillåter högst en länk per par, oavsett riktning', () => {
    const { doc } = linked('A1', 'B1');
    expect(addCrossLink(doc, 'A1', 'B1')).toBeNull();
    expect(addCrossLink(doc, 'B1', 'A1')).toBeNull();
    expect(addCrossLink(doc, 'A1', 'C')).not.toBeNull();
  });
});

describe('ändra en tvärlänk', () => {
  it('sätter och tar bort etiketten, klippt vid gränsen', () => {
    const { doc, id } = linked('A1', 'B1');
    expect(setCrossLinkLabel(doc, id, 'stöder').crossLinks![0].label).toBe('stöder');
    const long = setCrossLinkLabel(doc, id, 'x'.repeat(MAX_CROSS_LINK_LABEL_LENGTH + 20));
    expect(long.crossLinks![0].label).toHaveLength(MAX_CROSS_LINK_LABEL_LENGTH);
    const cleared = setCrossLinkLabel(setCrossLinkLabel(doc, id, 'x'), id, '   ');
    expect(Object.keys(cleared.crossLinks![0])).not.toContain('label');
  });

  it('pilen: to är förvalet och sparas inte', () => {
    const { doc, id } = linked('A1', 'B1');
    expect(setCrossLinkArrow(doc, id, 'both').crossLinks![0].arrow).toBe('both');
    expect(setCrossLinkArrow(doc, id, 'none').crossLinks![0].arrow).toBe('none');
    const back = setCrossLinkArrow(setCrossLinkArrow(doc, id, 'both'), id, 'to');
    expect(back.crossLinks![0]).toEqual({ id, from: 'A1', to: 'B1' });
  });

  it('vänder länken och behåller resten', () => {
    const { doc, id } = linked('A1', 'B1');
    const reversed = reverseCrossLink(setCrossLinkLabel(doc, id, 'x'), id);
    expect(reversed.crossLinks![0]).toEqual({ id, from: 'B1', to: 'A1', label: 'x' });
  });

  it('sätter och tar bort färgen', () => {
    const { doc, id } = linked('A1', 'B1');
    const green = setCrossLinkColor(doc, id, 'green');
    expect(green.crossLinks![0].color).toBe('green');
    expect(Object.keys(setCrossLinkColor(green, id, null).crossLinks![0])).not.toContain('color');
  });

  it('en länk som inte finns ändrar ingenting', () => {
    const { doc } = linked('A1', 'B1');
    expect(setCrossLinkLabel(doc, 'nej', 'x')).toBe(doc);
    expect(reverseCrossLink(doc, 'nej')).toBe(doc);
    expect(removeCrossLink(doc, 'nej')).toBe(doc);
  });

  it('removeCrossLink tar bort länken, och fältet med den sista', () => {
    const first = linked('A1', 'B1');
    const second = linked('A2', 'C', first.doc);
    const one = removeCrossLink(second.doc, first.id);
    expect(one.crossLinks).toEqual([{ id: second.id, from: 'A2', to: 'C' }]);
    expect(Object.keys(removeCrossLink(one, second.id))).not.toContain('crossLinks');
  });
});

describe('länkar när trädet ändras', () => {
  it('försvinner med noden, också när noden låg under den borttagna', () => {
    const first = linked('A1', 'B1');
    const second = linked('A2', 'C', first.doc);
    const third = linked('B', 'C', second.doc);
    const removed = removeNodeFromDoc(third.doc, 'A')!.doc;
    expect(removed.crossLinks).toEqual([{ id: third.id, from: 'B', to: 'C' }]);
  });

  it('tas bort när en flytt gör ändarna till förälder och barn', () => {
    const { doc } = linked('A1', 'B');
    const moved = { ...doc, ...moveNode(doc, 'A1', 'B')! };
    expect(pruneCrossLinks(moved).crossLinks).toEqual([]);
    // En flytt som inte rör reglerna lämnar dokumentet som det är.
    const other = { ...doc, ...moveNode(doc, 'C', 'A')! };
    expect(pruneCrossLinks(other)).toBe(other);
  });

  it('tvätten behåller färg och klipper etiketten', () => {
    const clean = sanitizeMindmapDoc({
      ...tree(),
      crossLinks: [
        { id: 'l1', from: 'A1', to: 'B1', color: 'pink', label: 'y'.repeat(200), arrow: 'both' },
        { id: 'l2', from: 'A2', to: 'C', color: 'neon' },
        { id: 'l3', from: 'A', to: 'A1' },
      ],
    });
    expect(clean.crossLinks).toEqual([
      { id: 'l1', from: 'A1', to: 'B1', color: 'pink', label: 'y'.repeat(MAX_CROSS_LINK_LABEL_LENGTH), arrow: 'both' },
      { id: 'l2', from: 'A2', to: 'C' },
    ]);
  });
});

describe('crossLinkGeometry', () => {
  const boxOf = (doc: MindmapDoc, id: string) => layout(doc).byId.get(id)!;
  const inside = (box: { x: number; y: number; width: number; height: number }, p: { x: number; y: number }) =>
    p.x > box.x && p.x < box.x + box.width && p.y > box.y && p.y < box.y + box.height;

  it('ger inga former utan länkar', () => {
    expect(crossLinkGeometry(layout(tree()), tree())).toEqual([]);
  });

  it('kurvan går från nodens kant till nodens kant, inte genom noderna', () => {
    const { doc, id } = linked('A1', 'C');
    const [shape] = crossLinkGeometry(layout(doc), doc);
    expect(shape.id).toBe(id);
    expect(shape.fromId).toBe('A1');
    expect(shape.toId).toBe('C');
    const from = boxOf(doc, 'A1');
    const to = boxOf(doc, 'C');
    expect(inside(from, shape.start)).toBe(false);
    expect(inside(to, shape.end)).toBe(false);
    // Ändarna ligger nära sina noder: inom luften runt rutan.
    expect(shape.start.x).toBeGreaterThanOrEqual(from.x - 5);
    expect(shape.start.x).toBeLessThanOrEqual(from.x + from.width + 5);
    expect(shape.end.y).toBeGreaterThanOrEqual(to.y - 5);
    expect(shape.end.y).toBeLessThanOrEqual(to.y + to.height + 5);
    expect(crossLinkPath(shape)).toBe(
      `M ${shape.start.x} ${shape.start.y} Q ${shape.control.x} ${shape.control.y} ${shape.end.x} ${shape.end.y}`,
    );
  });

  it('kurvan böjer åt sidan, och ligger kvar när länken vänds', () => {
    const { doc, id } = linked('A1', 'C');
    const [shape] = crossLinkGeometry(layout(doc), doc);
    const straight = { x: (shape.start.x + shape.end.x) / 2, y: (shape.start.y + shape.end.y) / 2 };
    expect(Math.hypot(shape.middle.x - straight.x, shape.middle.y - straight.y)).toBeGreaterThan(5);
    const reversed = reverseCrossLink(doc, id);
    const [flipped] = crossLinkGeometry(layout(reversed), reversed);
    expect(flipped.control.x).toBeCloseTo(shape.control.x);
    expect(flipped.control.y).toBeCloseTo(shape.control.y);
    expect(flipped.start.x).toBeCloseTo(shape.end.x);
    expect(flipped.fromId).toBe('C');
  });

  it('pilen sitter i slutet, i båda ändar eller inte alls', () => {
    const { doc, id } = linked('A1', 'C');
    const [to] = crossLinkGeometry(layout(doc), doc);
    expect(to.heads).toHaveLength(1);
    expect(to.heads[0][0]).toEqual(to.end);
    expect(crossLinkHeadPoints(to.heads[0]).split(' ')).toHaveLength(3);
    const both = setCrossLinkArrow(doc, id, 'both');
    const [two] = crossLinkGeometry(layout(both), both);
    expect(two.heads.map((head) => head[0])).toEqual([two.end, two.start]);
    const none = setCrossLinkArrow(doc, id, 'none');
    expect(crossLinkGeometry(layout(none), none)[0].heads).toEqual([]);
  });

  it('följer en gren som flyttats för hand', () => {
    const { doc } = linked('A1', 'C');
    const [before] = crossLinkGeometry(layout(doc), doc);
    const moved: MindmapDoc = { ...doc, ...setOffset(doc, 'C', { dx: 200, dy: 150 }) };
    const [after] = crossLinkGeometry(layout(moved), moved);
    const box = boxOf(moved, 'C');
    expect(after.end.x).not.toBeCloseTo(before.end.x);
    expect(after.end.x).toBeGreaterThanOrEqual(box.x - 5);
    expect(after.end.x).toBeLessThanOrEqual(box.x + box.width + 5);
    expect(after.end.y).toBeGreaterThanOrEqual(box.y - 5);
    expect(after.end.y).toBeLessThanOrEqual(box.y + box.height + 5);
  });

  it('en ände i en hopfälld gren ritas till den synliga förfadern', () => {
    const { doc } = linked('A1', 'C');
    const collapsed: MindmapDoc = { ...doc, ...toggleCollapsed(doc, 'A')! };
    const [shape] = crossLinkGeometry(layout(collapsed), collapsed);
    expect(shape.fromId).toBe('A');
    expect(shape.toId).toBe('C');
    expect(shape.link.from).toBe('A1');
  });

  it('ritar inte en länk vars ändar hamnar på samma nod eller på förälder och barn', () => {
    // A1–A2 under en hopfälld A: båda ändar på A.
    const same = linked('A1', 'A2').doc;
    const sameCollapsed: MindmapDoc = { ...same, ...toggleCollapsed(same, 'A')! };
    expect(crossLinkGeometry(layout(same), same)).toHaveLength(1);
    expect(crossLinkGeometry(layout(sameCollapsed), sameCollapsed)).toEqual([]);
    // R–A1 med A hopfälld: ändarna blir R och A, förälder och barn.
    const up = linked('R', 'A1').doc;
    const upCollapsed: MindmapDoc = { ...up, ...toggleCollapsed(up, 'A')! };
    expect(crossLinkGeometry(layout(upCollapsed), upCollapsed)).toEqual([]);
    // Länken finns kvar i dokumentet och ritas igen när grenen fälls ut.
    expect(upCollapsed.crossLinks).toHaveLength(1);
  });
});

describe('tvärlänkarna i dispositionen', () => {
  it('skriver en rad per länk, med pilens form och etiketten', () => {
    const first = linked('A1', 'B1');
    const second = linked('A2', 'C', setCrossLinkLabel(first.doc, first.id, 'stöder'));
    const third = linked('B', 'C', setCrossLinkArrow(second.doc, second.id, 'both'));
    const doc = setCrossLinkArrow(third.doc, third.id, 'none');
    expect(crossLinkLines(doc)).toEqual(['A1 → B1: stöder', 'A2 ↔ C', 'B – C']);
    const outline = crossLinkOutline(doc);
    expect(outline.text).toBe('\n\nLänkar:\n- A1 → B1: stöder\n- A2 ↔ C\n- B – C');
    expect(outline.html).toBe('<p><strong>Länkar</strong></p><ul><li>A1 → B1: stöder</li><li>A2 ↔ C</li><li>B – C</li></ul>');
  });

  it('skyddar tecknen i HTML och hoppar över noder utan text', () => {
    const base: MindmapDoc = { root: n('R', [n('a', [], { label: 'A & <b>' }), n('b', [], { label: '  ' }), n('c', [], { label: 'C' })]) };
    const first = linked('a', 'c', base);
    const doc = linked('b', 'c', first.doc).doc;
    expect(crossLinkOutline(doc).html).toContain('<li>A &amp; &lt;b&gt; → C</li>');
    expect(crossLinkLines(doc)).toHaveLength(1);
  });

  it('en karta utan länkar får ingenting tillagt', () => {
    expect(crossLinkOutline(tree())).toEqual({ text: '', html: '' });
  });
});

describe('isCrossLinkKey', () => {
  const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
    key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods,
  });

  it('är Ctrl+L eller Cmd+L, inget annat', () => {
    expect(isCrossLinkKey(key('l', { ctrlKey: true }))).toBe(true);
    expect(isCrossLinkKey(key('L', { metaKey: true }))).toBe(true);
    expect(isCrossLinkKey(key('l'))).toBe(false);
    expect(isCrossLinkKey(key('l', { altKey: true }))).toBe(false);
    expect(isCrossLinkKey(key('l', { ctrlKey: true, altKey: true }))).toBe(false);
    expect(isCrossLinkKey(key('l', { ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isCrossLinkKey(key('k', { ctrlKey: true }))).toBe(false);
  });
});
