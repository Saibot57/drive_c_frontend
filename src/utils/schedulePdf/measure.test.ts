import { describe, expect, it } from 'vitest';
import { clipWithEllipsis, ELLIPSIS, TextMeasurer, truncateToWidth, wrapText } from './measure';

/** Varje tecken är halva fontstorleken bred, så förväntningarna går att räkna. */
const measure: TextMeasurer = {
  width: (text, _font, sizePx) => text.length * sizePx * 0.5,
  ascentRatio: () => 0.8,
};

const wrap = (text: string, maxWidthPx: number) =>
  wrapText(text, maxWidthPx, 'body', 10, measure);

describe('wrapText', () => {
  it('bryter giriga rader på mellanslag', () => {
    // 5 px per tecken → 50 px rymmer 10 tecken.
    expect(wrap('ab cd ef gh', 50)).toEqual(['ab cd ef', 'gh']);
  });

  it('lämnar text som ryms orörd', () => {
    expect(wrap('kort', 100)).toEqual(['kort']);
  });

  it('bevarar explicita radbrytningar', () => {
    expect(wrap('ett\ntvå', 100)).toEqual(['ett', 'två']);
  });

  it('behåller tomma rader som medvetet avstånd', () => {
    expect(wrap('ett\n\ntvå', 100)).toEqual(['ett', '', 'två']);
  });

  it('kollapsar löpande blanksteg', () => {
    expect(wrap('ett    två', 100)).toEqual(['ett två']);
    expect(wrap('  kantat  ', 100)).toEqual(['kantat']);
  });

  it('bryter inuti ett ord som inte ryms ens ensamt', () => {
    // `overflow-wrap: anywhere` gäller allt i kortet. jsPDF:s splitTextToSize
    // lämnar i stället en överbred rad, vilket inte går att gömma längre.
    expect(wrap('abcdefghij', 25)).toEqual(['abcde', 'fghij']);
  });

  it('lämnar aldrig en rad bredare än maxbredden', () => {
    const lines = wrap('kortord superkalifragilistiskexpialidokus och', 40);
    for (const line of lines) {
      expect(measure.width(line, 'body', 10)).toBeLessThanOrEqual(40);
    }
  });

  it('ger tom lista för tom text', () => {
    expect(wrap('', 100)).toEqual([]);
  });
});

describe('truncateToWidth', () => {
  const truncate = (text: string, maxWidthPx: number) =>
    truncateToWidth(text, maxWidthPx, 'body', 10, measure);

  it('lämnar text som ryms orörd', () => {
    expect(truncate('kort', 100)).toBe('kort');
  });

  it('gör plats åt ellipsen', () => {
    // 40 px rymmer 8 tecken; ett måste vara "…".
    const result = truncate('abcdefghijkl', 40);
    expect(result.endsWith(ELLIPSIS)).toBe(true);
    expect(measure.width(result, 'body', 10)).toBeLessThanOrEqual(40);
  });

  it('städar bort blanksteg före ellipsen', () => {
    // 20 px rymmer 4 tecken, och snittet landar direkt efter mellanslaget.
    expect(truncate('ab cdefgh', 20)).toBe(`ab${ELLIPSIS}`);
  });

  it('ger tom sträng när inte ens ellipsen ryms', () => {
    expect(truncate('abc', 2)).toBe('');
  });
});

describe('clipWithEllipsis', () => {
  const clip = (text: string, maxWidthPx: number) =>
    clipWithEllipsis(text, maxWidthPx, 'body', 10, measure);

  it('sätter ellips även på text som redan ryms', () => {
    // Skillnaden mot truncateToWidth: raden under klipptes bort, så den här
    // raden måste säga att det finns mer.
    expect(clip('kort', 100)).toBe(`kort${ELLIPSIS}`);
  });

  it('kortar av när texten plus ellips inte ryms', () => {
    expect(clip('abcdefghij', 25)).toBe(`abcd${ELLIPSIS}`);
  });

  it('ger tom sträng när inte ens ellipsen ryms', () => {
    expect(clip('abc', 2)).toBe('');
  });
});
