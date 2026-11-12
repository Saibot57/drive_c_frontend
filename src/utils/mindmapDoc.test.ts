import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import {
  changedLabel,
  cleanMindmapName,
  copyName,
  crossLinkAllowed,
  defaultMindmapDoc,
  pruneCrossLinks,
  removeNodeFromDoc,
  sanitizeLastOpen,
  sanitizeMap,
  sanitizeMindmapDoc,
  sanitizeSummary,
  sortSummaries,
  upsertSummary,
} from './mindmapDoc';

const n = (id: string, children: MindmapNode[] = []): MindmapNode => ({ id, label: id, children });

const doc = (): MindmapDoc => ({
  root: n('r', [n('a', [n('a1'), n('a2')]), n('b')]),
  layout: 'right',
  crossLinks: [{ id: 'l1', from: 'a1', to: 'b' }],
});

describe('tvärlänkarnas regler', () => {
  it('tillåter en länk mellan två grenar men inte till sig själv eller förälder–barn', () => {
    const d = doc();
    expect(crossLinkAllowed(d, 'a2', 'b')).toBe(true);
    expect(crossLinkAllowed(d, 'a', 'a')).toBe(false);
    expect(crossLinkAllowed(d, 'a', 'a1')).toBe(false);
    expect(crossLinkAllowed(d, 'a1', 'a')).toBe(false);
    expect(crossLinkAllowed(d, 'a1', 'finns-inte')).toBe(false);
  });

  it('tillåter högst en länk per par, oavsett riktning', () => {
    const d = doc();
    expect(crossLinkAllowed(d, 'a1', 'b')).toBe(false);
    expect(crossLinkAllowed(d, 'b', 'a1')).toBe(false);
  });

  it('rensar länkar som inte stämmer och lämnar objektet orört annars', () => {
    const d = doc();
    expect(pruneCrossLinks(d)).toBe(d);
    const bad: MindmapDoc = { ...d, crossLinks: [...d.crossLinks!, { id: 'x', from: 'a', to: 'a1' }, { id: 'y', from: 'b', to: 'a1' }] };
    expect(pruneCrossLinks(bad).crossLinks).toEqual([{ id: 'l1', from: 'a1', to: 'b' }]);
  });
});

describe('sanitizeMindmapDoc', () => {
  it('läser trädet och tvärlänkarna, och ger id åt länkar som saknar', () => {
    const d = sanitizeMindmapDoc({
      root: { id: 'r', label: 'R', children: [{ id: 'a', label: 'A', children: [] }, { id: 'b', label: 'B', children: [] }] },
      crossLinks: [
        { from: 'a', to: 'b', label: 'leder till', arrow: 'both' },
        { id: 'l1', from: 'b', to: 'a' },
        { id: 'l2', from: 'a', to: 'nej' },
        { id: 'l3', from: 'a', to: 'r' },
        'skräp',
        { id: 'l4', from: 'a', to: 'b', arrow: 'to' },
      ],
    });
    expect(d.crossLinks).toEqual([{ id: 'l1', from: 'a', to: 'b', label: 'leder till', arrow: 'both' }]);
  });

  it('ger ett dokument utan crossLinks när det inte finns några', () => {
    const d = sanitizeMindmapDoc({ root: { id: 'r', label: 'R', children: [] }, crossLinks: 'nej' });
    expect('crossLinks' in d).toBe(false);
    expect(sanitizeMindmapDoc(null).root.label).toBe('Central nod');
  });

  it('har ett förval som är kortets', () => {
    expect(defaultMindmapDoc().root.children).toEqual([]);
    expect(defaultMindmapDoc().layout).toBe('right');
  });
});

describe('removeNodeFromDoc', () => {
  it('tar bort grenen och länkarna in i den', () => {
    const result = removeNodeFromDoc(doc(), 'a');
    expect(result).not.toBeNull();
    expect(result!.doc.root.children.map((c) => c.id)).toEqual(['b']);
    expect(result!.doc.crossLinks).toEqual([]);
    expect(result!.doc.layout).toBe('right');
  });

  it('behåller länkar som inte berörs och vägrar roten', () => {
    const result = removeNodeFromDoc(doc(), 'a2')!;
    expect(result.doc.crossLinks).toEqual([{ id: 'l1', from: 'a1', to: 'b' }]);
    expect(removeNodeFromDoc(doc(), 'r')).toBeNull();
  });
});

