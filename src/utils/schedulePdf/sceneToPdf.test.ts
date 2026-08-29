import { describe, expect, it } from 'vitest';
import { buildScene } from './buildScene';
import { createJsPdfMeasurer } from './jspdfMeasurer';
import { sceneToPdf } from './sceneToPdf';
import { buildExportFilename, toFileSlug } from './index';
import { entry, input, normalWeek } from './__fixtures__/scenes';
import { PAPER, PX_TO_PT } from './theme';

const measure = createJsPdfMeasurer();
const scene = (overrides = {}) => buildScene(input(overrides), measure);
const raw = (doc: ReturnType<typeof sceneToPdf>) =>
  Buffer.from(doc.output('arraybuffer')).toString('latin1');

describe('jsPDF-mätaren', () => {
  it('är skaloberoende', () => {
    const at10 = measure.width('Matematik', 'title', 10);
    const at20 = measure.width('Matematik', 'title', 20);
    expect(at20).toBeCloseTo(at10 * 2);
  });

  it('mäter monospace som monospace', () => {
    expect(measure.width('08:30', 'mono', 10)).toBeCloseTo(5 * 6);
  });

  it('mäter tom sträng till noll', () => {
    expect(measure.width('', 'body', 12)).toBe(0);
  });
});

describe('sceneToPdf', () => {
  it('ger ett giltigt dokument på exakt en sida', () => {
    const doc = sceneToPdf(scene({ schedule: normalWeek() }));
    expect(raw(doc).startsWith('%PDF-')).toBe(true);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('ryms på en sida även för en hel dag på A4', () => {
    const doc = sceneToPdf(
      scene({ schedule: [entry({ endTime: '17:00', duration: 540 })], pageMode: 'a4' })
    );
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(PAPER.a4.widthPt, 1);
  });

  it('sätter sidan till schemats egna mått i digitalt läge', () => {
    const built = scene({ schedule: normalWeek() });
    const doc = sceneToPdf(built);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(built.widthPx * PX_TO_PT, 1);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(built.heightPx * PX_TO_PT, 1);
  });

  it('skriver texten som text, inte som bild', () => {
    // Själva kravet "äkta vektor" — kurstiteln ska gå att hitta i
    // innehållsströmmen som en textoperator.
    const doc = sceneToPdf(scene({ schedule: [entry({ title: 'Matematik' })] }), {
      compress: false,
    });
    const stream = raw(doc);
    expect(stream).toContain('(Matematik) Tj');
    // `/ProcSet [... /ImageB ...]` står alltid i resursordboken, så det är
    // XObject-bilder man ska leta efter.
    expect(stream).not.toContain('/Subtype /Image');
  });
});

describe('filnamn', () => {
  it('gör arkivnamnet till en slug och behåller svenska tecken', () => {
    expect(toFileSlug('v.35')).toBe('v-35');
    expect(toFileSlug('Höstterminen 2026')).toBe('Höstterminen-2026');
    expect(toFileSlug('  ')).toBe('schema');
    expect(toFileSlug(null)).toBe('schema');
  });

  it('namnger filen efter arkiv och sidläge', () => {
    expect(buildExportFilename({ archiveName: 'v.35', pageMode: 'a3' }, 'pdf'))
      .toBe('schema-v-35-a3.pdf');
    expect(buildExportFilename({ archiveName: 'v.35', pageMode: 'digital' }, 'jpeg'))
      .toBe('schema-v-35-digital.jpg');
  });
});
