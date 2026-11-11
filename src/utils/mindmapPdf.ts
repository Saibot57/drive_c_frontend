/*
 * Kartan som PDF: en sida, liggande A4 eller A3 (beslutat 2026-11-10, ingen
 * uppdelning på flera sidor). Sidformatet och skalan räknas av den rena
 * planMindmapPdf, som testas; mindmapPdfBlob lägger bilden på sidan och
 * kräver en webbläsare.
 *
 * Bilden är den som PNG-exporten ritar (renderMindmapCanvas med bilder,
 * symboler och tvärlänkar), bara i en annan skala: så många bildpunkter att
 * den får minst 150 punkter per tum på sidan, men aldrig mer än 8 000 px på
 * längsta sidan, som webbläsarna klarar.
 */

export const MINDMAP_PDF = {
  /** Marginal runt bilden, i pt (10 mm). */
  margin: 28,
  /** Liggande sidor i pt. */
  pages: {
    a4: { width: 841.89, height: 595.28 },
    a3: { width: 1190.55, height: 841.89 },
  },
  /**
   * Under så här många pt per px i kartan blir texten för liten på A4
   * (14 px blir 7 pt); då tas A3, som är √2 gånger större.
   */
  minA4Scale: 0.5,
  /** En liten karta förstoras inte mer än så: en punkt per px. */
  maxScale: 1,
  /** Upplösningen bilden ritas i. Minst 150 enligt planen; 200 ger lite marginal. */
  dpi: 200,
  maxCanvasSide: 8000,
} as const;

export type MindmapPdfFormat = keyof typeof MINDMAP_PDF.pages;

export interface MindmapPdfPlan {
  format: MindmapPdfFormat;
  pageWidth: number;
  pageHeight: number;
  /** Bildens plats och storlek på sidan, i pt. */
  x: number;
  y: number;
  drawWidth: number;
  drawHeight: number;
  /** Bildpunkter per px i kartan, till `renderMindmapCanvas`. */
  canvasScale: number;
}

const positive = (value: number) => (Number.isFinite(value) && value > 0 ? value : 1);

/** Sidformat, plats och upplösning för en karta med layoutens mått i px. */
export function planMindmapPdf(
  mapWidth: number,
  mapHeight: number,
  options: { dpi?: number; maxCanvasSide?: number } = {},
): MindmapPdfPlan {
  const width = positive(mapWidth);
  const height = positive(mapHeight);
  const m = MINDMAP_PDF.margin;
  const fit = (format: MindmapPdfFormat) => {
    const page = MINDMAP_PDF.pages[format];
    return Math.min((page.width - 2 * m) / width, (page.height - 2 * m) / height);
  };
  const format: MindmapPdfFormat = fit('a4') < MINDMAP_PDF.minA4Scale ? 'a3' : 'a4';
  const page = MINDMAP_PDF.pages[format];
  const scale = Math.min(fit(format), MINDMAP_PDF.maxScale);
  const drawWidth = width * scale;
  const drawHeight = height * scale;

  const dpi = options.dpi ?? MINDMAP_PDF.dpi;
  const maxSide = options.maxCanvasSide ?? MINDMAP_PDF.maxCanvasSide;
  // pt är 1/72 tum: bildpunkter per px = pt per px · punkter per tum / 72.
  const canvasScale = Math.min((scale * dpi) / 72, maxSide / Math.max(width, height));

  return {
    format,
    pageWidth: page.width,
    pageHeight: page.height,
    x: (page.width - drawWidth) / 2,
    y: (page.height - drawHeight) / 2,
    drawWidth,
    drawHeight,
    canvasScale,
  };
}

/**
 * Lägger en färdigritad canvas på en PDF-sida enligt planen och ger filen.
 * jsPDF laddas först här, inte med sidan. Sidan är vit; bilden ritas med
 * Neo-papperets bakgrund, som också är vit.
 */
export async function mindmapPdfBlob(canvas: HTMLCanvasElement, plan: MindmapPdfPlan, title: string): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: plan.format });
  pdf.setProperties({ title });
  // Utan komprimering lägger jsPDF bildpunkterna okomprimerade i filen (flera MB för en liten karta).
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', plan.x, plan.y, plan.drawWidth, plan.drawHeight, undefined, 'FAST');
  return pdf.output('blob');
}
