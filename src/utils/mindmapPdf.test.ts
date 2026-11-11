import { describe, expect, it } from 'vitest';
import { MINDMAP_PDF, planMindmapPdf } from '@/utils/mindmapPdf';

const A4 = { width: 841.89, height: 595.28 };
const A3 = { width: 1190.55, height: 841.89 };

/** Punkter per tum på sidan, ur canvasens bildpunkter och bildens bredd i pt. */
const dpiOf = (plan: ReturnType<typeof planMindmapPdf>, width: number) =>
  (width * plan.canvasScale) / (plan.drawWidth / 72);

describe('planMindmapPdf', () => {
  it('lägger en vanlig karta på liggande A4, centrerad innanför marginalen', () => {
    const plan = planMindmapPdf(1200, 700);
    expect(plan.format).toBe('a4');
    expect(plan.pageWidth).toBeCloseTo(A4.width);
    expect(plan.pageHeight).toBeCloseTo(A4.height);
    const m = MINDMAP_PDF.margin;
    expect(plan.drawWidth).toBeCloseTo(A4.width - 2 * m);
    expect(plan.x).toBeCloseTo(m);
    expect(plan.y + plan.drawHeight / 2).toBeCloseTo(A4.height / 2);
    expect(plan.drawWidth / plan.drawHeight).toBeCloseTo(1200 / 700);
  });

  it('tar A3 när kartan skulle bli för liten på A4', () => {
    const plan = planMindmapPdf(3000, 1200);
    expect(plan.format).toBe('a3');
    expect(plan.pageWidth).toBeCloseTo(A3.width);
    expect(plan.drawWidth).toBeCloseTo(A3.width - 2 * MINDMAP_PDF.margin);
  });

  it('tar A3 också för en hög karta, och fyller då höjden', () => {
    const plan = planMindmapPdf(600, 1800);
    expect(plan.format).toBe('a3');
    expect(plan.drawHeight).toBeCloseTo(A3.height - 2 * MINDMAP_PDF.margin);
    expect(plan.x + plan.drawWidth / 2).toBeCloseTo(A3.width / 2);
  });

  it('förstorar inte en liten karta mer än en punkt per px', () => {
    const plan = planMindmapPdf(200, 60);
    expect(plan.format).toBe('a4');
    expect(plan.drawWidth).toBe(200);
    expect(plan.drawHeight).toBe(60);
  });

  it.each([[200, 60], [1200, 700], [3000, 1200], [600, 1800], [20000, 400]])(
    'ger minst 150 punkter per tum för %i × %i',
    (w, h) => {
      const plan = planMindmapPdf(w, h);
      expect(dpiOf(plan, w)).toBeGreaterThanOrEqual(150);
      expect(Math.max(w, h) * plan.canvasScale).toBeLessThanOrEqual(MINDMAP_PDF.maxCanvasSide);
    },
  );

  it('håller canvasen under webbläsarens gräns när upplösningen skulle ta den över', () => {
    const plan = planMindmapPdf(1200, 700, { dpi: 2400 });
    expect(1200 * plan.canvasScale).toBeCloseTo(MINDMAP_PDF.maxCanvasSide);
  });

  it('klarar en tom eller trasig storlek', () => {
    const plan = planMindmapPdf(0, Number.NaN);
    expect(plan.format).toBe('a4');
    expect(Number.isFinite(plan.canvasScale) && plan.canvasScale > 0).toBe(true);
  });
});
