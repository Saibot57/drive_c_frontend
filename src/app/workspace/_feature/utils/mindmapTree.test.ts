import { describe, expect, it } from 'vitest';
import type { MindmapContent, MindmapNode } from '../types/mindmap.types';
import {
  addChild,
  addChildren,
  addSibling,
  canMoveNode,
  findNode,
  indent,
  moveAmongSiblings,
  moveNode,
  navigate,
  outdent,
  removeNode,
  rootChildSides,
  sanitizeMindmap,
  setColor,
  setLayout,
  sideOf,
  toggleCollapsed,
} from './mindmapTree';

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({
  id,
  label: id,
  children,
  ...extra,
});

/** Etiketterna i trädet som en läsbar sträng: A(B C(D)). */
const shape = (node: MindmapNode): string =>
  node.children.length ? `${node.label}(${node.children.map(shape).join(' ')})` : node.label;

const map = (root: MindmapNode, layout: MindmapContent['layout'] = 'right'): MindmapContent => ({ root, layout });

describe('sanitizeMindmap', () => {
  it('ger en tom karta för skräp', () => {
    expect(sanitizeMindmap(null).root.label).toBe('Central nod');
    expect(sanitizeMindmap({ root: 'x' }).root.children).toEqual([]);
  });

  it('läser en gammal karta utan de nya fälten', () => {
    const old = { root: { id: '1', label: 'Rot', children: [{ id: '2', label: 'A', children: [] }] } };
    const content = sanitizeMindmap(old);
    expect(content.layout).toBe('right');
    expect(shape(content.root)).toBe('Rot(A)');
  });

  it('byter dubblerade id deterministiskt', () => {
    const raw = { root: { id: '1', label: 'R', children: [{ id: '2', label: 'A' }, { id: '2', label: 'B' }] } };
    const first = sanitizeMindmap(raw);
    const second = sanitizeMindmap(raw);
    const ids = first.root.children.map((c) => c.id);
    expect(new Set(ids).size).toBe(2);
    expect(second.root.children.map((c) => c.id)).toEqual(ids);
  });

  it('släpper okända färger, sidor under första nivån och hopfällning utan barn', () => {
    const raw = {
      root: {
        id: 'r',
        label: 'R',
        children: [{ id: 'a', label: 'A', side: 'left', color: 'red', collapsed: true, children: [{ id: 'b', label: 'B', side: 'left' }] }],
      },
      layout: 'both',
    };
    const content = sanitizeMindmap(raw);
    const a = content.root.children[0];
    expect(a.side).toBe('left');
    expect(a.color).toBeUndefined();
    expect(a.collapsed).toBe(true);
    expect(a.children[0].side).toBeUndefined();
    expect(sanitizeMindmap({ root: { id: 'r', label: 'R', children: [{ id: 'x', collapsed: true }] } })
      .root.children[0].collapsed).toBeUndefined();
  });
});

describe('lägga till', () => {
  it('lägger ett barn sist och fäller ut föräldern', () => {
    const content = map(n('R', [n('A', [n('A1')], { collapsed: true })]));
    const result = addChild(content, 'A');
    expect(result).not.toBeNull();
    const a = findNode(result!.content.root, 'A')!;
    expect(a.collapsed).toBeUndefined();
    expect(a.children.map((c) => c.id)).toEqual(['A1', result!.id]);
  });

  it('lägger syskon före och efter, och ett barn på roten', () => {
    const content = map(n('R', [n('A'), n('B')]));
    const after = addSibling(content, 'A', 'after')!;
    expect(after.content.root.children.map((c) => c.id)).toEqual(['A', after.id, 'B']);
    const before = addSibling(content, 'A', 'before')!;
    expect(before.content.root.children.map((c) => c.id)).toEqual([before.id, 'A', 'B']);
    const onRoot = addSibling(content, 'R', 'after')!;
    expect(onRoot.content.root.children.map((c) => c.id)).toEqual(['A', 'B', onRoot.id]);
  });

  it('ger ett nytt barn till roten den sida som har minst i layouten both', () => {
    const content = setLayout(map(n('R', [n('A'), n('B'), n('C')])), 'both');
    // A höger, B vänster, C höger → nästa till vänster.
    const result = addChild(content, 'R')!;
    expect(rootChildSides(result.content).get(result.id)).toBe('left');
  });

  it('ger syskonet samma sida som noden', () => {
    const content = setLayout(map(n('R', [n('A'), n('B')])), 'both');
    const result = addSibling(content, 'B', 'after')!;
    expect(sideOf(result.content, result.id)).toBe('left');
  });

  it('lägger flera barn i ordning', () => {
    const next = addChildren(map(n('R')), 'R', [n('X'), n('Y')])!;
    expect(shape(next.root)).toBe('R(X Y)');
    expect(addChildren(map(n('R')), 'R', [])).toBeNull();
  });
});

