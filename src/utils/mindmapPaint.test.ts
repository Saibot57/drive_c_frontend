import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc, MindmapShading } from '@/types/mindmapDoc';
import { sanitizeMindmap } from '@/utils/mindmap/mindmapTree';
import { defaultMindmapDoc, sanitizeMindmapDoc } from './mindmapDoc';
import {
  colorForNewNode,
  inheritsColor,
  mixOklab,
  paintThemeOf,
  parsePercent,
  parseHexColor,
  resolveMindmapPaint,
  setBranchPaint,
  setNodePaint,
  type MindmapPaintTheme,
} from './mindmapPaint';
import { findNode } from '@/utils/mindmap/mindmapTree';

const NEO: MindmapPaintTheme = {
  colors: { green: '#9ccb6b', yellow: '#ffd23f', blue: '#8fd0ff', pink: '#ff9ec4', lilac: '#c9b8ff', grey: '#e5e7eb' },
  nodeBg: '#ffffff',
  text: '#000000',
  customMix: 1,
  customBase: '#ffffff',
};
const KRONBERG: MindmapPaintTheme = {
  colors: { green: '#c9d3b2', yellow: '#eaddb8', blue: '#c3d2db', pink: '#e3c4bf', lilac: '#d2cbdc', grey: '#e4e2dd' },
  nodeBg: '#f6f5f2',
  text: '#1f2022',
  customMix: 0.54,
  customBase: '#d8d6d0',
};

const n = (id: string, children: MindmapNode[] = [], extra: Partial<MindmapNode> = {}): MindmapNode => ({ id, label: id, children, ...extra });

/** Rot, sedan en kedja a → b → c → d → e under den. */
const chain = (top: Partial<MindmapNode> = { color: 'blue' }, shading: MindmapShading | null = 'short'): MindmapDoc => ({
  root: n('r', [n('a', [n('b', [n('c', [n('d', [n('e')])])])], top)]),
  layout: 'right',
  ...(shading ? { shading } : {}),
});

const lightness = (hex: string) => {
  const [r, g, b] = parseHexColor(hex)!;
  return r + g + b;
};

describe('mixOklab', () => {
  it('ger ändarna vid 1 och 0', () => {
    expect(mixOklab('#8fd0ff', '#ffffff', 1)).toBe('#8fd0ff');
    expect(mixOklab('#8fd0ff', '#ffffff', 0)).toBe('#ffffff');
  });

  it('ger mellangrått mellan svart och vitt', () => {
    const [r, g, b] = parseHexColor(mixOklab('#000000', '#ffffff', 0.5))!;
    expect(r).toBe(g);
    expect(g).toBe(b);
    // Oklab är jämnt för ögat: mitten är ljusare än 128 i sRGB.
    expect(r).toBeGreaterThan(90);
    expect(r).toBeLessThan(140);
  });

  it('läser #rgb och versaler, och ger tillbaka det som inte går att läsa', () => {
    expect(mixOklab('#FFF', '#000', 1)).toBe('#ffffff');
    expect(mixOklab('rgb(1,2,3)', '#000000', 0.7)).toBe('rgb(1,2,3)');
    expect(mixOklab('rgb(1,2,3)', '#000000', 0.2)).toBe('#000000');
  });
});

