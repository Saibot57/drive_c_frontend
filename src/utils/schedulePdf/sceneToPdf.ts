/**
 * Scen → jsPDF-dokument.
 *
 * Renderaren äger allt ritstillstånd. jsPDF är ett markör-API där
 * `setFillColor`, `setLineDashPattern` och `setCharSpace` lever mellan anrop,
 * så varje nod som sätter något udda nollställer det direkt efteråt — annars
 * läcker ett planeringsblocks streckade ram in i nästa dagkolumns rutnätslinjer.
 */

import jsPDF from 'jspdf';
import { Rgb, ScheduleScene, SceneNode } from './scene';
import { SceneTransform, toPt, toPtX, toPtY } from './transform';
import { FONTS } from './fonts';
import { MIN_STROKE_PT } from './theme';

const stroke = (widthPx: number, t: SceneTransform) =>
  Math.max(MIN_STROKE_PT, toPt(widthPx, t));

const applyFill = (doc: jsPDF, color: Rgb) => doc.setFillColor(color.r, color.g, color.b);
const applyDraw = (doc: jsPDF, color: Rgb) => doc.setDrawColor(color.r, color.g, color.b);

const drawNode = (doc: jsPDF, node: SceneNode, t: SceneTransform) => {
  switch (node.kind) {
    case 'rect': {
      const x = toPtX(node.x, t);
      const y = toPtY(node.y, t);
      const w = toPt(node.w, t);
      const h = toPt(node.h, t);
      if (w <= 0 || h <= 0) return;

      const style = node.fill && node.stroke ? 'FD' : node.fill ? 'F' : node.stroke ? 'S' : null;
      if (!style) return;

      if (node.fill) applyFill(doc, node.fill);
      if (node.stroke) {
        applyDraw(doc, node.stroke);
        doc.setLineWidth(stroke(node.strokeWidth ?? 1, t));
      }
      if (node.dash) doc.setLineDashPattern([toPt(node.dash[0], t), toPt(node.dash[1], t)], 0);

      const radius = node.radius ? toPt(node.radius, t) : 0;
      if (radius > 0) doc.roundedRect(x, y, w, h, radius, radius, style);
      else doc.rect(x, y, w, h, style);

      if (node.dash) doc.setLineDashPattern([], 0);
      return;
    }

    case 'line': {
      applyDraw(doc, node.stroke);
      doc.setLineWidth(stroke(node.strokeWidth, t));
      doc.line(toPtX(node.x1, t), toPtY(node.y1, t), toPtX(node.x2, t), toPtY(node.y2, t));
      return;
    }

    case 'text': {
      if (!node.text) return;
      const { name, style } = FONTS[node.font];
      doc.setFont(name, style);
      doc.setFontSize(toPt(node.sizePx, t));
      doc.setTextColor(node.color.r, node.color.g, node.color.b);
      // jsPDF ritar mot alfabetisk baslinje, vilket är exakt vad scenens `y` är.
      doc.text(node.text, toPtX(node.x, t), toPtY(node.y, t), {
        align: node.align ?? 'left',
        charSpace: node.charSpacePx ? toPt(node.charSpacePx, t) : 0,
      });
      return;
    }

    case 'link':
      doc.link(toPtX(node.x, t), toPtY(node.y, t), toPt(node.w, t), toPt(node.h, t), {
        url: node.url,
      });
  }
};

export type PdfOptions = {
  /** Av i tester, så innehållsströmmen går att läsa. */
  compress?: boolean;
};

export const sceneToPdf = (scene: ScheduleScene, options: PdfOptions = {}): jsPDF => {
  const t = scene.transform;
  const doc = new jsPDF({
    unit: 'pt',
    // Digitalt läge har inget pappersformat — sidan *är* schemat.
    format: t.mode === 'digital' ? [t.pageWidthPt, t.pageHeightPt] : t.mode,
    // jsPDF kastar om formatet för att matcha orienteringen, så den måste
    // följa sidans faktiska proportioner och inte antas vara liggande.
    orientation: t.pageWidthPt >= t.pageHeightPt ? 'landscape' : 'portrait',
    compress: options.compress ?? true,
  });

  for (const node of scene.nodes) drawNode(doc, node, t);

  return doc;
};
