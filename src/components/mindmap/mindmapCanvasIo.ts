import type { MindmapColor } from '@/types/mindmap';
import { MINDMAP_COLORS } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapPalette } from '@/utils/mindmap/mindmapDraw';
import { toOutlineHtml, toOutlineText, type OutlineStyle } from '@/utils/mindmap/mindmapOutline';
import { withBranchData } from '@/utils/mindmapClipboard';
import { parsePercent } from '@/utils/mindmapPaint';

/*
 * Det i MindmapCanvas som bara rör webbläsaren runt kartan: paletten som
 * läses ur CSS och dispositionen till urklipp. Flyttat hit oförändrat från
 * MindmapCanvas.tsx (2026-11-11), som blivit stor; kräver en webbläsare och
 * testas inte.
 */

export const fontOf = (style: CSSStyleDeclaration) => `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

/**
 * Läser färgerna ur CSS-variablerna på `.mm` och typsnitten ur två mätnoder.
 * Bilden är något som delas med andra och ritas därför i standardutseendet,
 * som kortets export: temat tas bort medan värdena läses och sätts tillbaka
 * direkt, i samma uppgift, så sidan hinner aldrig ritas om utan tema.
 * Minikartan visas på sidan och läser i stället med temat kvar (`keepTheme`).
 */
export function readPalette(
  container: HTMLElement,
  probes: { node: HTMLElement; root: HTMLElement },
  keepTheme = false,
): MindmapPalette {
  const html = document.documentElement;
  const theme = keepTheme ? null : html.getAttribute('data-theme');
  if (theme !== null) html.removeAttribute('data-theme');
  try {
    const style = getComputedStyle(container);
    const read = (name: string) => style.getPropertyValue(name).trim();
    return {
      background: read('--mm-image-bg'),
      line: read('--mm-line'),
      text: read('--mm-text'),
      nodeBg: read('--mm-node-bg'),
      nodeBorder: read('--mm-node-border'),
      rootBg: read('--mm-root-bg'),
      rootBorder: read('--mm-root-border'),
      badgeBg: read('--mm-badge-bg'),
      badgeText: read('--mm-badge-text'),
      colors: Object.fromEntries(MINDMAP_COLORS.map((color) => [color, read(`--mm-c-${color}`)])) as Record<MindmapColor, string>,
      font: fontOf(getComputedStyle(probes.node)),
      rootFont: fontOf(getComputedStyle(probes.root)),
      // Egna färger dämpas som schemats kurser (docs/plans/mindmap-farger.md).
      customMix: parsePercent(read('--ui-course-mix')),
      customBase: read('--ui-course-base') || undefined,
    };
  } finally {
    if (theme !== null) html.setAttribute('data-theme', theme);
  }
}

export const canCopyImage = () =>
  typeof window !== 'undefined' && typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

/**
 * Lägger en disposition på urklipp som både HTML och text; Google Docs tar
 * HTML-versionen. Anteckningarna följer med som indrag. Med `withBranch`
 * ligger också grenen själv i HTML:en (mindmapClipboard), så att den kan
 * klistras in i en karta med anteckning, länk, bild, ikon och färg kvar.
 */
export async function copyOutline(
  node: MindmapDoc['root'],
  style: OutlineStyle,
  withBranch = false,
  /** Läggs sist: hela kartans tvärlänkar (crossLinkOutline). */
  tail: { text: string; html: string } = { text: '', html: '' },
): Promise<void> {
  const outline = toOutlineHtml(node, style, { notes: true }) + tail.html;
  const html = `<meta charset="utf-8">${withBranch ? withBranchData(outline, node) : outline}`;
  const text = toOutlineText(node, { notes: true }) + tail.text;
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
