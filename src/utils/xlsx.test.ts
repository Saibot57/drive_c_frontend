// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { columnName, dateSerial, sheetName, workbookXml, worksheetXml, xmlSafe } from '@/utils/xlsx';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  expect(doc.getElementsByTagName('parsererror').length).toBe(0);
  return doc;
};

const sheet = {
  name: 'Noteringar',
  columns: ['Datum', 'Start', 'Elev', 'Aktiv', 'Notering'],
  rows: [
    [{ date: '2026-11-16' }, { time: 8 * 60 + 30 }, 'Åsa Öberg', 1, 'Bra fråga'],
    [{ date: '2026-11-17' }, null, 'Bo', null, '=SUMMA(A1) & <b> "citat"\u0001\u0007'],
  ],
};

describe('hjälparna', () => {
  it('ger kolumnernas bokstäver', () => {
    expect([0, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
  });

  it('räknar datum till Excels serietal utan tidszon', () => {
    expect(dateSerial('1900-03-01')).toBe(61);
    expect(dateSerial('2026-11-16')).toBe(46342);
    expect(dateSerial('16/11')).toBeNull();
  });

  it('tar bort tecken som inte får finnas i XML', () => {
    expect(xmlSafe('a\u0000b\u0008c\td\ne￾f\uD800g')).toBe('abc\td\nefg');
    expect(xmlSafe('å 😀')).toBe('å 😀');
  });

  it('gör bladets namn godtagbart för Excel', () => {
    expect(sheetName('Not[er]:ing*?/\\ar')).toBe('Not er  ing    ar');
    expect(sheetName("'x'")).toBe('x');
    expect(sheetName('')).toBe('Blad1');
    expect(sheetName('a'.repeat(40))).toHaveLength(31);
  });
});

describe('bladet', () => {
  const doc = parse(worksheetXml(sheet));
  const cells = Array.from(doc.getElementsByTagName('c'));
  const cell = (ref: string) => cells.find(c => c.getAttribute('r') === ref);

  it('har rubrikraden i fetstil och som text', () => {
    expect(cell('A1')?.getAttribute('s')).toBe('1');
    expect(cell('A1')?.getAttribute('t')).toBe('inlineStr');
    expect(cell('E1')?.textContent).toBe('Notering');
  });

  it('skriver datum, klockslag, tal och text med rätt typ', () => {
    expect(cell('A2')?.getAttribute('s')).toBe('2');
    expect(cell('A2')?.textContent).toBe('46342');
    expect(cell('B2')?.getAttribute('s')).toBe('3');
    expect(Number(cell('B2')?.textContent)).toBeCloseTo(510 / 1440);
    expect(cell('D2')?.getAttribute('t')).toBeNull();
    expect(cell('D2')?.textContent).toBe('1');
    expect(cell('C2')?.textContent).toBe('Åsa Öberg');
  });

  it('hoppar över tomma celler', () => {
    expect(cell('B3')).toBeUndefined();
    expect(cell('D3')).toBeUndefined();
  });

  it('skriver en formel som text och skyddar XML-tecken', () => {
    expect(cell('E3')?.getAttribute('t')).toBe('inlineStr');
    expect(cell('E3')?.getElementsByTagName('f').length).toBe(0);
    expect(cell('E3')?.textContent).toBe('=SUMMA(A1) & <b> "citat"');
  });

  it('låser rubrikraden och sätter filter över hela tabellen', () => {
    const pane = doc.getElementsByTagName('pane')[0];
    expect(pane.getAttribute('ySplit')).toBe('1');
    expect(pane.getAttribute('state')).toBe('frozen');
    expect(doc.getElementsByTagName('autoFilter')[0].getAttribute('ref')).toBe('A1:E3');
    expect(doc.getElementsByTagName('col')).toHaveLength(5);
  });
});

describe('arbetsboken', () => {
  it('går att läsa och har filtrets dolda namn', () => {
    const workbook = parse(workbookXml(sheet));
    expect(workbook.getElementsByTagName('sheet')[0].getAttribute('name')).toBe('Noteringar');
    expect(workbook.getElementsByTagName('definedName')[0].textContent).toBe("'Noteringar'!$A$1:$E$3");
  });
});