describe('listan', () => {
  it('tvättar en rad och en karta', () => {
    expect(sanitizeSummary({ id: 'm1', name: '  ', version: 2, updatedAt: '2026-11-10T10:00:00' }))
      .toEqual({ id: 'm1', name: 'Ny karta', version: 2, createdAt: null, updatedAt: '2026-11-10T10:00:00' });
    expect(sanitizeSummary({ id: 'm1', version: '2' })).toBeNull();
    expect(sanitizeSummary({ name: 'x', version: 1 })).toBeNull();
    expect(sanitizeSummary(null)).toBeNull();
    const map = sanitizeMap({ id: 'm1', name: 'Karta', version: 1, doc: 'trasigt' });
    expect(map?.doc.root.label).toBe('Central nod');
  });

  it('sorterar senast ändrad först och ersätter en rad', () => {
    const a = { id: 'a', name: 'A', version: 1, createdAt: null, updatedAt: '2026-11-01T10:00:00' };
    const b = { id: 'b', name: 'B', version: 1, createdAt: null, updatedAt: '2026-11-05T10:00:00' };
    expect(sortSummaries([a, b]).map((x) => x.id)).toEqual(['b', 'a']);
    const updated = upsertSummary([a, b], { ...a, name: 'A2', updatedAt: '2026-11-09T10:00:00' });
    expect(updated.map((x) => `${x.id}:${x.name}`)).toEqual(['a:A2', 'b:B']);
  });

  it('namn: trimmar, klipper, ger reserv och numrerar kopior', () => {
    expect(cleanMindmapName('  Hej  ')).toBe('Hej');
    expect(cleanMindmapName('   ')).toBe('Ny karta');
    expect(cleanMindmapName('x'.repeat(200)).length).toBe(150);
    expect(copyName('Karta', [])).toBe('Kopia av Karta');
    expect(copyName('Karta', ['Kopia av Karta'])).toBe('Kopia av Karta (2)');
    expect(copyName('Karta', ['Kopia av Karta', 'Kopia av Karta (2)'])).toBe('Kopia av Karta (3)');
  });

  it('ändrad-etiketten visar tid i dag och datum annars', () => {
    const now = new Date(2026, 10, 10, 15, 0);
    expect(changedLabel('2026-11-10T13:32:00', now)).toBe('Ändrad 14:32');
    expect(changedLabel('2026-09-28T13:32:00', now)).toBe('Ändrad 28 sep');
    expect(changedLabel(null, now)).toBe('');
    expect(changedLabel('skräp', now)).toBe('');
  });

  it('läser det senast öppnade id:t bara om det ser ut som ett id', () => {
    expect(sanitizeLastOpen('3f2a-ABC_1')).toBe('3f2a-ABC_1');
    expect(sanitizeLastOpen('inte giltigt!')).toBeNull();
    expect(sanitizeLastOpen(42)).toBeNull();
  });
});

describe('kartans linjer (docs/plans/mindmap-placering.md)', () => {
  it('en ny karta fäster i närmaste kant med kurvor', () => {
    expect(defaultMindmapDoc().lines).toEqual({ shape: 'curve', anchor: 'nearest' });
  });

  it('tvätten behåller kända val och tar bort okända', () => {
    const root = { id: 'r', label: 'R', children: [] };
    expect(sanitizeMindmapDoc({ root, lines: { shape: 'elbow', anchor: 'nearest' } }).lines).toEqual({ shape: 'elbow', anchor: 'nearest' });
    expect(sanitizeMindmapDoc({ root, lines: { shape: 'zigzag', anchor: 'side' } }).lines).toEqual({ anchor: 'side' });
    expect(sanitizeMindmapDoc({ root, lines: { shape: 1 } }).lines).toBeUndefined();
    expect(sanitizeMindmapDoc({ root, lines: 'curve' }).lines).toBeUndefined();
    expect(sanitizeMindmapDoc({ root }).lines).toBeUndefined();
  });
});

describe('rutnätet', () => {
  it('behålls bara som true', () => {
    const root = { id: 'r', label: 'R', children: [] };
    expect(sanitizeMindmapDoc({ root, grid: true }).grid).toBe(true);
    expect(sanitizeMindmapDoc({ root, grid: 'ja' }).grid).toBeUndefined();
    expect(sanitizeMindmapDoc({ root }).grid).toBeUndefined();
  });
});
