import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildXlsx, workbookXml, worksheetXml } from '@/utils/xlsx';

// Zippen provas i Node. Under jsdom känner fflate inte igen sina egna
// byte-arrayer (de kommer från en annan realm), vilket inte händer i webbläsaren.
// Att XML:en går att läsa provas i xlsx.test.ts.

const sheet = {
  name: 'Noteringar',
  columns: ['Datum', 'Elev'],
  rows: [[{ date: '2026-11-16' }, 'Åsa Öberg']],
};

describe('filen', () => {
  it('är en zip med de delar Excel kräver', () => {
    const files = unzipSync(buildXlsx(sheet));
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    expect(strFromU8(files['xl/worksheets/sheet1.xml'])).toBe(worksheetXml(sheet));
    expect(strFromU8(files['xl/workbook.xml'])).toBe(workbookXml(sheet));
    expect(strFromU8(files['[Content_Types].xml'])).toContain('/xl/worksheets/sheet1.xml');
  });
});
