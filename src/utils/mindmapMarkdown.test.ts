import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import { escapeMarkdown, toMindmapMarkdown } from '@/utils/mindmapMarkdown';

const n = (id: string, label: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode =>
  ({ id, label, children, ...extra });

describe('toMindmapMarkdown', () => {
  it('ger rubriker för nivå 1–3 och punkter med indrag därefter', () => {
    const doc: MindmapDoc = {
      root: n('r', 'Rot', [
        n('a', 'Gren', [
          n('b', 'Kvist', [
            n('c', 'Blad', [n('d', 'Nerv')]),
            n('e', 'Blad 2'),
          ]),
        ]),
        n('f', 'Annan gren'),
      ]),
    };
    expect(toMindmapMarkdown(doc)).toBe([
      '# Rot',
      '',
      '## Gren',
      '',
      '### Kvist',
      '',
      '- Blad',
      '  - Nerv',
      '- Blad 2',
      '',
      '## Annan gren',
      '',
    ].join('\n'));
  });

  it('skriver anteckningen som stycke under rubriken och indraget under punkten', () => {
    const doc: MindmapDoc = {
      root: n('r', 'Rot', [
        n('a', 'Gren', [n('b', 'Kvist', [n('c', 'Blad', [], { note: 'Rad ett\nRad två' })])], { note: 'Om grenen' }),
      ], { note: 'Inledning' }),
    };
    expect(toMindmapMarkdown(doc)).toBe([
      '# Rot',
      '',
      'Inledning',
      '',
      '## Gren',
      '',
      'Om grenen',
      '',
      '### Kvist',
      '',
      '- Blad',
      '',
      '  Rad ett\\',
      '  Rad två',
      '',
    ].join('\n'));
  });

  it('skriver länken som [etikett](url) och tar med hopfällda grenar', () => {
    const doc: MindmapDoc = {
      root: n('r', 'Rot', [
        n('a', 'Källa', [n('b', 'Gömd')], { link: 'https://sv.wikipedia.org/wiki/Test_(sida)', collapsed: true }),
      ]),
    };
    expect(toMindmapMarkdown(doc)).toContain('## [Källa](https://sv.wikipedia.org/wiki/Test_%28sida%29)');
    expect(toMindmapMarkdown(doc)).toContain('### Gömd');
  });

  it('ger en länk utan text adressen som etikett och hoppar över tomma noder', () => {
    const doc: MindmapDoc = {
      root: n('r', 'Rot', [n('a', '', [], { link: 'https://example.com' }), n('b', '  ')]),
    };
    expect(toMindmapMarkdown(doc)).toBe('# Rot\n\n## [https://example.com](https://example.com)\n');
  });

  it('lägger tvärlänkarna i en lista sist', () => {
    const doc: MindmapDoc = {
      root: n('r', 'Rot', [n('a', 'A'), n('b', 'B*')]),
      crossLinks: [{ id: 'l1', from: 'a', to: 'b', label: 'stöd' }, { id: 'l2', from: 'b', to: 'a', arrow: 'both' }],
    };
    expect(toMindmapMarkdown(doc).endsWith('**Länkar**\n\n- A → B\\*: stöd\n- B\\* ↔ A\n')).toBe(true);
  });

  it('skyddar tecken som annars blir formatering', () => {
    expect(escapeMarkdown('1. *fet* _kursiv_ [x] `kod` <b> #tagg')).toBe('1\\. \\*fet\\* \\_kursiv\\_ \\[x\\] \\`kod\\` \\<b\\> \\#tagg');
    expect(escapeMarkdown('- punkt')).toBe('\\- punkt');
    expect(escapeMarkdown('+ plus')).toBe('\\+ plus');
  });
});
