// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import { parseOutlineHtml, toOutlineHtml } from '@/utils/mindmap/mindmapOutline';
import { readBranchData, withBranchData } from './mindmapClipboard';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

const branch: MindmapNode = {
  id: 'a',
  label: 'Källor & "citat" <b>',
  color: 'green',
  icon: 'star',
  note: 'Rad ett\nRad två',
  link: 'https://example.org/?a=1&b=2',
  children: [
    {
      id: 'b',
      label: 'Bild',
      image: { source: { kind: 'gdrive', fileId: 'f1' }, width: 96, aspect: 0.5 },
      collapsed: true,
      children: [{ id: 'c', label: 'Under', children: [], color: 'pink' }],
    },
  ],
};

const html = (node: MindmapNode) => `<meta charset="utf-8">${withBranchData(toOutlineHtml(node, 'list', { notes: true }), node)}`;

describe('grenen på urklipp', () => {
  it('kommer tillbaka med alla fält, men med nya id', () => {
    const pasted = readBranchData(parse(html(branch)))!;
    expect(pasted.label).toBe(branch.label);
    expect(pasted.color).toBe('green');
    expect(pasted.icon).toBe('star');
    expect(pasted.note).toBe('Rad ett\nRad två');
    expect(pasted.link).toBe('https://example.org/?a=1&b=2');
    expect(pasted.children[0].image).toEqual({ source: { kind: 'gdrive', fileId: 'f1' }, width: 96, aspect: 0.5 });
    expect(pasted.children[0].collapsed).toBe(true);
    expect(pasted.children[0].children[0].color).toBe('pink');

    const ids = [pasted.id, pasted.children[0].id, pasted.children[0].children[0].id];
    expect(new Set(ids).size).toBe(3);
    ids.forEach((id) => expect(['a', 'b', 'c']).not.toContain(id));
  });

  it('två inklistringar av samma gren får olika id', () => {
    const doc = parse(html(branch));
    expect(readBranchData(doc)!.id).not.toBe(readBranchData(doc)!.id);
  });

  it('behåller en hopfälld gren hopfälld och tar bort sidan under roten', () => {
    const collapsed: MindmapNode = { ...branch, collapsed: true, side: 'left' };
    const pasted = readBranchData(parse(html(collapsed)))!;
    expect(pasted.collapsed).toBe(true);
    expect(pasted.side).toBeUndefined();
  });

  it('tvättar det som följer med: fel fält faller bort', () => {
    const dirty = { id: 'x', label: 'X', children: [], link: 'javascript:alert(1)', icon: 'bomb', color: 'neon', note: 5 };
    const pasted = readBranchData(parse(withBranchData('<p>X</p>', dirty as unknown as MindmapNode)))!;
    expect(pasted).toEqual({ id: pasted.id, label: 'X', children: [] });
  });

  it('dispositionen runt grenen går fortfarande att läsa för andra program', () => {
    const doc = parse(html(branch));
    expect(doc.body.textContent).toContain('Källor & "citat" <b>');
    expect(parseOutlineHtml(doc)?.[0].label).toContain('Bild');
  });

  it('utan attributet, eller med ett trasigt, gäller dispositionen', () => {
    expect(readBranchData(parse('<ul><li>A</li></ul>'))).toBeNull();
    expect(readBranchData(parse('<div data-mindmap="{inte json"><p>A</p></div>'))).toBeNull();
    expect(readBranchData(parse('<div data-mindmap="[1,2]"><p>A</p></div>'))).toBeNull();
    expect(readBranchData(parse('<div data-mindmap="&quot;text&quot;"><p>A</p></div>'))).toBeNull();
    expect(readBranchData(parse('<div data-mindmap="{&quot;id&quot;:&quot;a&quot;}"><p>A</p></div>'))).toBeNull();
  });
});