describe('ta bort', () => {
  it('tar bort en gren och markerar syskonet ovanför, annars nedanför, annars föräldern', () => {
    const content = map(n('R', [n('A'), n('B', [n('B1')]), n('C')]));
    expect(removeNode(content, 'B')!.focusId).toBe('A');
    expect(shape(removeNode(content, 'B')!.content.root)).toBe('R(A C)');
    expect(removeNode(content, 'A')!.focusId).toBe('B');
    expect(removeNode(content, 'B1')!.focusId).toBe('B');
  });

  it('tar aldrig bort roten', () => {
    expect(removeNode(map(n('R')), 'R')).toBeNull();
  });

  it('fäller ut en förälder som blir utan barn', () => {
    const content = map(n('R', [n('A', [n('A1')], { collapsed: true })]));
    const a = findNode(removeNode(content, 'A1')!.content.root, 'A')!;
    expect(a.collapsed).toBeUndefined();
  });
});

describe('flytta', () => {
  const content = map(n('R', [n('A', [n('A1'), n('A2')]), n('B')]));

  it('byter plats med syskonet', () => {
    expect(shape(moveAmongSiblings(content, 'B', -1)!.root)).toBe('R(B A(A1 A2))');
    expect(moveAmongSiblings(content, 'A', -1)).toBeNull();
  });

  it('drar in under syskonet ovanför', () => {
    expect(shape(indent(content, 'B')!.root)).toBe('R(A(A1 A2 B))');
    expect(indent(content, 'A')).toBeNull();
  });

  it('lyfter en nivå och hamnar direkt efter föräldern', () => {
    expect(shape(outdent(content, 'A1')!.root)).toBe('R(A(A2) A1 B)');
  });

  it('byter sida i stället för att lyfta ett barn till roten i layouten both', () => {
    expect(outdent(content, 'A')).toBeNull();
    const both = setLayout(content, 'both');
    expect(sideOf(both, 'A')).toBe('right');
    expect(sideOf(outdent(both, 'A')!, 'A')).toBe('left');
  });

  it('flyttar en gren genom att dra, men inte in i sig själv', () => {
    expect(shape(moveNode(content, 'B', 'A1')!.root)).toBe('R(A(A1(B) A2))');
    expect(canMoveNode(content, 'A', 'A1')).toBe(false);
    expect(canMoveNode(content, 'A1', 'A')).toBe(false);
    expect(canMoveNode(content, 'R', 'A')).toBe(false);
    expect(moveNode(content, 'A', 'A2')).toBeNull();
  });

  it('släpper sidan när ett barn till roten flyttas längre ner', () => {
    const both = setLayout(content, 'both');
    const moved = indent(both, 'B');
    // B låg till vänster och A till höger; de är inte grannar på samma sida.
    expect(moved).toBeNull();
    const dragged = moveNode(both, 'B', 'A')!;
    expect(findNode(dragged.root, 'B')!.side).toBeUndefined();
  });
});

describe('hopfällning och färg', () => {
  it('fäller ihop bara noder med barn, aldrig roten', () => {
    const content = map(n('R', [n('A', [n('A1')]), n('B')]));
    expect(findNode(toggleCollapsed(content, 'A')!.root, 'A')!.collapsed).toBe(true);
    expect(toggleCollapsed(content, 'B')).toBeNull();
    expect(toggleCollapsed(content, 'R')).toBeNull();
  });

  it('sätter och tar bort färg', () => {
    const colored = setColor(map(n('R', [n('A')])), 'A', 'green');
    expect(findNode(colored.root, 'A')!.color).toBe('green');
    expect('color' in findNode(setColor(colored, 'A', null).root, 'A')!).toBe(false);
  });
});

describe('navigate', () => {
  const content = map(n('R', [n('A', [n('A1'), n('A2')]), n('B', [n('B1')])]));

  it('går ut till första barnet och tillbaka till föräldern', () => {
    expect(navigate(content, 'R', 'right')).toBe('A');
    expect(navigate(content, 'A', 'right')).toBe('A1');
    expect(navigate(content, 'A1', 'left')).toBe('A');
    expect(navigate(content, 'A', 'left')).toBe('R');
    expect(navigate(content, 'R', 'left')).toBeNull();
  });

  it('går till kusinen när syskonen tar slut', () => {
    expect(navigate(content, 'A2', 'down')).toBe('B1');
    expect(navigate(content, 'B1', 'up')).toBe('A2');
    expect(navigate(content, 'A1', 'up')).toBeNull();
  });

  it('hoppar över gömda noder', () => {
    const collapsed = toggleCollapsed(content, 'A')!;
    expect(navigate(collapsed, 'A', 'right')).toBeNull();
    expect(navigate(collapsed, 'B1', 'up')).toBeNull();
  });

  it('vänder vänster och höger på vänstra sidan', () => {
    const both = setLayout(content, 'both');
    expect(navigate(both, 'R', 'left')).toBe('B');
    expect(navigate(both, 'B', 'left')).toBe('B1');
    expect(navigate(both, 'B1', 'right')).toBe('B');
    expect(navigate(both, 'B', 'right')).toBe('R');
    // A och B ligger på olika sidor och är inte grannar.
    expect(navigate(both, 'A', 'down')).toBeNull();
  });
});
