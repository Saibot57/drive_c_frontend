'use client';

import { labelOneLine } from '@/utils/mindmap/mindmapTree';
import { useCallback, useRef, useState } from 'react';
import type { MindmapDoc } from '@/types/mindmapDoc';
import {
  canvasToPng,
  renderMindmapCanvas,
  type MindmapDrawSymbols,
  type MindmapPalette,
} from '@/utils/mindmap/mindmapDraw';
import { layoutMindmap, MINDMAP_METRICS, MINDMAP_WRAP } from '@/utils/mindmap/mindmapLayout';
import { drawCrossLinks } from '@/utils/mindmapCrossLinkDraw';
import { downloadBlob } from '@/utils/download';
import { mindmapExportName, toMindmapFile } from '@/utils/mindmapFile';
import { toMindmapMarkdown } from '@/utils/mindmapMarkdown';
import { mindmapPdfBlob, planMindmapPdf } from '@/utils/mindmapPdf';

/*
 * Mindmap-sidans export till bild och fil: urklipp som bild, PNG, PDF,
 * Markdown och sidans eget JSON-format. Dispositionen till urklipp ligger
 * kvar i MindmapCanvas, som också använder den för Ctrl+C.
 *
 * Bilden ritas först när typsnitten är laddade, och nodernas bilder är redan
 * avkodade (useMindmapImages). Symbolerna laddas i bildens färger. Allt
 * ritas med renderMindmapCanvas och tvärlänkarna i dess `overlay`, så att
 * PNG, urklipp och PDF får samma bild.
 */

export type MindmapFileExportKind = 'image' | 'png' | 'pdf' | 'markdown' | 'json';

interface MindmapExportDeps {
  /** Det som visas (hela kartan, eller grenen i grenvyn), läst när exporten börjar. */
  getDoc: () => MindmapDoc;
  /** Hela kartan, till JSON-filen. Utan den gäller `getDoc`. */
  getFileDoc?: () => MindmapDoc;
  title: string;
  /** Paletten i standardutseendet, eller `null` om kartan inte är på sidan. */
  readPalette: () => MindmapPalette | null;
  loadSymbols: (color: string) => Promise<MindmapDrawSymbols | undefined>;
  images: () => Map<string, CanvasImageSource>;
  flash: (text: string, tone?: 'success' | 'error') => void;
}

export function useMindmapExport(deps: MindmapExportDeps) {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  /** Gäller bild och PNG. PDF:en har alltid vit bakgrund. */
  const [transparent, setTransparent] = useState(false);
  const transparentRef = useRef(transparent);
  transparentRef.current = transparent;

  const draw = useCallback(async (
    doc: MindmapDoc,
    options: { transparent: boolean; scaleFor?: (palette: MindmapPalette) => number },
  ): Promise<HTMLCanvasElement> => {
    const { readPalette, loadSymbols, images } = depsRef.current;
    await (document.fonts?.ready ?? Promise.resolve());
    const palette = readPalette();
    if (!palette) throw new Error('Kartan finns inte på sidan');
    const symbols = await loadSymbols(palette.text);
    // Bakgrunden tas bort, men tvärlänkarnas etiketter behåller sin ljusa kant.
    const drawPalette = options.transparent ? { ...palette, background: 'transparent' } : palette;
    return renderMindmapCanvas(doc, drawPalette, {
      scale: options.scaleFor?.(palette),
      extras: true,
      wrap: MINDMAP_WRAP,
      images: images(),
      symbols,
      overlay: (ctx, drawn) => drawCrossLinks(ctx, drawn, doc, palette),
    });
  }, []);

  const exportAs = useCallback((kind: MindmapFileExportKind) => {
    const { getDoc, getFileDoc, title, flash } = depsRef.current;
    const doc = getDoc();
    const fileName = (extension: string) => mindmapExportName(title, labelOneLine(doc.root.label), extension);

    if (kind === 'markdown') {
      downloadBlob(new Blob([toMindmapMarkdown(doc)], { type: 'text/markdown;charset=utf-8' }), fileName('md'));
      return;
    }
    if (kind === 'json') {
      // Filen är en säkerhetskopia: alltid hela kartan, också när bara en gren visas.
      const whole = getFileDoc?.() ?? doc;
      const name = mindmapExportName(title, labelOneLine(whole.root.label), 'json');
      downloadBlob(new Blob([toMindmapFile(title || labelOneLine(whole.root.label), whole)], { type: 'application/json' }), name);
      return;
    }
    if (kind === 'pdf') {
      let plan: ReturnType<typeof planMindmapPdf> | null = null;
      draw(doc, {
        transparent: false,
        scaleFor: (palette) => {
          // Layoutens mått med samma mätning som ritningen, för att välja sida och skala.
          const ctx = document.createElement('canvas').getContext('2d');
          if (!ctx) throw new Error('Canvas saknas');
          const measured = layoutMindmap(doc, (text, isRoot) => {
            ctx.font = isRoot ? palette.rootFont : palette.font;
            return ctx.measureText(text).width;
          }, MINDMAP_METRICS, { extras: true, wrap: MINDMAP_WRAP });
          plan = planMindmapPdf(measured.width, measured.height);
          return plan.canvasScale;
        },
      })
        .then((canvas) => mindmapPdfBlob(canvas, plan!, title || labelOneLine(doc.root.label)))
        .then((blob) => downloadBlob(blob, fileName('pdf')))
        .catch((error) => {
          console.error('Mindmap: PDF-exporten misslyckades', error);
          flash('Kunde inte skapa PDF:en.', 'error');
        });
      return;
    }

    const png = draw(doc, { transparent: transparentRef.current }).then(canvasToPng);
    if (kind === 'image') {
      // Safari kräver att write anropas direkt i händelsen, med bilden som ett löfte.
      navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
        .then(() => flash('Bilden är kopierad. Klistra in i dokumentet.'))
        .catch(() => flash('Kunde inte kopiera bilden. Ladda ner den som PNG i stället.', 'error'));
      return;
    }
    png
      .then((blob) => downloadBlob(blob, fileName('png')))
      .catch(() => flash('Kunde inte skapa bilden.', 'error'));
  }, [draw]);

  return { exportAs, transparent, setTransparent };
}
