import type { MindmapColor, MindmapNode } from '../types/mindmap.types';
import { MINDMAP_COLORS } from '../types/mindmap.types';
import type { MindmapPalette } from '@/utils/mindmap/mindmapDraw';
import { toOutlineHtml, toOutlineText, type OutlineStyle } from './mindmapOutline';

// Ritandet är delat med Mindmap-sidan; se mindmapDraw. Kortet importerar det härifrån som förut.
export { canvasToPng, renderMindmapCanvas, type MindmapPalette } from '@/utils/mindmap/mindmapDraw';

/*
 * Export av en mindmap: som bild till urklipp eller fil, och som disposition
 * till urklipp. Allt här kräver en webbläsare; logiken som går att testa
 * ligger i mindmapLayout och mindmapOutline, och ritandet i mindmapDraw.
 */

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