describe('resolveMindmapPaint', () => {
  it('ger nyanser och sedan kant med de korta stegen', () => {
    const paints = resolveMindmapPaint(chain().root, 'short', NEO);
    expect(paints.has('r')).toBe(false);
    expect(paints.get('a')).toEqual({ fill: '#8fd0ff', text: '#000000' });
    const b = paints.get('b')!;
    const c = paints.get('c')!;
    expect(lightness(b.fill)).toBeGreaterThan(lightness('#8fd0ff'));
    expect(lightness(c.fill)).toBeGreaterThan(lightness(b.fill));
    expect(c.outline).toBeUndefined();
    const d = paints.get('d')!;
    expect(d.outline).toBe(true);
    expect(d.fill).toBe('#ffffff');
    expect(lightness(d.border!)).toBeLessThan(lightness('#8fd0ff'));
    expect(paints.get('e')).toEqual(d);
  });

  it('börjar kanten på nivå 4 med mellan och mjuka steg', () => {
    (['medium', 'soft'] as const).forEach((shading) => {
      const paints = resolveMindmapPaint(chain({ color: 'green' }, shading).root, shading, NEO);
      expect(paints.get('d')!.outline).toBeUndefined();
      expect(paints.get('e')!.outline).toBe(true);
    });
  });

  it('färgar bara noder med sparad färg när nyanserna är av, som förut', () => {
    const paints = resolveMindmapPaint(chain({ color: 'green' }, null).root, undefined, NEO);
    expect(Array.from(paints.keys())).toEqual(['a']);
    expect(paints.get('a')!.fill).toBe('#9ccb6b');
  });

  it('ger samma färger för en gammal karta med alla färger sparade, med och utan nyanser', () => {
    const root = n('r', [n('a', [n('b', [n('c', [], { color: 'pink' })], { color: 'pink' })], { color: 'pink' })]);
    const off = resolveMindmapPaint(root, undefined, NEO);
    const short = resolveMindmapPaint(root, 'short', NEO);
    expect(Array.from(short.entries())).toEqual(Array.from(off.entries()));
    expect(short.get('c')!.fill).toBe('#ff9ec4');
  });

  it('börjar om på nivå 0 vid en nod med egen färg', () => {
    const root = n('r', [n('a', [n('b', [n('c')], { color: 'yellow' })], { color: 'blue' })]);
    const paints = resolveMindmapPaint(root, 'short', NEO);
    expect(paints.get('b')!.fill).toBe('#ffd23f');
    expect(paints.get('c')!.fill).toBe(mixOklab('#ffd23f', '#ffffff', 0.55));
  });

  it('stoppar arvet vid "Ingen färg"', () => {
    const root = n('r', [n('a', [n('b', [n('c')], { colorNone: true })], { color: 'blue' })]);
    const paints = resolveMindmapPaint(root, 'short', NEO);
    expect(paints.has('b')).toBe(false);
    expect(paints.has('c')).toBe(false);
  });

  it('dämpar en egen färg som schemats kurser i Kronberg, inte i Neo', () => {
    const root = n('r', [n('a', [], { customColor: '#c2410c' })]);
    expect(resolveMindmapPaint(root, 'short', NEO).get('a')!.fill).toBe('#c2410c');
    expect(resolveMindmapPaint(root, 'short', KRONBERG).get('a')!.fill).toBe(mixOklab('#c2410c', '#d8d6d0', 0.54));
  });

  it('ger ljus text på en mörk egen färg och temats text på nyanserna', () => {
    const root = n('r', [n('a', [n('b', [n('c')])], { customColor: '#1e3a8a' })]);
    const paints = resolveMindmapPaint(root, 'short', NEO);
    expect(paints.get('a')!.text).toBe('#ffffff');
    expect(paints.get('c')!.text).toBe('#000000');
  });

  it('ger temats text på alla sex färger i båda temana', () => {
    [NEO, KRONBERG].forEach((theme) => {
      Object.keys(theme.colors).forEach((color) => {
        const root = n('r', [n('a', [], { color: color as MindmapNode['color'] })]);
        expect(resolveMindmapPaint(root, 'short', theme).get('a')!.text).toBe(theme.text);
      });
    });
  });

  it('färgar hela kartan i nyanser när roten har en färg', () => {
    const root = n('r', [n('a', [n('b')])], { color: 'lilac' });
    const paints = resolveMindmapPaint(root, 'short', NEO);
    expect(paints.get('r')!.fill).toBe('#c9b8ff');
    expect(paints.get('b')!.fill).toBe(mixOklab('#c9b8ff', '#ffffff', 0.25));
  });
});

describe('parsePercent', () => {
  it('läser procent och ger 1 för det som inte går att läsa', () => {
    expect(parsePercent(' 54% ')).toBe(0.54);
    expect(parsePercent('100%')).toBe(1);
    expect(parsePercent('')).toBe(1);
    expect(parsePercent('0.5')).toBe(1);
  });
});

describe('paintThemeOf', () => {
  it('faller tillbaka på nodens bakgrund och full färg när kursvärdena saknas', () => {
    const theme = paintThemeOf({
      background: '#fff', line: '#000', text: '#000', nodeBg: '#ffffff', nodeBorder: '#000', rootBg: '#eee',
      rootBorder: '#000', badgeBg: '#eee', badgeText: '#333', colors: NEO.colors, font: '14px a', rootFont: '16px a',
    });
    expect(theme.customMix).toBe(1);
    expect(theme.customBase).toBe('#ffffff');
  });
});

