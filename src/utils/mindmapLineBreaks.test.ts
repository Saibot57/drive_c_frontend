import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import { crossLinkLines } from '@/utils/mindmapCrossLinks';
import { parseMindmapFile, toMindmapFile } from '@/utils/mindmapFile';
import { toMindmapMarkdown } from '@/utils/mindmapMarkdown';
import { parseMindmup } from '@/utils/mindmapMup';

/*
 * Radbrytningar i etiketter (docs/plans/mindmap-radbrytning.md): det som
 * bara har en rad får ett mellanslag, importen från MindMup behåller dem.
 */

const n = (id: string, label: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode =>
  ({ id, label, children, ...extra });

describe('Markdown med radbrytningar', () => {
  it('skriver rubriker och punkter på en rad', () => {
    const doc: MindmapDoc = {
      root: n('r', 'Rot\nrad två', [n('a', 'Gren\nmed rader', [n('b', 'Kvist', [n('c', 'Blad\nett', [], { link: 'https://a.se' })])])]),
    };
    const md = toMindmapMarkdown(doc);
    expect(md).toContain('# Rot rad två');
    expect(md).toContain('## Gren med rader');
    expect(md).toContain('- [Blad ett](https://a.se)');
    expect(md).not.toMatch(/Rot\n|Gren\n|Blad\n/);
  });
});

describe('tvärlänkarna i dispositionen', () => {
  it('skriver nodernas etiketter på en rad', () => {
    const doc: MindmapDoc = {
      root: n('r', 'R', [n('a', 'A\nett'), n('b', 'B')]),
      crossLinks: [{ id: 'l', from: 'a', to: 'b' }],
    };
    expect(crossLinkLines(doc)).toEqual(['A ett → B']);
  });

  it('hoppar fortfarande över en länk till en nod utan text', () => {
    const doc: MindmapDoc = {
      root: n('r', 'R', [n('a', '\n'), n('b', 'B')]),
      crossLinks: [{ id: 'l', from: 'a', to: 'b' }],
    };
    expect(crossLinkLines(doc)).toEqual([]);
  });
});

describe('.mup-importen', () => {
  it('behåller radbrytningar och gör annan blanktext till ett mellanslag', () => {
    const { name, doc } = parseMindmup({
      id: 1,
      title: 'Rot\r\nrad två',
      ideas: { 1: { id: 2, title: '\n  Första   rad \n\n\n\nandra\trad\n' } },
    });
    expect(doc.root.label).toBe('Rot\nrad två');
    expect(name).toBe('Rot rad två');
    expect(doc.root.children[0].label).toBe('Första rad\n\nandra rad');
  });

  it('tar ut länken och behåller raderna runt den', () => {
    const { doc } = parseMindmup({ id: 1, title: 'x', ideas: { 1: { id: 2, title: 'Läs\nwww.skolverket.se här' } } });
    expect(doc.root.children[0]).toMatchObject({ label: 'Läs\nhär', link: 'http://www.skolverket.se' });
  });
});

describe('den egna filen', () => {
  it('behåller radbrytningen i roten men tar namnet på en rad', () => {
    const doc: MindmapDoc = { root: n('r', 'Rot\nrad två') };
    const { name, doc: read } = parseMindmapFile(toMindmapFile('', doc), 'x.json');
    expect(name).toBe('Rot rad två');
    expect(read.root.label).toBe('Rot\nrad två');
  });
});
