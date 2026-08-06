'use client';

import { useCallback } from 'react';
import jsPDF from 'jspdf';
import { PersistedThemeWheelState, ThemeWheel } from '@/types/themeWheel';
import { WHEEL_FONT_STACK, WHEEL_STROKE_WIDTH } from '@/components/theme-wheel/constants';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Uppskalning vid rastrering. 4× på A4 ger drygt 300 dpi. */
const PDF_SCALE = 4;
const IMAGE_SCALE = 3;

/** Filnamn utan å/ä/ö och mellanslag. */
const slugify = (value: string): string => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'temakalender'
);

const download = (href: string, filename: string) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Fristående kopia av hjulet, redo att renderas utan sidans CSS.
 *
 * Den ritade SVG:n ärver typsnitt och bakgrund från dokumentet. En serialiserad
 * kopia gör inte det, så båda sätts uttryckligen här.
 */
const standaloneSvg = (svg: SVGSVGElement): { markup: string; size: number } => {
  const viewBox = svg.getAttribute('viewBox') ?? '';
  const size = Number(viewBox.split(/\s+/)[2]) || svg.clientWidth || 640;

  const clone = svg.cloneNode(true) as SVGSVGElement;

  // Markeringen är ett redigeringsläge, inte en del av hjulet. Handtag och
  // klickytor tas bort och den markerade bågens tjockare kontur återställs,
  // annars hamnar de på utskriften.
  clone.querySelectorAll('[data-export="omit"]').forEach(node => node.remove());
  clone.querySelectorAll('[data-export="selected"]').forEach(node => {
    node.setAttribute('stroke-width', String(WHEEL_STROKE_WIDTH));
  });

  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('width', String(size));
  clone.setAttribute('height', String(size));
  clone.setAttribute('font-family', WHEEL_FONT_STACK);
  clone.removeAttribute('class');

  const background = document.createElementNS(SVG_NS, 'rect');
  background.setAttribute('x', '0');
  background.setAttribute('y', '0');
  background.setAttribute('width', String(size));
  background.setAttribute('height', String(size));
  background.setAttribute('fill', '#ffffff');
  clone.insertBefore(background, clone.firstChild);

  return { markup: new XMLSerializer().serializeToString(clone), size };
};

const renderToCanvas = (svg: SVGSVGElement, scale: number): Promise<HTMLCanvasElement> => {
  const { markup, size } = standaloneSvg(svg);
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(size * scale);
      canvas.height = Math.round(size * scale);
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Kunde inte rita hjulet.'));
        return;
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    image.onerror = () => reject(new Error('Kunde inte rita hjulet.'));
    image.src = source;
  });
};

type UseThemeWheelExportParams = {
  wheel: ThemeWheel;
  svgRef: React.RefObject<SVGSVGElement>;
  showNotice: (message: string, tone: 'success' | 'error' | 'warning') => void;
};

export const useThemeWheelExport = ({ wheel, svgRef, showNotice }: UseThemeWheelExportParams) => {
  const baseName = slugify(wheel.name);

  const exportImage = useCallback(async (type: 'png' | 'jpeg') => {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      const canvas = await renderToCanvas(svg, IMAGE_SCALE);
      const dataUrl = type === 'png'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', 0.92);
      download(dataUrl, `${baseName}.${type === 'png' ? 'png' : 'jpg'}`);
    } catch (error) {
      console.error(error);
      showNotice('Kunde inte exportera bilden.', 'error');
    }
  }, [baseName, showNotice, svgRef]);

  const exportPdf = useCallback(async (pageSize: 'a4' | 'a3') => {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      const canvas = await renderToCanvas(svg, PDF_SCALE);
      // Hjulet är kvadratiskt, så stående sida ger störst hjul.
      const pdf = new jsPDF('p', 'pt', pageSize);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const side = Math.min(pageWidth, pageHeight) - margin * 2;
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        (pageWidth - side) / 2,
        (pageHeight - side) / 2,
        side,
        side
      );
      pdf.save(`${baseName}.pdf`);
    } catch (error) {
      console.error(error);
      showNotice('Kunde inte exportera PDF.', 'error');
    }
  }, [baseName, showNotice, svgRef]);

  /**
   * Skriver ut hjulet som äkta vektor. Går via utskriftsdialogen eftersom
   * jsPDF inte kan läsa SVG utan tillägg – i gengäld blir resultatet skarpt
   * i alla förstoringar, vilket räknas på en affisch.
   */
  const printVector = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const { markup } = standaloneSvg(svg);

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);

    const doc = frame.contentDocument;
    const view = frame.contentWindow;
    if (!doc || !view) {
      document.body.removeChild(frame);
      return;
    }

    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${wheel.name}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  html, body { margin: 0; padding: 0; }
  svg { width: 100%; height: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>${markup}</body></html>`);
    doc.close();

    const cleanup = () => {
      if (frame.parentNode) document.body.removeChild(frame);
    };
    view.addEventListener('afterprint', cleanup, { once: true });
    view.focus();
    view.print();
    window.setTimeout(cleanup, 60000);
  }, [svgRef, wheel.name]);

  const exportJson = useCallback(() => {
    const payload: PersistedThemeWheelState = {
      version: 1,
      timestamp: new Date().toISOString(),
      wheel,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    download(url, `${baseName}.json`);
    URL.revokeObjectURL(url);
  }, [baseName, wheel]);

  return { exportImage, exportPdf, printVector, exportJson };
};

/**
 * Läser en exporterad fil. Både formatet med version och ett naket hjul
 * accepteras. Djupvalideringen görs av servern, vars felmeddelanden redan är
 * skrivna för användaren.
 */
export const parseWheelFile = (text: string): ThemeWheel => {
  const parsed = JSON.parse(text);
  const candidate = (parsed?.wheel ?? parsed) as Partial<ThemeWheel>;
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Filen innehåller inget hjul.');
  }
  if (typeof candidate.name !== 'string' || !Array.isArray(candidate.blocks)) {
    throw new Error('Filen ser inte ut som en temakalender.');
  }
  return candidate as ThemeWheel;
};
