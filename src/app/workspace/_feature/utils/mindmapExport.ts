import type { MindmapColor, MindmapContent, MindmapNode } from '../types/mindmap.types';
import { MINDMAP_COLORS } from '../types/mindmap.types';
import { layoutMindmap, MINDMAP_METRICS, type MindmapLayoutResult } from './mindmapLayout';
import { toOutlineHtml, toOutlineText, type OutlineStyle } from './mindmapOutline';

/*
 * Export av en mindmap: som bild till urklipp eller fil, och som disposition
 * till urklipp. Allt här kräver en webbläsare; logiken som går att testa
 * ligger i mindmapLayout och mindmapOutline.
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

const fontOf = (style: CSSStyleDeclaration) =>
  `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

/**
 * Läser färgerna ur CSS-variablerna på `.ws-mindmap` och typsnitten ur två
 * mätnoder i kortet.
 *
 * Bilden är något som delas med andra och ritas därför i standardutseendet,
 * som ytans export (docs/plans/kronberg-tema.md, 10.1). Temat tas bort medan
 * värdena läses och sätts tillbaka direkt — allt sker i samma uppgift, så
 * sidan hinner aldrig ritas om utan tema.
 */
export function readMindmapPalette(
  container: HTMLElement,
  probes: { node: HTMLElement; root: HTMLElement },
): MindmapPalette {
  const html = document.documentElement;
  const theme = html.getAttribute('data-theme');
  if (theme !== null) html.removeAttribute('data-theme');
  try {
    const style = getComputedStyle(container);
    const read = (name: string) => style.getPropertyValue(name).trim();
    return {
      background: read('--ws-mm-image-bg'),
      line: read('--ws-mm-line'),
      text: read('--ws-mm-text'),
      nodeBg: read('--ws-mm-node-bg'),
      nodeBorder: read('--ws-mm-node-border'),
      rootBg: read('--ws-mm-root-bg'),
      rootBorder: read('--ws-mm-root-border'),
      badgeBg: read('--ws-mm-badge-bg'),
      badgeText: read('--ws-mm-badge-text'),
      colors: Object.fromEntries(
        MINDMAP_COLORS.map((color) => [color, read(`--ws-mm-c-${color}`)]),
      ) as Record<MindmapColor, string>,
      font: fontOf(getComputedStyle(probes.node)),
      rootFont: fontOf(getComputedStyle(probes.root)),
    };
  } finally {
    if (theme !== null) html.setAttribute('data-theme', theme);
  }
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

/** Sant om webbläsaren kan lägga en bild på urklipp. */
export function canCopyImage(): boolean {
  return typeof window !== 'undefined'
    && typeof ClipboardItem !== 'undefined'
    && !!navigator.clipboard?.write;
}

/**
 * Lägger bilden på urklipp. Bloben skickas som ett löfte: Safari kräver att
 * write anropas direkt i klicket, innan bilden hunnit ritas klart.
 */
export async function copyImageToClipboard(png: Promise<Blob>): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

/**
 * Lägger en disposition på urklipp som både HTML och text. Google Docs tar
 * HTML-versionen; ett vanligt textfält tar texten. Teckenkodningen anges,
 * annars blir å, ä och ö fel när Windows klistrar in.
 */
export async function copyOutlineToClipboard(node: MindmapNode, style: OutlineStyle): Promise<void> {
  const html = `<meta charset="utf-8">${toOutlineHtml(node, style)}`;
  const text = toOutlineText(node);
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(text);
}
