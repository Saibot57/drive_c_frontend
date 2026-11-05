// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '../types/mindmap.types';
import { parseOutlineHtml, parseOutlineText, toOutlineHtml, toOutlineText } from './mindmapOutline';

const n = (label: string, children: MindmapNode[] = []): MindmapNode => ({ id: label, label, children });
const shape = (node: MindmapNode): string =>
  node.children.length ? `${node.label}(${node.children.map(shape).join(' ')})` : node.label;
const forest = (nodes: MindmapNode[]) => nodes.map(shape).join(' ');

const sample = n('Andra världskriget', [
  n('Orsaker', [n('Versaillesfreden'), n('Depressionen')]),
  n('Förlopp', [n('1939', [n('Polen')])]),
  n(''),
]);

describe('toOutlineText', () => {
  it('skriver en indenterad lista och hoppar över tomma noder', () => {
    expect(toOutlineText(sample)).toBe([
      'Andra världskriget',
      '- Orsaker',
      '  - Versaillesfreden',
      '  - Depressionen',
      '- Förlopp',
      '  - 1939',
      '    - Polen',
    ].join('\n'));
  });
});

describe('toOutlineHtml', () => {
  it('ger nästlade punkter', () => {
    expect(toOutlineHtml(n('R', [n('A', [n('A1')]), n('B')]), 'list'))
      .toBe('<p><strong>R</strong></p><ul><li>A<ul><li>A1</li></ul></li><li>B</li></ul>');
  });

  it('ger rubriker i tre nivåer och punkter därunder', () => {
    expect(toOutlineHtml(sample, 'headings')).toBe(
      '<h1>Andra världskriget</h1>'
      + '<h2>Orsaker</h2><h3>Versaillesfreden</h3><h3>Depressionen</h3>'
      + '<h2>Förlopp</h2><h3>1939</h3><ul><li>Polen</li></ul>',
    );
  });

  it('skyddar mot HTML i etiketterna', () => {
    expect(toOutlineHtml(n('a < b & "c"'), 'list')).toBe('<p><strong>a &lt; b &amp; &quot;c&quot;</strong></p>');
  });
});

describe('parseOutlineText', () => {
  it('läser indrag med blanksteg och tab och tar bort punkter', () => {
    const text = 'Orsaker\n\t- Versailles\n\t• Depressionen\n\t\t1. Börskraschen\nFörlopp\r\n';
    expect(forest(parseOutlineText(text))).toBe('Orsaker(Versailles Depressionen(Börskraschen)) Förlopp');
    expect(forest(parseOutlineText('A\n    B\n  C'))).toBe('A(B C)');
  });

  it('läser sin egen export', () => {
    const [root] = parseOutlineText(toOutlineText(sample));
    expect(shape(root)).toBe('Andra världskriget(Orsaker(Versaillesfreden Depressionen) Förlopp(1939(Polen)))');
  });

  it('lägger punkter under en rad utan punkt', () => {
    expect(forest(parseOutlineText('Rubrik\n- A\n- B\nNästa'))).toBe('Rubrik(A B) Nästa');
  });

  it('ger nya id', () => {
    const [a, b] = parseOutlineText('A\nA');
    expect(a.id).not.toBe(b.id);
  });
});

describe('parseOutlineHtml', () => {
  const parse = (html: string) => parseOutlineHtml(new DOMParser().parseFromString(html, 'text/html'));

  it('läser nästlade listor', () => {
    expect(forest(parse('<ul><li>A<ul><li>A1</li></ul></li><li>B</li></ul>')!)).toBe('A(A1) B');
  });

  it('läser Google Docs platta listor med aria-level', () => {
    const html = '<b id="docs-internal-guid-x"><ul>'
      + '<li aria-level="1"><p><span>Orsaker</span></p></li>'
      + '<li aria-level="2"><p><span>Versailles</span></p></li>'
      + '<li aria-level="1"><p><span>Förlopp</span></p></li>'
      + '</ul></b>';
    expect(forest(parse(html)!)).toBe('Orsaker(Versailles) Förlopp');
  });

  it('ger null utan lista', () => {
    expect(parse('<p>Bara text</p>')).toBeNull();
  });
});
