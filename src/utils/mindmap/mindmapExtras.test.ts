// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { MindmapContent, MindmapNode } from '@/types/mindmap';
import { MINDMAP_NOTE_MAX_LENGTH } from '@/types/mindmap';
import {
  layoutMindmap,
  MINDMAP_EXTRA_METRICS as X,
  MINDMAP_METRICS as M,
  mindmapImageSize,
} from './mindmapLayout';
import { parseOutlineHtml, toOutlineHtml, toOutlineText } from './mindmapOutline';
import {
  cloneWithNewIds,
  findNode,
  sanitizeMindmap,
  setColorDeep,
  setIcon,
  setImage,
  setLink,
  setNote,
} from './mindmapTree';

/*
 * Mindmap-sidans tillägg i den delade kärnan (docs/plans/mindmap-sida.md,
 * steg 4). Allt här är valfritt: utan `extras` och `notes` ska layouten och
 * dispositionen bli exakt som workspace-kortet alltid fått dem.
 */

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id, label: id, children, ...extra,
});
const measure = (text: string) => text.length * 10;
const image = { source: { kind: 'url' as const, url: 'https://example.org/a.png' }, width: 100, aspect: 0.5 };

const tree = (): MindmapContent => ({
  root: n('R', [n('A', [n('A1'), n('A2', [n('A2x')])]), n('B')]),
});

describe('setNote, setLink, setImage och setIcon', () => {
  it('sätter fältet på rätt nod och lämnar resten av trädet orört', () => {
    const before = tree();
    const after = setNote(before, 'A1', 'En text');
    expect(findNode(after.root, 'A1')!.note).toBe('En text');
    expect(findNode(after.root, 'B')).toBe(findNode(before.root, 'B'));
    expect(findNode(before.root, 'A1')!.note).toBeUndefined();

    expect(findNode(setLink(before, 'B', 'https://example.org').root, 'B')!.link).toBe('https://example.org');
    expect(findNode(setImage(before, 'B', image).root, 'B')!.image).toEqual(image);
    expect(findNode(setIcon(before, 'R', 'flag').root, 'R')!.icon).toBe('flag');
  });

  it('tar bort fältet helt med null eller tom text', () => {
    const full = setIcon(setImage(setLink(setNote(tree(), 'B', 'x'), 'B', 'https://a.se'), 'B', image), 'B', 'star');
    const cleared = setIcon(setImage(setLink(setNote(full, 'B', ''), 'B', null), 'B', null), 'B', null);
    expect(findNode(cleared.root, 'B')).toEqual({ id: 'B', label: 'B', children: [] });
    expect(Object.keys(findNode(setNote(full, 'B', null).root, 'B')!)).not.toContain('note');
  });

  it('att ta bort något som inte finns ändrar ingenting', () => {
    const before = tree();
    expect(setNote(before, 'B', null).root).toBe(before.root);
    expect(setIcon(before, 'B', null).root).toBe(before.root);
  });

  it('klipper en anteckning som är för lång', () => {
    const after = setNote(tree(), 'B', 'x'.repeat(MINDMAP_NOTE_MAX_LENGTH + 50));
    expect(findNode(after.root, 'B')!.note).toHaveLength(MINDMAP_NOTE_MAX_LENGTH);
  });
});

describe('setColorDeep', () => {
  it('färgar noden och alla under den, men inget annat', () => {
    const after = setColorDeep(tree(), 'A', 'blue');
    ['A', 'A1', 'A2', 'A2x'].forEach((id) => expect(findNode(after.root, id)!.color).toBe('blue'));
    expect(findNode(after.root, 'B')!.color).toBeUndefined();
    expect(after.root.color).toBeUndefined();
  });

  it('tar bort färgen i hela grenen med null, också i en hopfälld gren', () => {
    const colored = setColorDeep({ root: n('R', [n('A', [n('A1')], { collapsed: true })]) }, 'R', 'pink');
    expect(findNode(colored.root, 'A1')!.color).toBe('pink');
    const cleared = setColorDeep(colored, 'A', null);
    expect(findNode(cleared.root, 'A')).toEqual({ id: 'A', label: 'A', collapsed: true, children: [{ id: 'A1', label: 'A1', children: [] }] });
    expect(cleared.root.color).toBe('pink');
  });
});

