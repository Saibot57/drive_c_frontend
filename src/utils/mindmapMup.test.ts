import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findNode } from '@/utils/mindmap/mindmapTree';
import { htmlToText, MindmapImportError, nearestMindmapColor, parseMindmup } from '@/utils/mindmapMup';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'src/utils/mindmap/__fixtures__', name), 'utf8'));

describe('parseMindmup, format 2 (rotidén överst)', () => {
  const { name, doc } = parseMindmup(fixture('mup-v2.json'));

  it('tar rotens titel som namn och id som strängar', () => {
    expect(name).toBe('Franska revolutionen');
    expect(doc.root.id).toBe('1');
    expect(doc.root.label).toBe('Franska revolutionen');
  });

  it('lägger positiva rangtal till höger och negativa till vänster, efter absolutvärde', () => {
    expect(doc.layout).toBe('both');
    expect(doc.root.children.map((c) => [c.label, c.side])).toEqual([
      ['Orsaker', 'right'],
      ['Följder', 'right'],
      ['Förlopp', 'left'],
      ['Idéer', 'left'],
    ]);
  });

  it('ordnar barnen efter rangtal som tal, också med decimaler', () => {
    const orsaker = findNode(doc.root, '2')!;
    expect(orsaker.children.map((c) => c.label)).toEqual(['Missväxt 1788', 'Brödpriset', 'Statsskulden']);
  });

  it('läser hopfällning, anteckning, bilaga, färg och länk i titeln', () => {
    const forlopp = findNode(doc.root, '5')!;
    expect(forlopp.collapsed).toBe(true);
    expect(forlopp.link).toBe('https://sv.wikipedia.org/wiki/Franska_revolutionen');
    expect(forlopp.color).toBe('grey');
    expect(forlopp.offset).toBeUndefined();

    expect(findNode(doc.root, '4')!.note).toBe('Kriget i Amerika kostade.');
    const foljder = findNode(doc.root, '7')!;
    expect(foljder.note).toBe('Napoleon tar makten.\nCode civil & lagar');
    expect(foljder.color).toBe('pink');
    expect(findNode(doc.root, '2')!.color).toBe('blue');
  });

  it('tar en ikon med webbadress som bild och hoppar över data-adresser', () => {
    expect(findNode(doc.root, '7')!.image).toEqual({
      source: { kind: 'url', url: 'https://example.com/flagga.png' },
      width: 96,
      aspect: 0.5,
    });
    const ideer = findNode(doc.root, '8')!;
    expect(ideer.image).toBeUndefined();
    expect(ideer.color).toBeUndefined();
  });

  it('gör länkarna till tvärlänkar, med pil och färg', () => {
    expect(doc.crossLinks).toEqual([
      { id: 'l1', from: '4', to: '6', color: 'green' },
      // MindMups grå förvalsfärg på en länk blir ingen färg, som sidans förval.
      { id: 'l2', from: '3', to: '7', arrow: 'none' },
    ]);
  });

  it('tar inte med roten som färg när den är vit', () => {
    expect(doc.root.color).toBeUndefined();
  });
});

describe('parseMindmup, format 3 (omslag med rotidén under ideas["1"])', () => {
  const { name, doc } = parseMindmup(fixture('mup-v3.json'));

  it('läser rotidén ur omslaget', () => {
    expect(name).toBe('Ekosystem');
    expect(doc.root.label).toBe('Ekosystem');
    expect(doc.layout).toBe('right');
    expect(doc.root.children.map((c) => c.label)).toEqual(['Producenter', 'Konsumenter', 'Nedbrytare']);
    expect(doc.root.children.every((c) => c.side === undefined)).toBe(true);
  });

  it('behåller id med sessionsdel som strängar och hoppar över tomma grupper', () => {
    const konsumenter = findNode(doc.root, '5.a1b2')!;
    expect(konsumenter.children.map((c) => c.id)).toEqual(['6.a1b2', '7.a1b2']);
  });

  it('nästan vitt blir ingen färg, grönt blir grönt', () => {
    expect(findNode(doc.root, '5.a1b2')!.color).toBeUndefined();
    expect(findNode(doc.root, '2.a1b2')!.color).toBe('green');
  });

  it('hoppar över interna resurser och tar en webbild i närmaste bredd', () => {
    expect(findNode(doc.root, '4.a1b2')!.image).toBeUndefined();
    expect(findNode(doc.root, '6.a1b2')!.image).toEqual({
      source: { kind: 'url', url: 'https://example.com/hjort.jpg' },
      width: 280,
      aspect: 0.5,
    });
  });

  it('läser pilar åt båda håll och bakåt, och tar bort otillåtna länkar', () => {
    expect(doc.crossLinks).toEqual([
      // Förälder–barn (2 → 3) och en länk till en nod som inte finns tas bort.
      { id: 'l1', from: '3.a1b2', to: '6.a1b2', arrow: 'both', color: 'lilac' },
      // `from` vänds, så att pilen pekar dit den pekade.
      { id: 'l3', from: '9.a1b2', to: '7.a1b2' },
    ]);
  });
});

