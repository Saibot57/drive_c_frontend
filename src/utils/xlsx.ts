/**
 * En liten .xlsx-skrivare: ett blad med rubrikrad i fetstil, låst rubrikrad,
 * filter på rubrikraden och kolumnbredder. En .xlsx-fil är en zip med några
 * XML-filer; zippningen görs av `fflate`, som redan fanns via jspdf.
 *
 * Text skrivs alltid som text (`inlineStr`), aldrig som formel, så en cell som
 * börjar med "=" räknas inte ut när filen öppnas.
 */

import { strToU8, zipSync } from 'fflate';

/** En cell: text, tal, datum (`ÅÅÅÅ-MM-DD`), klockslag (minuter efter midnatt) eller tom. */
export type XlsxCell = string | number | { date: string } | { time: number } | null | undefined;

export type XlsxSheet = {
  /** Bladets namn. Tecken som Excel inte tillåter tas bort, och det kortas till 31 tecken. */
  name: string;
  columns: string[];
  rows: XlsxCell[][];
  /** Kolumnbredder i tecken. Saknas en räknas den fram ur innehållet. */
  widths?: (number | undefined)[];
};

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Excel rymmer högst så många tecken i en cell. */
const MAX_CELL_LENGTH = 32767;

const STYLE_HEADER = 1;
const STYLE_DATE = 2;
const STYLE_TIME = 3;

/** Tecken som inte får finnas i XML (styrtecken, ensamma surrogat) tas bort. */
export function xmlSafe(s: string): string {
  return Array.from(s)
    .filter(ch => {
      const c = ch.codePointAt(0) ?? 0;
      if (c === 0x9 || c === 0xa || c === 0xd) return true;
      if (c < 0x20 || c === 0xfffe || c === 0xffff) return false;
      return c < 0xd800 || c > 0xdfff;
    })
    .join('');
}

const esc = (s: string) =>
  xmlSafe(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Kolumnens bokstäver: 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Excels serietal för ett datum (`ÅÅÅÅ-MM-DD`). Räknas utan tidszon, så att dagen inte flyttas. */
export function dateSerial(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return (Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - Date.UTC(1899, 11, 30)) / 864e5;
}

/** Bladets namn som Excel godtar det. */
export function sheetName(name: string): string {
  const clean = xmlSafe(name).replace(/[[\]:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31).trim();
  return clean || 'Blad1';
}

const textCell = (ref: string, text: string, style = 0) =>
  `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${esc(text.slice(0, MAX_CELL_LENGTH))}</t></is></c>`;

function cellXml(ref: string, cell: XlsxCell): string {
  if (cell === null || cell === undefined || cell === '') return '';
  if (typeof cell === 'string') return textCell(ref, cell);
  if (typeof cell === 'number') return Number.isFinite(cell) ? `<c r="${ref}"><v>${cell}</v></c>` : '';
  if ('date' in cell) {
    const serial = dateSerial(cell.date);
    return serial === null ? textCell(ref, cell.date) : `<c r="${ref}" s="${STYLE_DATE}"><v>${serial}</v></c>`;
  }
  return Number.isFinite(cell.time) ? `<c r="${ref}" s="${STYLE_TIME}"><v>${cell.time / 1440}</v></c>` : '';
}

/** Ungefärlig bredd i tecken, för kolumner utan given bredd. */
function cellLength(cell: XlsxCell): number {
  if (cell === null || cell === undefined) return 0;
  if (typeof cell === 'string') return Math.max(...cell.split('\n').map(l => l.length));
  if (typeof cell === 'number') return String(cell).length;
  return 'date' in cell ? 10 : 5;
}

function widthsFor(sheet: XlsxSheet): number[] {
  return sheet.columns.map((title, i) => {
    const given = sheet.widths?.[i];
    if (given) return given;
    const longest = Math.max(title.length, ...sheet.rows.map(r => cellLength(r[i])));
    return Math.min(Math.max(longest + 2, 6), 60);
  });
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

const CONTENT_TYPES = `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
  + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
  + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
  + '</Types>';

const ROOT_RELS = `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">`
  + `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>`
  + '</Relationships>';

const WORKBOOK_RELS = `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">`
  + `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>`
  + `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>`
  + '</Relationships>';

/** Stilarna: 0 vanlig, 1 fetstil (rubrikraden), 2 datum, 3 klockslag. */
const STYLES = `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}">`
  + '<numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="hh:mm"/></numFmts>'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="4">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '</cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '</styleSheet>';

/** Bladets XML. Exporteras för testen. */
export function worksheetXml(sheet: XlsxSheet): string {
  const lastCol = columnName(Math.max(sheet.columns.length, 1) - 1);
  const lastRow = sheet.rows.length + 1;
  const range = `A1:${lastCol}${lastRow}`;
  const cols = widthsFor(sheet)
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');
  const header = `<row r="1">${sheet.columns.map((c, i) => textCell(`${columnName(i)}1`, c, STYLE_HEADER)).join('')}</row>`;
  const body = sheet.rows
    .map((row, r) => `<row r="${r + 2}">${sheet.columns.map((_, i) => cellXml(`${columnName(i)}${r + 2}`, row[i])).join('')}</row>`)
    .join('');
  return `${XML_HEAD}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
    + `<dimension ref="${range}"/>`
    + '<sheetViews><sheetView workbookViewId="0">'
    + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
    + '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>'
    + '</sheetView></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + (cols ? `<cols>${cols}</cols>` : '')
    + `<sheetData>${header}${body}</sheetData>`
    + `<autoFilter ref="${range}"/>`
    + '</worksheet>';
}

/** Arbetsbokens XML. Filtret får sitt dolda namn, som Excel själv skriver. */
export function workbookXml(sheet: XlsxSheet): string {
  const name = sheetName(sheet.name);
  const lastCol = columnName(Math.max(sheet.columns.length, 1) - 1);
  const ref = `'${name.replace(/'/g, "''")}'!$A$1:$${lastCol}$${sheet.rows.length + 1}`;
  return `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
    + `<sheets><sheet name="${esc(name)}" sheetId="1" r:id="rId1"/></sheets>`
    + `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${esc(ref)}</definedName></definedNames>`
    + '</workbook>';
}

/** Hela filen. */
export function buildXlsx(sheet: XlsxSheet): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(ROOT_RELS),
    'xl/workbook.xml': strToU8(workbookXml(sheet)),
    'xl/_rels/workbook.xml.rels': strToU8(WORKBOOK_RELS),
    'xl/styles.xml': strToU8(STYLES),
    'xl/worksheets/sheet1.xml': strToU8(worksheetXml(sheet)),
  }, { level: 6 });
}