describe('cloneWithNewIds', () => {
  it('ger nya id i hela grenen och behåller allt annat', () => {
    const original = n('A', [n('A1', [], { note: 'text', image })], { color: 'green', icon: 'star', link: 'https://a.se', collapsed: true });
    const copy = cloneWithNewIds(original);
    expect(copy.id).not.toBe('A');
    expect(copy.children[0].id).not.toBe('A1');
    expect(copy.id).not.toBe(copy.children[0].id);
    expect({ ...copy, id: 'A', children: [{ ...copy.children[0], id: 'A1' }] }).toEqual(original);
    expect(original.id).toBe('A');
  });
});

describe('sanitizeMindmap och bildens mått', () => {
  it('behåller aspect när den är ett positivt tal', () => {
    const clean = sanitizeMindmap({ root: { id: 'r', label: 'R', children: [], image } });
    expect(clean.root.image).toEqual(image);
    const bad = sanitizeMindmap({ root: { id: 'r', label: 'R', children: [], image: { ...image, aspect: -1 } } });
    expect(bad.root.image).toEqual({ source: image.source, width: 100 });
    const text = sanitizeMindmap({ root: { id: 'r', label: 'R', children: [], image: { ...image, aspect: '0.5' } } });
    expect(text.root.image?.aspect).toBeUndefined();
  });
});

describe('layoutMindmap med tillägg', () => {
  const withExtras = (content: MindmapContent) => layoutMindmap(content, measure, M, { extras: true });

  it('utan extras blir layouten densamma med och utan fälten', () => {
    const plain: MindmapContent = { root: n('R', [n('A'), n('B')]) };
    const rich: MindmapContent = {
      root: n('R', [n('A', [], { icon: 'star', note: 'x', link: 'https://a.se', image }), n('B')], { image }),
    };
    const a = layoutMindmap(plain, measure);
    const b = layoutMindmap(rich, measure);
    expect(b.width).toBe(a.width);
    expect(b.height).toBe(a.height);
    expect(b.nodes.map(({ x, y, width, height }) => ({ x, y, width, height })))
      .toEqual(a.nodes.map(({ x, y, width, height }) => ({ x, y, width, height })));
    expect(b.byId.get('A')).toEqual(a.byId.get('A'));
  });

  it('med extras men utan fält blir måtten som förut', () => {
    const content = tree();
    const a = layoutMindmap(content, measure);
    const b = withExtras(content);
    expect(b.nodes.map(({ x, y, width, height }) => ({ x, y, width, height })))
      .toEqual(a.nodes.map(({ x, y, width, height }) => ({ x, y, width, height })));
    expect(b.edges).toEqual(a.edges);
  });

  it('ger plats för ikon och symboler på raden', () => {
    const base = withExtras({ root: n('R', [n('A')]) }).byId.get('A')!;
    const node = withExtras({ root: n('R', [n('A', [], { icon: 'star', note: 'x', link: 'https://a.se' })]) }).byId.get('A')!;
    expect(node.width).toBe(base.width + X.iconWidth + 2 * X.markerWidth);
    expect(node.height).toBe(base.height);
    expect(node.icon).toBe('star');
    expect(node.hasNote).toBe(true);
    expect(node.link).toBe('https://a.se');
    expect(node.contentX).toBe(M.border + M.padX);
    expect(node.image).toBeUndefined();
  });

  it('en nod med bild blir högre, och bred nog för bilden', () => {
    const node = withExtras({ root: n('R', [n('A', [], { image })]) }).byId.get('A')!;
    expect(node.height).toBe(M.nodeHeight + 50 + X.imagePad);
    expect(node.width).toBe(100 + 2 * (X.imagePad + M.border));
    expect(node.rowHeight).toBe(M.nodeHeight);
    expect(node.image).toEqual({ x: (node.width - 100) / 2, y: M.nodeHeight - M.border, width: 100, height: 50 });
    // Raden centreras över bilden.
    const rowWidth = 10 + M.slack > M.minLabelWidth ? 0 : M.minLabelWidth + 2 * M.padX + 2 * M.border;
    expect(node.contentX).toBe((node.width - rowWidth) / 2 + M.border + M.padX);
  });

  it('syskonen flyttar sig för en nod med bild, utan att överlappa', () => {
    const layout = withExtras({ root: n('R', [n('A'), n('B', [], { image }), n('C')]) });
    const [a, b, c] = ['A', 'B', 'C'].map((id) => layout.byId.get(id)!);
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height + M.vGap);
    expect(c.y).toBeGreaterThanOrEqual(b.y + b.height + M.vGap);
    // Roten står mitt för sina barn.
    const root = layout.byId.get('R')!;
    expect(root.y + root.height / 2).toBeCloseTo((a.y + c.y + c.height) / 2);
  });

  it('en förälder med bild som är högre än sina barn får hela sin höjd', () => {
    const tall = { ...image, width: 200, aspect: 2 };
    const layout = withExtras({ root: n('R', [n('A', [n('A1')], { image: tall }), n('B')]) });
    const a = layout.byId.get('A')!;
    const b = layout.byId.get('B')!;
    expect(a.height).toBe(M.nodeHeight + 400 + X.imagePad);
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height + M.vGap);
    expect(layout.height).toBeGreaterThanOrEqual(a.height + b.height + M.vGap + 2 * M.margin);
  });

  it('roten kan ha en bild', () => {
    const root = withExtras({ root: n('R', [n('A')], { image }) }).byId.get('R')!;
    expect(root.height).toBe(M.rootHeight + 50 + X.imagePad);
    expect(root.image?.y).toBe(M.rootHeight - M.rootBorder);
  });
});

