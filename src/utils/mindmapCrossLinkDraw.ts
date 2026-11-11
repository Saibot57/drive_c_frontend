import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapPalette } from '@/utils/mindmap/mindmapDraw';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { crossLinkGeometry } from '@/utils/mindmapCrossLinks';

/*
 * Ritar tvärlänkarna på bildexportens Canvas, med samma former som
 * SVG-lagret på skärmen (crossLinkGeometry). Speglar .mm__link i mindmap.css:
 * en streckad linje i linjefärgen, och under den en bred linje i länkens
 * färg. Kräver en webbläsare och testas inte; formerna testas i
 * mindmapCrossLinks.test.ts.
 */
export function drawCrossLinks(
  ctx: CanvasRenderingContext2D,
  layout: MindmapLayoutResult,
  doc: MindmapDoc,
  palette: MindmapPalette,
): void {
  const shapes = crossLinkGeometry(layout, doc);
  if (shapes.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  shapes.forEach((shape) => {
    const curve = () => {
      ctx.beginPath();
      ctx.moveTo(shape.start.x, shape.start.y);
      ctx.quadraticCurveTo(shape.control.x, shape.control.y, shape.end.x, shape.end.y);
    };
    if (shape.link.color) {
      curve();
      ctx.setLineDash([]);
      ctx.lineWidth = 6;
      ctx.strokeStyle = palette.colors[shape.link.color];
      ctx.stroke();
    }
    curve();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = palette.line;
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = palette.line;
    shape.heads.forEach((head) => {
      ctx.beginPath();
      ctx.moveTo(head[0].x, head[0].y);
      ctx.lineTo(head[1].x, head[1].y);
      ctx.lineTo(head[2].x, head[2].y);
      ctx.closePath();
      ctx.fill();
    });

    const label = shape.link.label?.trim();
    if (label) {
      ctx.font = palette.font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Bakgrundsfärgen runt texten, så att den går att läsa över kurvan.
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = palette.background;
      ctx.strokeText(label, shape.middle.x, shape.middle.y);
      ctx.fillStyle = palette.text;
      ctx.fillText(label, shape.middle.x, shape.middle.y);
    }
  });
  ctx.restore();
}
