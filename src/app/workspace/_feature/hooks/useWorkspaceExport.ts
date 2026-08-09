'use client';

import { useCallback, type RefObject } from 'react';
import type { PlannerNoticeTone } from '@/types/plannerUI';
import type { SurfaceElement } from '../types/workspace.types';
import { EXPORT_PADDING_PX, EXPORT_SCALE } from '../types/constants';

type ShowNotice = (message: string, tone: PlannerNoticeTone) => void;

/** Filnamn utan å/ä/ö och mellanslag, som i temakalenderns export. */
const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'workspace';

const download = (href: string, filename: string) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

type UseWorkspaceExportParams = {
  /** Elementet som bär canvasens transform. Innehållet ligger inuti det. */
  viewportRef: RefObject<HTMLDivElement>;
  placements: SurfaceElement[];
  surfaceName: string;
  showNotice: ShowNotice;
};

export function useWorkspaceExport({
  viewportRef,
  placements,
  surfaceName,
  showNotice,
}: UseWorkspaceExportParams) {
  /**
   * Renderar ytans innehåll till en canvas.
   *
   * Vyn är panorerad och skalad, och viewport-elementet saknar egna mått —
   * barnen är absolutpositionerade i canvasens koordinater. Därför ställs den
   * tillfälligt om till 1:1 med innehållets hörn i origo och en storlek som
   * motsvarar innehållet. Allt återställs i finally, även om renderingen far
   * illa på vägen.
   */
  const renderToCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    const viewport = viewportRef.current;
    const onCanvas = placements.filter((p) => p.is_on_canvas);

    if (!viewport || onCanvas.length === 0) {
      showNotice('Det finns inget att exportera på den här ytan.', 'warning');
      return null;
    }

    const pad = EXPORT_PADDING_PX;
    const minX = Math.min(...onCanvas.map((p) => p.position_x)) - pad;
    const minY = Math.min(...onCanvas.map((p) => p.position_y)) - pad;
    const width = Math.max(...onCanvas.map((p) => p.position_x + p.width)) + pad - minX;
    const height = Math.max(...onCanvas.map((p) => p.position_y + p.height)) + pad - minY;

    const saved = {
      transform: viewport.style.transform,
      width: viewport.style.width,
      height: viewport.style.height,
      zoomVar: viewport.style.getPropertyValue('--ws-zoom'),
    };

    try {
      viewport.style.transform = `translate(${-minX}px, ${-minY}px) scale(1)`;
      viewport.style.width = `${width}px`;
      viewport.style.height = `${height}px`;
      // Kanterna kompenseras mot zoomen; i exporten är skalan 1.
      viewport.style.setProperty('--ws-zoom', '1');
      // Låsknappar och storlekshandtag hör till redigeringen, inte till bilden.
      viewport.classList.add('ws-exporting');

      const html2canvas = (await import('html2canvas')).default;
      return await html2canvas(viewport, {
        width,
        height,
        scale: EXPORT_SCALE,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      });
    } finally {
      viewport.classList.remove('ws-exporting');
      viewport.style.transform = saved.transform;
      viewport.style.width = saved.width;
      viewport.style.height = saved.height;
      viewport.style.setProperty('--ws-zoom', saved.zoomVar || '1');
    }
  }, [viewportRef, placements, showNotice]);

  const exportImage = useCallback(async (format: 'png' | 'jpeg') => {
    try {
      const canvas = await renderToCanvas();
      if (!canvas) return;
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      download(canvas.toDataURL(mime, 0.95), `${slugify(surfaceName)}.${format === 'png' ? 'png' : 'jpg'}`);
      showNotice('Bilden sparades.', 'success');
    } catch (error) {
      console.error('Workspace: export misslyckades', error);
      showNotice('Kunde inte exportera ytan.', 'error');
    }
  }, [renderToCanvas, surfaceName, showNotice]);

  const exportPdf = useCallback(async () => {
    try {
      const canvas = await renderToCanvas();
      if (!canvas) return;

      const { default: jsPDF } = await import('jspdf');
      // Liggande eller stående efter innehållets form, så att bilden fyller sidan.
      const landscape = canvas.width >= canvas.height;
      const pdf = new jsPDF({
        orientation: landscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const scale = Math.min(
        (pageWidth - margin * 2) / canvas.width,
        (pageHeight - margin * 2) / canvas.height,
      );
      const w = canvas.width * scale;
      const h = canvas.height * scale;

      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        (pageWidth - w) / 2,
        (pageHeight - h) / 2,
        w,
        h,
      );
      pdf.save(`${slugify(surfaceName)}.pdf`);
      showNotice('PDF:en sparades.', 'success');
    } catch (error) {
      console.error('Workspace: PDF-export misslyckades', error);
      showNotice('Kunde inte skapa PDF.', 'error');
    }
  }, [renderToCanvas, surfaceName, showNotice]);

  return { exportImage, exportPdf };
}
