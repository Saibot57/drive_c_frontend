import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MindmapDoc } from '@/types/mindmapDoc';
import {
  MAX_IMPORT_BYTES,
  MINDMAP_FILE_FORMAT,
  MINDMAP_FILE_VERSION,
  importNameFromFile,
  isCopyImageKey,
  mindmapExportName,
  parseMindmapFile,
  toMindmapFile,
} from '@/utils/mindmapFile';
import { MindmapImportError } from '@/utils/mindmapMup';

const FULL: MindmapDoc = {
  root: {
    id: 'r',
    label: 'Rot',
    children: [
      {
        id: 'a',
        label: 'Gren',
        side: 'left',
        color: 'pink',
        note: 'Anteckning\nrad två',
        link: 'https://example.com',
        icon: 'star',
        image: { source: { kind: 'gdrive', fileId: 'f1' }, width: 160, aspect: 0.75 },
        offset: { dx: 12, dy: -8 },
        collapsed: true,
        children: [{ id: 'b', label: 'Barn', children: [] }],
      },
      { id: 'c', label: 'Annan', side: 'right', children: [] },
    ],
  },
  layout: 'both',
  crossLinks: [{ id: 'l1', from: 'b', to: 'c', label: 'stöd', arrow: 'both', color: 'green' }],
};

const fixture = (name: string) => readFileSync(resolve(process.cwd(), 'src/utils/mindmap/__fixtures__', name), 'utf8');

describe('sidans eget format', () => {
  it('ut och in ger samma dokument och namn', () => {
    const text = toMindmapFile('Min karta', FULL);
    const parsed = parseMindmapFile(text, 'vad-som-helst.json');
    expect(parsed).toEqual({ name: 'Min karta', doc: FULL, kind: 'json' });
  });

  it('har ett omslag med formatnamn och version', () => {
    const wrapped = JSON.parse(toMindmapFile('Karta', FULL));
    expect(wrapped.format).toBe(MINDMAP_FILE_FORMAT);
    expect(wrapped.version).toBe(MINDMAP_FILE_VERSION);
    expect(wrapped.name).toBe('Karta');
    expect(wrapped.doc.root.id).toBe('r');
  });

  it('tvättar det som läses in', () => {
    const text = JSON.stringify({
      format: MINDMAP_FILE_FORMAT,
      version: 1,
      name: '  ',
      doc: {
        root: { id: 'r', label: 'Rot', children: [{ id: 'a', label: 'A', color: 'orange', link: 'javascript:alert(1)', children: [] }] },
        crossLinks: [{ from: 'r', to: 'a' }],
      },
    });
    const { name, doc } = parseMindmapFile(text, 'Prov.json');
    expect(name).toBe('Rot');
    expect(doc.root.children[0]).toEqual({ id: 'a', label: 'A', children: [] });
    // Förälder–barn är ingen tillåten tvärlänk.
    expect(doc.crossLinks ?? []).toEqual([]);
  });

  it.each([
    ['ett nyare format', { format: MINDMAP_FILE_FORMAT, version: 2, name: 'x', doc: { root: { id: 'r', label: 'R', children: [] } } }, /nyare/],
    ['ett dokument utan rot', { format: MINDMAP_FILE_FORMAT, version: 1, name: 'x', doc: {} }, /trasig/],
    ['en rot som inte är ett objekt', { format: MINDMAP_FILE_FORMAT, version: 1, name: 'x', doc: { root: 'r' } }, /trasig/],
  ])('avvisar %s', (_what, raw, message) => {
    expect(() => parseMindmapFile(JSON.stringify(raw), 'x.json')).toThrow(message);
  });
});

describe('parseMindmapFile', () => {
  it('känner igen MindMup i båda formerna', () => {
    expect(parseMindmapFile(fixture('mup-v2.json'), 'Revolution.mup')).toMatchObject({ kind: 'mup', name: 'Franska revolutionen' });
    expect(parseMindmapFile(fixture('mup-v3.json'), 'eko.mup')).toMatchObject({ kind: 'mup', name: 'Ekosystem' });
  });

  it('ger filnamnet som namn när kartan saknar titel', () => {
    expect(parseMindmapFile(JSON.stringify({ id: 1, title: '' }), 'Min plan.mup').name).toBe('Min plan');
  });

  it.each([
    ['text som inte är JSON', 'inte json {', /JSON/],
    ['en tom fil', '   ', /tom/],
    ['ett okänt JSON-objekt', '{"hej": 1}', /varken/],
    ['en lista', '[1, 2]', /varken/],
  ])('kastar ett svenskt fel för %s', (_what, text, message) => {
    expect(() => parseMindmapFile(text, 'x.mup')).toThrow(MindmapImportError);
    expect(() => parseMindmapFile(text, 'x.mup')).toThrow(message);
  });
});

describe('namn och filnamn', () => {
  it('tar filnamnet utan ändelse som namn', () => {
    expect(importNameFromFile('Franska revolutionen.mup')).toBe('Franska revolutionen');
    expect(importNameFromFile('karta.backup.json')).toBe('karta.backup');
    expect(importNameFromFile('.mup')).toBe('Importerad karta');
  });

  it('ger exportens filnamn ur kartans namn, annars ur roten', () => {
    expect(mindmapExportName('Vecka 12: Ekologi', 'Rot', 'pdf')).toBe('Vecka-12-Ekologi.pdf');
    expect(mindmapExportName('', 'Rotnod', 'md')).toBe('Rotnod.md');
    expect(mindmapExportName('', '', 'json')).toBe('mindmap.json');
  });

  it('har en övre gräns för filens storlek', () => {
    expect(MAX_IMPORT_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe('isCopyImageKey', () => {
  const key = (code: string, mods: Partial<{ altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) =>
    ({ code, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...mods });

  it('är Alt+Shift+C, läst med code (Alt ger specialtecken på Mac)', () => {
    expect(isCopyImageKey(key('KeyC', { altKey: true, shiftKey: true }))).toBe(true);
  });

  it.each([
    ['C', key('KeyC')],
    ['Alt+C', key('KeyC', { altKey: true })],
    ['Ctrl+Shift+C (inspektören)', key('KeyC', { ctrlKey: true, shiftKey: true })],
    ['Ctrl+Alt+Shift+C', key('KeyC', { ctrlKey: true, altKey: true, shiftKey: true })],
    ['Alt+Shift+V', key('KeyV', { altKey: true, shiftKey: true })],
  ])('inte %s', (_what, e) => {
    expect(isCopyImageKey(e)).toBe(false);
  });
});