describe('parseMindmup, äldre och ovanliga former', () => {
  it('läser format 1, där stilen låg direkt på idén', () => {
    const { doc } = parseMindmup({
      id: 1,
      title: 'Gammal',
      ideas: { 1: { id: 2, title: 'Barn', style: { background: '#ffcc00', collapsed: true }, ideas: { 1: { id: 3, title: 'Barnbarn' } } } },
    });
    expect(doc.root.children[0]).toMatchObject({ label: 'Barn', color: 'yellow', collapsed: true });
  });

  it('samlar flera rotidéer under en ny rot med reservnamnet', () => {
    const { name, doc } = parseMindmup(
      { id: 'root', formatVersion: 3, ideas: { 1: { id: 1, title: 'A' }, 2: { id: 2, title: 'B' } } },
      'Min fil',
    );
    expect(name).toBe('Min fil');
    expect(doc.root.label).toBe('Min fil');
    expect(doc.root.children.map((c) => c.label)).toEqual(['A', 'B']);
  });

  it('ger roten reservnamnet när titeln saknas', () => {
    const { name, doc } = parseMindmup({ formatVersion: 2, id: 1, title: '' }, 'Reserv');
    expect(name).toBe('Reserv');
    expect(doc.root.label).toBe('');
  });

  it('behåller en titel som bara är en adress, som MindMup visar den', () => {
    const { doc } = parseMindmup({ id: 1, title: 'x', ideas: { 1: { id: 2, title: 'www.skolverket.se' } } });
    expect(doc.root.children[0]).toMatchObject({ label: 'www.skolverket.se', link: 'http://www.skolverket.se' });
  });

  it.each([
    ['en lista', []],
    ['en text', 'karta'],
    ['null', null],
    ['ett objekt utan idéer och titel', { name: 'x' }],
    ['ett omslag utan rotidé', { id: 'root', formatVersion: 3, ideas: {} }],
    ['ett nyare format', { id: 'root', formatVersion: 4, ideas: { 1: { id: 1, title: 'A' } } }],
    ['idéer som inte är ett objekt', { id: 1, title: 'A', ideas: [1, 2] }],
  ])('kastar ett svenskt fel för %s', (_what, raw) => {
    expect(() => parseMindmup(raw)).toThrow(MindmapImportError);
  });
});

describe('nearestMindmapColor', () => {
  it.each([
    ['#FF0000', 'pink'],
    ['#ff9900', 'yellow'],
    ['#00cc00', 'green'],
    ['#22AAE0', 'blue'],
    ['#7030A0', 'lilac'],
    ['#E0E0E0', 'grey'],
    ['#333', 'grey'],
    ['rgb(255, 210, 63)', 'yellow'],
  ])('%s blir %s', (css, color) => {
    expect(nearestMindmapColor(css)).toBe(color);
  });

  it.each(['#ffffff', '#FFF', '#f5f5f5', 'transparent', 'false', '', 'blå', undefined, 12])(
    '%s blir ingen färg',
    (css) => {
      expect(nearestMindmapColor(css)).toBeNull();
    },
  );
});

describe('htmlToText', () => {
  it('tar bort taggar, avkodar tecken och behåller radbrytningar', () => {
    expect(htmlToText('<div>Ett<br/>två</div><ul><li>tre &lt;3</li><li>&#246;l &#xE5;</li></ul>')).toBe('Ett\ntvå\ntre <3\nöl å');
  });

  it('tar bort skript och stilar med innehåll', () => {
    expect(htmlToText('<style>p{}</style><p>Text</p><script>alert(1)</script>')).toBe('Text');
  });
});
