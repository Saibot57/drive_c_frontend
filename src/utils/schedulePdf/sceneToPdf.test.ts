import { describe, expect, it } from 'vitest';
import { buildScene } from './buildScene';
import { createJsPdfMeasurer } from './jspdfMeasurer';
import { sceneToPdf, scenesToPdf } from './sceneToPdf';
import { buildExportFilename } from './index';
import { toFileSlug } from '@/utils/download';
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

describe('scenesToPdf', () => {
  const pageSize = (doc: ReturnType<typeof scenesToPdf>, page: number) => {
    doc.setPage(page);
    return { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight() };
  };

  it('lägger varje scen på en egen sida', () => {
    const doc = scenesToPdf([
      scene({ schedule: normalWeek(), archiveName: 'Ht26 – Anna', pageMode: 'a4' }),
      scene({ schedule: [entry()], archiveName: 'Ht26 – Björn', pageMode: 'a4' }),
      scene({ schedule: [entry()], archiveName: 'Ht26 – Cecilia', pageMode: 'a4' }),
    ], { compress: false });
    expect(doc.getNumberOfPages()).toBe(3);
    const stream = raw(doc);
    ['Anna', 'Björn', 'Cecilia'].forEach(name => expect(stream).toContain(name));
  });

  it('ger varje sida pappersformatet på papper', () => {
    const doc = scenesToPdf([
      scene({ schedule: normalWeek(), pageMode: 'a3' }),
      scene({ schedule: [entry({ endTime: '17:00', duration: 540 })], pageMode: 'a3' }),
    ]);
    [1, 2].forEach(page => {
      expect(pageSize(doc, page).w).toBeCloseTo(PAPER.a3.widthPt, 1);
      expect(pageSize(doc, page).h).toBeCloseTo(PAPER.a3.heightPt, 1);
    });
  });

  it('ger varje sida schemats egna mått i digitalt läge', () => {
    const short = scene({ schedule: [entry()] });
    const long = scene({ schedule: [entry({ endTime: '17:00', duration: 540 })] });
    expect(long.heightPx).toBeGreaterThan(short.heightPx);
    const doc = scenesToPdf([short, long]);
    expect(pageSize(doc, 1).h).toBeCloseTo(short.heightPx * PX_TO_PT, 1);
    expect(pageSize(doc, 2).h).toBeCloseTo(long.heightPx * PX_TO_PT, 1);
  });

  it('ger sidor med samma sluttid samma mått', () => {
    const short = scene({ schedule: [entry()], extraEndMinutes: 17 * 60 });
    const long = scene({ schedule: [entry({ endTime: '17:00', duration: 540 })], extraEndMinutes: 17 * 60 });
    expect(short.heightPx).toBe(long.heightPx);
  });

  it('vägrar en tom lista', () => {
    expect(() => scenesToPdf([])).toThrow();
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
