import { describe, expect, it } from 'vitest';
import type { MindmapContent, MindmapNode } from '@/types/mindmap';
import { MINDMAP_NOTE_MAX_LENGTH } from '@/types/mindmap';
import {
  addChild,
  addSibling,
  findNode,
  indent,
  moveAmongSiblings,
  moveNode,
  outdent,
  sanitizeMindmap,
  setColor,
  setLabel,
  toggleCollapsed,
} from './mindmapTree';

/*
 * Mindmap-sidans fält på noderna (docs/plans/mindmap-sida.md, steg 0):
 * note, link, image, icon och offset. Tvätten ska behålla dem när de har
 * rätt form, släppa dem annars, och trädoperationerna ska låta dem följa
 * med noden. En karta utan fälten ska bli exakt som förut.
 */

const FIELDS: Partial<MindmapNode> = {
  note: 'En längre text',
  link: 'https://example.org/sida',
  image: { source: { kind: 'url', url: 'https://example.org/bild.png' }, width: 120 },
  icon: 'star',
  offset: { dx: 40, dy: -12.5 },
};

const node = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode =>
  ({ id, label: id.toUpperCase(), children, ...extra });

const tree = (): MindmapContent => ({
  root: node('r', [
    node('a', [node('a1', [], FIELDS), node('a2')]),
    node('b', [], FIELDS),
  ]),
  layout: 'right',
});

describe('sanitizeMindmap: sidans fält', () => {
  it('behåller fält med rätt form', () => {
    const content = sanitizeMindmap({ root: { id: 'r', label: 'R', children: [{ id: 'a', label: 'A', ...FIELDS }] } });
    const a = content.root.children[0];
    expect(a.note).toBe(FIELDS.note);
    expect(a.link).toBe(FIELDS.link);
    expect(a.image).toEqual(FIELDS.image);
    expect(a.icon).toBe('star');
    expect(a.offset).toEqual({ dx: 40, dy: -12.5 });
  });

  it('behåller en Drive-bild utan bredd', () => {
    const content = sanitizeMindmap({
      root: { id: 'r', label: 'R', children: [{ id: 'a', label: 'A', image: { source: { kind: 'gdrive', fileId: 'abc' } } }] },
    });
    expect(content.root.children[0].image).toEqual({ source: { kind: 'gdrive', fileId: 'abc' } });
  });

  it('släpper fält med fel form', () => {
    const content = sanitizeMindmap({
      root: {
        id: 'r',
        label: 'R',
        children: [{
          id: 'a',
          label: 'A',
          note: 42,
          link: 'javascript:alert(1)',
          image: { source: { kind: 'url', url: 'ftp://x' } },
          icon: 'unicorn',
          offset: { dx: 'tio', dy: 1 },
        }, {
          id: 'b',
          label: 'B',
          note: '',
          link: 'example.org',
          image: { source: { kind: 'gdrive' } },
          offset: { dx: 1, dy: Number.NaN },
        }, {
          id: 'c',
          label: 'C',
          image: { source: { kind: 'url', url: 'https://x/y.png' }, width: -3 },
        }],
      },
    });
    const [a, b, c] = content.root.children;
    expect(a).toEqual({ id: 'a', label: 'A', children: [] });
    expect(b).toEqual({ id: 'b', label: 'B', children: [] });
    expect(c.image).toEqual({ source: { kind: 'url', url: 'https://x/y.png' } });
  });

  it('klipper en för lång anteckning', () => {
    const content = sanitizeMindmap({
      root: { id: 'r', label: 'R', children: [], note: 'x'.repeat(MINDMAP_NOTE_MAX_LENGTH + 5) },
    });
    expect(content.root.note?.length).toBe(MINDMAP_NOTE_MAX_LENGTH);
  });

  it('ger exakt samma resultat som förut för en karta utan fälten', () => {
    const raw = {
      root: { id: '1', label: 'Rot', children: [{ id: '2', label: 'A', color: 'blue', collapsed: true, children: [{ id: '3', label: 'B', children: [] }] }] },
      layout: 'right',
    };
    expect(sanitizeMindmap(raw)).toEqual(raw);
    expect(Object.keys(sanitizeMindmap(raw).root.children[0]).sort()).toEqual(['children', 'collapsed', 'color', 'id', 'label']);
  });
});

describe('trädoperationerna bevarar sidans fält', () => {
  const expectFields = (content: MindmapContent, id: string) => {
    const found = findNode(content.root, id);
    expect(found).not.toBeNull();
    expect(found?.note).toBe(FIELDS.note);
    expect(found?.link).toBe(FIELDS.link);
    expect(found?.image).toEqual(FIELDS.image);
    expect(found?.icon).toBe(FIELDS.icon);
    expect(found?.offset).toEqual(FIELDS.offset);
  };

  it('moveNode', () => {
    const moved = moveNode(tree(), 'b', 'a1');
    expect(moved).not.toBeNull();
    expectFields(moved!, 'b');
    expectFields(moved!, 'a1');
  });

  it('indent och outdent', () => {
    const indented = indent(tree(), 'b');
    expect(indented).not.toBeNull();
    expectFields(indented!, 'b');
    const out = outdent(tree(), 'a1');
    expect(out).not.toBeNull();
    expectFields(out!, 'a1');
  });

  it('moveAmongSiblings', () => {
    const moved = moveAmongSiblings(tree(), 'b', -1);
    expect(moved).not.toBeNull();
    expectFields(moved!, 'b');
  });

  it('addChild och addSibling på en nod med fälten, och med en ny nod som har dem', () => {
    const child = addChild(tree(), 'b');
    expect(child).not.toBeNull();
    expectFields(child!.content, 'b');

    const sibling = addSibling(tree(), 'a1', 'after');
    expect(sibling).not.toBeNull();
    expectFields(sibling!.content, 'a1');

    const withFields = addChild(tree(), 'a2', node('ny', [], FIELDS));
    expect(withFields).not.toBeNull();
    expectFields(withFields!.content, 'ny');
  });

  it('setLabel, setColor och toggleCollapsed', () => {
    expectFields(setLabel(tree(), 'b', 'Nytt namn'), 'b');
    expectFields(setColor(tree(), 'b', 'pink'), 'b');
    expectFields(setColor(tree(), 'b', null), 'b');
    const collapsed = toggleCollapsed(tree(), 'a');
    expect(collapsed).not.toBeNull();
    expectFields(collapsed!, 'a1');
  });
});