describe('att sätta färg', () => {
  it('sparar högst ett av fälten på noden', () => {
    let d = chain({ color: 'blue' });
    d = setNodePaint(d, 'a', { customColor: '#ABC' });
    expect(findNode(d.root, 'a')).toMatchObject({ customColor: '#aabbcc' });
    expect(findNode(d.root, 'a')!.color).toBeUndefined();
    d = setNodePaint(d, 'a', { color: 'green' });
    expect(findNode(d.root, 'a')!.customColor).toBeUndefined();
    expect(findNode(d.root, 'a')!.color).toBe('green');
    expect(d.shading).toBe('short');
  });

  it('lämnar noden när en egen färg inte går att läsa', () => {
    const d = chain();
    expect(findNode(setNodePaint(d, 'a', { customColor: 'röd' }).root, 'a')!.color).toBe('blue');
  });

  it('gör en nod som ärver ofärgad med "Ingen färg", och tar bara bort färgen annars', () => {
    const d = chain();
    expect(inheritsColor(d, 'c')).toBe(true);
    expect(findNode(setNodePaint(d, 'c', null).root, 'c')!.colorNone).toBe(true);
    const a = findNode(setNodePaint(d, 'a', null).root, 'a')!;
    expect(a.color).toBeUndefined();
    expect(a.colorNone).toBeUndefined();
    // Utan nyanser ärvs inget, så "Ingen färg" tar bara bort.
    const off = chain({ color: 'blue' }, null);
    expect(inheritsColor(off, 'c')).toBe(false);
    expect(findNode(setNodePaint(off, 'c', null).root, 'c')!.colorNone).toBeUndefined();
  });

  it('"Hela grenen" tar bort sparade färger under med nyanser', () => {
    const d: MindmapDoc = { ...chain(), root: n('r', [n('a', [n('b', [n('c', [], { colorNone: true })], { color: 'pink' })], { color: 'blue' })]) };
    const next = setBranchPaint(d, 'a', { color: 'green' });
    expect(findNode(next.root, 'a')!.color).toBe('green');
    expect(findNode(next.root, 'b')!.color).toBeUndefined();
    expect(findNode(next.root, 'c')!.colorNone).toBeUndefined();
  });

  it('"Hela grenen" sätter samma färg på alla när nyanserna är av, som förut', () => {
    const d = chain({ color: 'blue' }, null);
    const next = setBranchPaint(d, 'a', { customColor: '#123456' });
    expect(findNode(next.root, 'e')!.customColor).toBe('#123456');
    const cleared = setBranchPaint(next, 'a', null);
    expect(findNode(cleared.root, 'e')!.customColor).toBeUndefined();
    expect(findNode(cleared.root, 'a')!.customColor).toBeUndefined();
  });

  it('en ny nod ärver med nyanser och får förälderns färg utan', () => {
    expect(colorForNewNode(chain(), 'a')).toBeNull();
    expect(colorForNewNode(chain({ color: 'blue' }, null), 'a')).toEqual({ color: 'blue' });
    expect(colorForNewNode(chain({ customColor: '#112233' }, 'off'), 'a')).toEqual({ customColor: '#112233' });
    expect(colorForNewNode(chain({}, null), 'a')).toBeNull();
  });
});

describe('tvätten', () => {
  it('behåller en giltig egen färg med gemener och släpper en ogiltig', () => {
    const content = sanitizeMindmap({
      root: { id: 'r', label: 'r', children: [
        { id: 'a', label: 'a', children: [], customColor: '#AABBCC', color: 'blue' },
        { id: 'b', label: 'b', children: [], customColor: 'red' },
        { id: 'c', label: 'c', children: [], colorNone: true },
        { id: 'd', label: 'd', children: [], colorNone: true, color: 'green' },
        { id: 'e', label: 'e', children: [], colorNone: 'ja' },
      ] },
    });
    const [a, b, c, d, e] = content.root.children;
    expect(a).toEqual({ id: 'a', label: 'a', children: [], customColor: '#aabbcc' });
    expect(b).toEqual({ id: 'b', label: 'b', children: [] });
    expect(c).toEqual({ id: 'c', label: 'c', children: [], colorNone: true });
    expect(d).toEqual({ id: 'd', label: 'd', children: [], color: 'green' });
    expect(e).toEqual({ id: 'e', label: 'e', children: [] });
  });

  it('låter en karta utan de nya fälten vara som förut', () => {
    const raw = { root: { id: 'r', label: 'r', children: [{ id: 'a', label: 'a', children: [], color: 'blue' }] }, layout: 'right' };
    expect(sanitizeMindmap(raw)).toEqual(raw);
  });

  it('tvättar nyanserna i dokumentet; saknas de blir det inget fält', () => {
    const base = { root: { id: 'r', label: 'r', children: [] } };
    expect(sanitizeMindmapDoc({ ...base, shading: 'soft' }).shading).toBe('soft');
    expect(sanitizeMindmapDoc({ ...base, shading: 'mycket' }).shading).toBeUndefined();
    expect('shading' in sanitizeMindmapDoc(base)).toBe(false);
    expect(defaultMindmapDoc().shading).toBe('short');
  });
});
