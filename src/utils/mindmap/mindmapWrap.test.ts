import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import {
  layoutMindmap,
  MINDMAP_METRICS as M,
  wrapLabel,
  wrapLabelLines,
  type MindmapWrap,
} from './mindmapLayout';
import { toOutlineHtml, toOutlineText } from './mindmapOutline';
import { labelOneLine } from './mindmapTree';

/** Tio pixlar per tecken: lätt att räkna med för hand. */
const measure = (text: string) => text.length * 10;
const n = (id: string, label: string, children: MindmapNode[] = []): MindmapNode => ({ id, label, children });

/** Smal radbrytning för testerna: 100 px är tio tecken. */
const WRAP: MindmapWrap = { maxWidth: 100, rootMaxWidth: 150, lineHeight: 18, rootLineHeight: 22 };

describe('wrapLabel', () => {
  it('lämnar en kort etikett hel', () => {
    expect(wrapLabel('kort text', 100, measure)).toEqual(['kort text']);
  });

  it('bryter vid mellanslag så att ingen rad blir för bred', () => {
    expect(wrapLabel('ett två tre fyra fem', 100, measure)).toEqual(['ett två', 'tre fyra', 'fem']);
  });

  it('bryter vid varje radbrytning och behåller tomma rader', () => {
    expect(wrapLabel('a\n\nb', 100, measure)).toEqual(['a', '', 'b']);
    expect(wrapLabel('a\n', 100, measure)).toEqual(['a', '']);
  });

  it('delar ett ord som ensamt är för brett mellan tecknen', () => {
    expect(wrapLabel('abcdefghijklmnopqrstuvwxy z', 100, measure)).toEqual(['abcdefghij', 'klmnopqrst', 'uvwxy z']);
  });

  it('ger en tom rad för en tom etikett', () => {
    expect(wrapLabel('', 100, measure)).toEqual(['']);
  });

  it('ger var varje rad börjar i etiketten', () => {
    expect(wrapLabelLines('ett två tre\nfyra', 70, measure)).toEqual([
      { text: 'ett två', start: 0 },
      { text: 'tre', start: 8 },
      { text: 'fyra', start: 12 },
    ]);
  });
});

describe('layoutMindmap med wrap', () => {
  it('ger en lång etikett flera rader och en högre nod', () => {
    const layout = layoutMindmap({ root: n('R', 'R', [n('A', 'ett två tre fyra fem')]) }, measure, M, { wrap: WRAP });
    const a = layout.byId.get('A')!;
    expect(a.lines).toEqual(['ett två', 'tre fyra', 'fem']);
    expect(a.lineHeight).toBe(18);
    expect(a.labelWidth).toBe(80 + M.slack);
    expect(a.height).toBe(M.nodeHeight + 2 * 18);
  });

  it('bryter roten vid sin egen bredd och med sin egen radhöjd', () => {
    const layout = layoutMindmap({ root: n('R', 'abcdefghijklmnopqrst') }, measure, M, { wrap: WRAP });
    const root = layout.byId.get('R')!;
    expect(root.lines).toEqual(['abcdefghijklmno', 'pqrst']);
    expect(root.height).toBe(M.rootHeight + 22);
  });

  it('ger grenen plats för en nod med flera rader', () => {
    const layout = layoutMindmap(
      { root: n('R', 'R', [n('A', 'a\nb\nc'), n('B', 'B')]) },
      measure,
      M,
      { wrap: WRAP },
    );
    const a = layout.byId.get('A')!;
    const b = layout.byId.get('B')!;
    expect(a.height).toBe(M.nodeHeight + 2 * 18);
    expect(b.y).toBe(a.y + a.height + M.vGap);
  });

  it('ger en etikett på en rad samma mått som utan wrap', () => {
    const content = { root: n('R', 'Rot', [n('A', 'kort'), n('B', '')]) };
    const plain = layoutMindmap(content, measure);
    const wrapped = layoutMindmap(content, measure, M, { wrap: WRAP });
    wrapped.nodes.forEach((node) => {
      const before = plain.byId.get(node.id)!;
      expect([node.x, node.y, node.width, node.height, node.labelWidth])
        .toEqual([before.x, before.y, before.width, before.height, before.labelWidth]);
    });
  });
});

describe('layoutMindmap utan wrap (workspace-kortet)', () => {
  it('lägger en lång etikett och en med radbrytning på en rad, som förut', () => {
    const long = 'ett två tre fyra fem sex sju åtta nio tio';
    const layout = layoutMindmap({ root: n('R', 'R', [n('A', long), n('B', 'a\nb')]) }, measure);
    const a = layout.byId.get('A')!;
    const b = layout.byId.get('B')!;
    expect(a.labelWidth).toBe(long.length * 10 + M.slack);
    expect(a.height).toBe(M.nodeHeight);
    expect(b.labelWidth).toBe(3 * 10 + M.slack);
    expect(b.height).toBe(M.nodeHeight);
    expect('lines' in a || 'lines' in b || 'lineHeight' in a).toBe(false);
  });
});

describe('labelOneLine', () => {
  it('gör radbrytningar till ett mellanslag och trimmar', () => {
    expect(labelOneLine('  ett \n två\r\n\ntre  ')).toBe('ett två tre');
    expect(labelOneLine(' ingen brytning ')).toBe('ingen brytning');
  });
});

describe('dispositionen med radbrytningar', () => {
  const root = n('R', 'Rot\nmed två rader', [n('A', 'Första\nraden', [n('A1', 'Under')])]);

  it('skriver varje nod på en rad, så att indraget håller', () => {
    expect(toOutlineText(root)).toBe('Rot med två rader\n- Första raden\n  - Under');
  });

  it('skriver HTML-listan och rubrikerna utan radbrytning', () => {
    expect(toOutlineHtml(root, 'list')).toBe(
      '<p><strong>Rot med två rader</strong></p><ul><li>Första raden<ul><li>Under</li></ul></li></ul>',
    );
    expect(toOutlineHtml(root, 'headings')).toContain('<h2>Första raden</h2>');
  });
});
