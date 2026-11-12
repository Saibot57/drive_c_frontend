import type { MindmapColor, MindmapContent, MindmapIcon } from '@/types/mindmap';
import {
  layoutMindmap,
  MINDMAP_EXTRA_METRICS,
  MINDMAP_METRICS,
  type MindmapLayoutResult,
  type MindmapWrap,
} from './mindmapLayout';

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
  /*
   * Mindmap-sidans egna färger (docs/plans/mindmap-farger.md): hur mycket
   * av en egen färg som visas, mot vilken bas. Kronberg dämpar som
   * schemats kurser. Kortet läser dem inte.
   */
  customMix?: number;
  customBase?: string;
}

/**
 * En nods färdiga färger, räknade av anroparen (Mindmap-sidans
 * `resolveMindmapPaint`). `outline`: bara en kant i färgen, 2 px.
 */
export interface MindmapNodePaint {
  fill: string;
  text: string;
  border?: string;
  outline?: boolean;
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius = Infinity) {
  const r = Math.min(h / 2, w / 2, radius);
  if (r < h / 2) {
    // Rundad rektangel: en nod med bild.
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
}

/** Färdigladdade symboler att rita på noderna. Saknas en ritas den inte. */
export interface MindmapDrawSymbols {
  icons?: Partial<Record<MindmapIcon, CanvasImageSource>>;
  note?: CanvasImageSource;
  link?: CanvasImageSource;
}

export interface MindmapDrawOptions {
  /** Bildpunkter per enhet i layouten. Utan värde gäller exportens skala. */
  scale?: number;
  /**
   * Mindmap-sidans tillägg: ikon, symboler för anteckning och länk, bild.
   * Workspace-kortet anger den inte och får bilden som förut.
   */
  extras?: boolean;
  /** Mindmap-sidans radbrytning. Utan den är varje nod en rad, som i kortet. */
  wrap?: MindmapWrap;
  /**
   * Nodernas bilder, per nod-id, laddade och avkodade av anroparen så att
   * ritandet förblir synkront. En bild som saknas ritas som en tom ram.
   */
  images?: Map<string, CanvasImageSource>;
  symbols?: MindmapDrawSymbols;
  /**
   * Ritar mer ovanpå kartan, i layoutens koordinater: Mindmap-sidans
   * tvärlänkar. Anropas sist, med samma layout som noderna ritats efter.
   */
  overlay?: (ctx: CanvasRenderingContext2D, layout: MindmapLayoutResult) => void;
  /**
   * Ritar grenarnas linjer i stället för de inbyggda kurvorna, med samma
   * färg och bredd: Mindmap-sidans former och fästen. Kortet anger den inte.
   */
  edges?: (ctx: CanvasRenderingContext2D, layout: MindmapLayoutResult) => void;
  /**
   * Mindmap-sidans färger per nod-id, räknade med samma palett som ritningen.
   * En nod som saknas ritas som utan den. Kortet anger den inte.
   */
  paint?: (palette: MindmapPalette) => Map<string, MindmapNodePaint>;
}

/**
 * Ritar kartan på en ny canvas. Hopfällda grenar ritas hopfällda, som på skärmen.
 * `options.scale` ger en mindre bild, till Mindmap-sidans minikarta.
 */
export function renderMindmapCanvas(
  content: MindmapContent,
  palette: MindmapPalette,
  options: MindmapDrawOptions = {},
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas saknas');

  const measure = (text: string, isRoot: boolean) => {
    ctx.font = isRoot ? palette.rootFont : palette.font;
    return ctx.measureText(text).width;
  };
  const layout: MindmapLayoutResult = layoutMindmap(content, measure, MINDMAP_METRICS, {
    extras: options.extras,
    wrap: options.wrap,
  });
  const m = MINDMAP_METRICS;
  const xm = MINDMAP_EXTRA_METRICS;

  const scale = options.scale ?? IMAGE_SCALE;
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  ctx.scale(scale, scale);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, layout.width, layout.height);

  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1.5;
  if (options.edges) {
    options.edges(ctx, layout);
  } else {
    layout.edges.forEach((edge) => {
      const mid = (edge.x1 + edge.x2) / 2;
      ctx.beginPath();
      ctx.moveTo(edge.x1, edge.y1);
      ctx.bezierCurveTo(mid, edge.y1, mid, edge.y2, edge.x2, edge.y2);
      ctx.stroke();
    });
  }

  const paints = options.paint?.(palette);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  layout.nodes.forEach((node) => {
    const paint = paints?.get(node.id);
    const border = node.isRoot ? m.rootBorder : m.border;
    const pad = node.isRoot ? m.rootPadX : m.padX;
    // Kanten ritas på insidan, som border-box i kortet.
    pill(
      ctx,
      node.x + border / 2,
      node.y + border / 2,
      node.width - border,
      node.height - border,
      node.image ? xm.imageNodeRadius : Infinity,
    );
    ctx.fillStyle = paint
      ? paint.fill
      : node.color
        ? palette.colors[node.color]
        : node.isRoot ? palette.rootBg : palette.nodeBg;
    ctx.fill();
    ctx.lineWidth = border;
    ctx.strokeStyle = (paint?.border) ?? (node.isRoot ? palette.rootBorder : palette.nodeBorder);
    ctx.stroke();
    if (paint?.outline && paint.border) {
      // Kanten längst ned i en färgad gren: 2 px, innanför nodens mått som på skärmen.
      pill(ctx, node.x + border * 1.5, node.y + border * 1.5, node.width - 3 * border, node.height - 3 * border,
        node.image ? xm.imageNodeRadius : Infinity);
      ctx.lineWidth = border;
      ctx.stroke();
    }

    const cy = node.y + (node.rowHeight ?? node.height) / 2;
    let left = node.x + (node.contentX ?? border + pad);

    const symbol = (image: CanvasImageSource | undefined, slot: number, size: number, atEnd: boolean) => {
      // Ikonen står först i sin lucka, symbolerna sist i sin: luften hamnar mot texten.
      if (image) ctx.drawImage(image, atEnd ? left + slot - size : left, cy - size / 2, size, size);
      left += slot;
    };

    if (node.icon) symbol(options.symbols?.icons?.[node.icon], xm.iconWidth, xm.iconSize, false);
    ctx.font = node.isRoot ? palette.rootFont : palette.font;
    ctx.fillStyle = paint?.text ?? palette.text;
    if (node.lines && node.lines.length > 1) {
      const step = node.lineHeight ?? 0;
      const top = cy - ((node.lines.length - 1) * step) / 2;
      node.lines.forEach((line, index) => ctx.fillText(line, left + node.labelWidth / 2, top + index * step));
    } else {
      ctx.fillText(node.label, left + node.labelWidth / 2, cy);
    }
    left += node.labelWidth;
    if (node.hasNote) symbol(options.symbols?.note, xm.markerWidth, xm.markerSize, true);
    if (node.link) symbol(options.symbols?.link, xm.markerWidth, xm.markerSize, true);

    if (node.hiddenCount > 0) {
      ctx.font = palette.font;
      ctx.fillStyle = palette.badgeText;
      ctx.fillText(`+${node.hiddenCount}`, left + m.badgeWidth / 2, cy);
    }

    if (node.image) {
      const box = node.image;
      const image = options.images?.get(node.id);
      if (image) {
        ctx.drawImage(image, node.x + box.x, node.y + box.y, box.width, box.height);
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = palette.nodeBorder;
        ctx.strokeRect(node.x + box.x + 0.5, node.y + box.y + 0.5, box.width - 1, box.height - 1);
      }
    }
  });
  options.overlay?.(ctx, layout);
  return canvas;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bilden kunde inte skapas'))), 'image/png');
  });
}
