import type { MindmapColor, MindmapContent } from '@/types/mindmap';
import { layoutMindmap, MINDMAP_METRICS, type MindmapLayoutResult } from './mindmapLayout';

/*
 * Ritar en mindmap på en Canvas, med en palett som anroparen läser ur sin
 * CSS. Samma layout som på skärmen (layoutMindmap), så att bilden blir det
 * man ser. Kräver en webbläsare och testas inte; logiken som går att testa
 * ligger i mindmapLayout.
 *
 * Lyft ur workspace-kortets mindmapExport.ts när kärnan blev delad
 * (docs/plans/mindmap-sida.md, steg 0). Kortet läser sin palett ur
 * `.ws-mindmap` och anropar hit.
 */

/** Exportens skala. 2x blir skarpt i ett dokument och på en projektor. */
const IMAGE_SCALE = 2;

export interface MindmapPalette {
  background: string;
  line: string;
  text: string;
  nodeBg: string;
  nodeBorder: string;
  rootBg: string;
  rootBorder: string;
  badgeBg: string;
  badgeText: string;
  colors: Record<MindmapColor, string>;
  font: string;
  rootFont: string;
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.min(h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
}

/** Ritar kartan på en ny canvas. Hopfällda grenar ritas hopfällda, som på skärmen. */
export function renderMindmapCanvas(content: MindmapContent, palette: MindmapPalette): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas saknas');

  const measure = (text: string, isRoot: boolean) => {
    ctx.font = isRoot ? palette.rootFont : palette.font;
    return ctx.measureText(text).width;
  };
  const layout: MindmapLayoutResult = layoutMindmap(content, measure);
  const m = MINDMAP_METRICS;

  canvas.width = layout.width * IMAGE_SCALE;
  canvas.height = layout.height * IMAGE_SCALE;
  ctx.scale(IMAGE_SCALE, IMAGE_SCALE);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, layout.width, layout.height);

  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1.5;
  layout.edges.forEach((edge) => {
    const mid = (edge.x1 + edge.x2) / 2;
    ctx.beginPath();
    ctx.moveTo(edge.x1, edge.y1);
    ctx.bezierCurveTo(mid, edge.y1, mid, edge.y2, edge.x2, edge.y2);
    ctx.stroke();
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  layout.nodes.forEach((node) => {
    const border = node.isRoot ? m.rootBorder : m.border;
    const pad = node.isRoot ? m.rootPadX : m.padX;
    // Kanten ritas på insidan, som border-box i kortet.
    pill(ctx, node.x + border / 2, node.y + border / 2, node.width - border, node.height - border);
    ctx.fillStyle = node.color
      ? palette.colors[node.color]
      : node.isRoot ? palette.rootBg : palette.nodeBg;
    ctx.fill();
    ctx.lineWidth = border;
    ctx.strokeStyle = node.isRoot ? palette.rootBorder : palette.nodeBorder;
    ctx.stroke();

    const cy = node.y + node.height / 2;
    ctx.font = node.isRoot ? palette.rootFont : palette.font;
    ctx.fillStyle = palette.text;
    ctx.fillText(node.label, node.x + border + pad + node.labelWidth / 2, cy);

    if (node.hiddenCount > 0) {
      const bx = node.x + border + pad + node.labelWidth + m.badgeWidth / 2;
      ctx.font = palette.font;
      ctx.fillStyle = palette.badgeText;
      ctx.fillText(`+${node.hiddenCount}`, bx, cy);
    }
  });
  return canvas;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bilden kunde inte skapas'))), 'image/png');
  });
}
