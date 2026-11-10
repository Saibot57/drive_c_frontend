import { describe, expect, it } from 'vitest';
import type { MindmapContent, MindmapNode } from '@/types/mindmap';
import { edgePath, layoutMindmap, MINDMAP_METRICS as M } from './mindmapLayout';

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});

/** Tio pixlar per tecken: lätt att räkna med för hand. */
const measure = (text: string) => text.length * 10;

describe('layoutMindmap', () => {
  it('lägger en ensam rot i marginalen', () => {
    const layout = layoutMindmap({ root: n('Rot') }, measure);
    const root = layout.byId.get('Rot')!;
    expect(root.x).toBe(M.margin);
    expect(root.y).toBe(M.margin);
    expect(root.width).toBe(30 + M.slack + 2 * M.rootPadX + 2 * M.rootBorder);
    expect(layout.width).toBe(root.width + 2 * M.margin);
    expect(layout.edges).toEqual([]);
  });

  it('lägger barnen till höger, under varandra och centrerade mot föräldern', () => {
    const layout = layoutMindmap({ root: n('R', [n('A'), n('B')]) }, measure);
    const root = layout.byId.get('R')!;
    const a = layout.byId.get('A')!;
    const b = layout.byId.get('B')!;
    expect(a.x).toBe(root.x + root.width + M.hGap);
    expect(b.y).toBe(a.y + M.nodeHeight + M.vGap);
    expect((a.y + b.y + M.nodeHeight) / 2).toBeCloseTo(root.y + root.height / 2);
    expect(layout.edges.map((e) => e.toId)).toEqual(['A', 'B']);
    expect(layout.edges[0].x1).toBe(root.x + root.width);
    expect(layout.edges[0].x2).toBe(a.x);
  });

  it('ger en gren den höjd dess barn behöver, så att grenarna inte överlappar', () => {
    const layout = layoutMindmap({ root: n('R', [n('A', [n('A1'), n('A2'), n('A3')]), n('B')]) }, measure);
    const a3 = layout.byId.get('A3')!;
    const b = layout.byId.get('B')!;
    expect(b.y).toBeGreaterThanOrEqual(a3.y + M.nodeHeight + M.vGap);
  });

  it('ritar inte gömda barn och räknar dem i stället', () => {
    const layout = layoutMindmap({ root: n('R', [n('A', [n('A1', [n('A11')])], { collapsed: true })]) }, measure);
    expect(layout.byId.has('A1')).toBe(false);
    const a = layout.byId.get('A')!;
    expect(a.hiddenCount).toBe(2);
    expect(a.width).toBe(M.minLabelWidth + 2 * M.padX + 2 * M.border + M.badgeWidth);
  });

  it('lägger vänstergrenar till vänster om roten i layouten both', () => {
    const content: MindmapContent = {
      root: n('R', [n('A', [], { side: 'right' }), n('B', [n('B1')], { side: 'left' })]),
      layout: 'both',
    };
    const layout = layoutMindmap(content, measure);
    const root = layout.byId.get('R')!;
    const b = layout.byId.get('B')!;
    const b1 = layout.byId.get('B1')!;
    expect(b.x + b.width).toBe(root.x - M.hGap);
    expect(b1.x + b1.width).toBe(b.x - M.hGap);
    expect(layout.byId.get('A')!.x).toBe(root.x + root.width + M.hGap);
    expect(Math.min(...layout.nodes.map((node) => node.x))).toBe(M.margin);
  });

  it('ger en tom nod en bredd att klicka på', () => {
    const layout = layoutMindmap({ root: n('R', [{ id: 'x', label: '', children: [] }]) }, measure);
    expect(layout.byId.get('x')!.labelWidth).toBe(M.minLabelWidth);
  });
});

describe('edgePath', () => {
  it('ritar en kurva mellan kanterna', () => {
    expect(edgePath({ fromId: 'a', toId: 'b', x1: 0, y1: 0, x2: 40, y2: 20 }))
      .toBe('M 0 0 C 20 0, 20 20, 40 20');
  });
});
