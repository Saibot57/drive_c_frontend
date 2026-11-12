import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import { resolveMindmapKey } from '@/utils/mindmap/mindmapKeys';
import { layoutMindmap, MINDMAP_METRICS as M, type MindmapWrap } from '@/utils/mindmap/mindmapLayout';
import { clampTextWidth, findNode, sanitizeMindmap, setTextWidth } from '@/utils/mindmap/mindmapTree';
import { resolveViewportKey } from '@/utils/mindmapViewport';
import { resolveBranchKey } from '@/utils/mindmapBranch';
import { draggedTextWidth, MINDMAP_WIDTH_STEP, resolveWidthKey, steppedTextWidth } from '@/utils/mindmapNodeWidth';

const n = (id: string, label: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode =>
  ({ id, label, children, ...extra });
const measure = (text: string) => text.length * 10;
const WRAP: MindmapWrap = { maxWidth: 100, rootMaxWidth: 150, lineHeight: 18, rootLineHeight: 22 };

const key = (k: string, mods: Partial<{ shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) => ({
  key: k, code: '', shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...mods,
});

describe('textWidth i tvätten', () => {
  it('avrundar och håller bredden inom 80–600', () => {
    const content = sanitizeMindmap({
      root: { id: 'r', label: 'R', textWidth: 200.4, children: [
        { id: 'a', label: 'A', textWidth: 10, children: [] },
        { id: 'b', label: 'B', textWidth: 9000, children: [] },
        { id: 'c', label: 'C', textWidth: '200', children: [] },
        { id: 'd', label: 'D', textWidth: Number.NaN, children: [] },
      ] },
    });
    expect(content.root.textWidth).toBe(200);
    expect(findNode(content.root, 'a')!.textWidth).toBe(80);
    expect(findNode(content.root, 'b')!.textWidth).toBe(600);
    expect('textWidth' in findNode(content.root, 'c')!).toBe(false);
    expect('textWidth' in findNode(content.root, 'd')!).toBe(false);
  });

  it('lämnar en nod utan bredd som förut', () => {
    const content = sanitizeMindmap({ root: { id: 'r', label: 'R', children: [] } });
    expect(content.root).toEqual({ id: 'r', label: 'R', children: [] });
  });
});

describe('setTextWidth', () => {
  it('sätter, håller inom gränserna och tar bort bredden', () => {
    const content = { root: n('r', 'R', [n('a', 'A')]) };
    const set = setTextWidth(content, 'a', 1000);
    expect(findNode(set.root, 'a')!.textWidth).toBe(600);
    const cleared = setTextWidth(set, 'a', null);
    expect('textWidth' in findNode(cleared.root, 'a')!).toBe(false);
  });

  it('klämmer som tvätten', () => {
    expect(clampTextWidth(79.6)).toBe(80);
    expect(clampTextWidth(123.5)).toBe(124);
  });
});

describe('layouten med egen bredd', () => {
  it('bryter vid nodens egen bredd', () => {
    const layout = layoutMindmap(
      { root: n('r', 'R', [n('a', 'ett två tre fyra', [], { textWidth: 80 })]) },
      measure, M, { wrap: WRAP },
    );
    expect(layout.byId.get('a')!.lines).toEqual(['ett två', 'tre fyra']);
  });

  it('gör noden så bred som sin egen bredd, också med kort text', () => {
    const layout = layoutMindmap({ root: n('r', 'R', [n('a', 'kort', [], { textWidth: 200 })]) }, measure, M, { wrap: WRAP });
    const a = layout.byId.get('a')!;
    expect(a.labelWidth).toBe(200);
    expect(a.lines).toEqual(['kort']);
  });

  it('låter en bredare egen bredd ge en lång etikett färre rader än standarden', () => {
    const label = 'ett två tre fyra fem sex';
    const plain = layoutMindmap({ root: n('r', 'R', [n('a', label)]) }, measure, M, { wrap: WRAP });
    const wide = layoutMindmap({ root: n('r', 'R', [n('a', label, [], { textWidth: 300 })]) }, measure, M, { wrap: WRAP });
    expect(plain.byId.get('a')!.lines!.length).toBe(3);
    expect(wide.byId.get('a')!.lines).toEqual([label]);
  });

  it('bryr sig inte om bredden utan wrap (workspace-kortet)', () => {
    const layout = layoutMindmap({ root: n('r', 'R', [n('a', 'kort', [], { textWidth: 200 })]) }, measure);
    expect(layout.byId.get('a')!.labelWidth).toBe(40 + M.slack);
  });
});

describe('resolveWidthKey', () => {
  it('läser Ctrl+Shift+← och → och Cmd+Shift på Mac', () => {
    expect(resolveWidthKey(key('ArrowLeft', { ctrlKey: true, shiftKey: true }))).toBe('narrower');
    expect(resolveWidthKey(key('ArrowRight', { metaKey: true, shiftKey: true }))).toBe('wider');
  });

  it('lämnar allt annat', () => {
    expect(resolveWidthKey(key('ArrowLeft', { ctrlKey: true }))).toBeNull();
    expect(resolveWidthKey(key('ArrowLeft', { altKey: true, shiftKey: true }))).toBeNull();
    expect(resolveWidthKey(key('ArrowLeft', { ctrlKey: true, shiftKey: true, altKey: true }))).toBeNull();
    expect(resolveWidthKey(key('ArrowUp', { ctrlKey: true, shiftKey: true }))).toBeNull();
  });

  it('krockar inte med kartans, vyns eller grenvyns tangenter', () => {
    const ctx = { isRoot: false, parentIsRoot: false, labelEmpty: false, hasChildren: false, hasPreviousSibling: true };
    ['ArrowLeft', 'ArrowRight'].forEach((k) => {
      const e = key(k, { ctrlKey: true, shiftKey: true });
      expect(resolveMindmapKey(e, 'nav', ctx)).toBeNull();
      expect(resolveViewportKey(e)).toBeNull();
      expect(resolveBranchKey(e, true)).toBeNull();
    });
  });
});

describe('steppedTextWidth', () => {
  it('går ett steg och stannar vid gränserna', () => {
    expect(steppedTextWidth(200, 'wider')).toBe(200 + MINDMAP_WIDTH_STEP);
    expect(steppedTextWidth(200, 'narrower')).toBe(200 - MINDMAP_WIDTH_STEP);
    expect(steppedTextWidth(90, 'narrower')).toBe(80);
    expect(steppedTextWidth(590, 'wider')).toBe(600);
  });
});

describe('draggedTextWidth', () => {
  it('följer pekaren till höger om roten, i kartans pixlar', () => {
    expect(draggedTextWidth(200, 50, 1, 'right')).toBe(250);
    expect(draggedTextWidth(200, 50, 2, 'right')).toBe(225);
    expect(draggedTextWidth(200, 50, 0.5, 'right')).toBe(300);
  });

  it('växer åt vänster till vänster om roten', () => {
    expect(draggedTextWidth(200, -50, 1, 'left')).toBe(250);
  });

  it('ger roten dubbla vägen, eftersom den växer åt båda håll', () => {
    expect(draggedTextWidth(200, 50, 1, null)).toBe(300);
  });

  it('håller sig inom gränserna', () => {
    expect(draggedTextWidth(200, -1000, 1, 'right')).toBe(80);
    expect(draggedTextWidth(200, 1000, 1, 'right')).toBe(600);
  });
});