describe('mindmapImageSize', () => {
  it('räknar höjden ur bredd och aspect, med förval när de saknas', () => {
    expect(mindmapImageSize({ source: image.source, width: 200, aspect: 0.5 })).toEqual({ width: 200, height: 100 });
    expect(mindmapImageSize({ source: image.source })).toEqual({ width: X.imageWidth, height: X.imageWidth * X.imageAspect });
  });

  it('håller bredden och formen inom gränserna', () => {
    expect(mindmapImageSize({ source: image.source, width: 5 }).width).toBe(X.minImageWidth);
    expect(mindmapImageSize({ source: image.source, width: 5000 }).width).toBe(X.maxImageWidth);
    expect(mindmapImageSize({ source: image.source, width: 100, aspect: 50 }).height).toBe(400);
  });
});

describe('dispositionen med anteckningar', () => {
  const sample = n('Kriget', [
    n('Orsaker', [n('Versailles', [], { note: 'Fredsvillkoren 1919' })], { note: 'Två rader\n\n  varav en <tom>' }),
    n('Följder'),
  ], { note: 'Översikt' });

  it('utan notes blir dispositionen som förut', () => {
    const bare = n('Kriget', [n('Orsaker', [n('Versailles')]), n('Följder')]);
    expect(toOutlineText(sample)).toBe(toOutlineText(bare));
    expect(toOutlineHtml(sample, 'list')).toBe(toOutlineHtml(bare, 'list'));
    expect(toOutlineHtml(sample, 'headings')).toBe(toOutlineHtml(bare, 'headings'));
  });

  it('texten får anteckningen som indrag under noden', () => {
    expect(toOutlineText(sample, { notes: true })).toBe([
      'Kriget',
      '  Översikt',
      '- Orsaker',
      '  Två rader',
      '  varav en <tom>',
      '  - Versailles',
      '    Fredsvillkoren 1919',
      '- Följder',
    ].join('\n'));
  });

  it('listan får anteckningen i kursiv under punkten, med tecknen skyddade', () => {
    const html = toOutlineHtml(sample, 'list', { notes: true });
    expect(html).toContain('<p><strong>Kriget</strong></p><p><i>Översikt</i></p>');
    expect(html).toContain('<li>Orsaker<br><i>Två rader<br>varav en &lt;tom&gt;</i><ul>');
    expect(html).toContain('<li>Versailles<br><i>Fredsvillkoren 1919</i></li>');
    expect(html).toContain('<li>Följder</li>');
  });

  it('rubrikerna får anteckningen som ett stycke efter rubriken', () => {
    const html = toOutlineHtml(sample, 'headings', { notes: true });
    expect(html).toContain('<h1>Kriget</h1><p><i>Översikt</i></p>');
    expect(html).toContain('<h2>Orsaker</h2><p><i>Två rader<br>varav en &lt;tom&gt;</i></p>');
    expect(html).toContain('<h3>Versailles</h3><p><i>Fredsvillkoren 1919</i></p>');
  });

  it('listan går fortfarande att läsa in som en disposition', () => {
    const doc = new DOMParser().parseFromString(toOutlineHtml(sample, 'list', { notes: true }), 'text/html');
    expect(parseOutlineHtml(doc)?.map((node) => node.label.startsWith('Orsaker') || node.label === 'Följder')).toEqual([true, true]);
  });
});
