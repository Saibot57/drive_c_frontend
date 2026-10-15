'use client';

import { useCallback, type RefObject } from 'react';
import type { PlannerNoticeTone } from '@/types/plannerUI';
import type { SurfaceElement } from '../types/workspace.types';
import { EXPORT_PADDING_PX, EXPORT_SCALE } from '../types/constants';
import { addCanvasCentered, downloadUrl, toFileSlug } from '@/utils/download';

type ShowNotice = (message: string, tone: PlannerNoticeTone) => void;

/*
 * html2canvas mäter typsnittens baslinje och mitt i sidans eget dokument,
 * inte i klonen: en 1×1-bild läggs efter en textrad i en dold div direkt
 * under body, och måtten är bildens avstånd från radens topp. Tailwinds
 * preflight gör alla img till block, så bilden hamnar på raden under och
 * måtten blir en hel rad fel. Genomstrykningar ritas från mitten och hamnade
 * därför ovanför texten (en avbockad punkt i en låst lista).
 *
 * Medan exporten pågår står mätbilden inline igen. Selektorn träffar bara
 * den: inga riktiga bilder är 1×1 direkt under en div direkt under body.
 */
const FONT_METRICS_FIX = 'body > div > img[width="1"][height="1"] { display: inline !important; }';

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

    const metricsFix = document.createElement('style');
    metricsFix.textContent = FONT_METRICS_FIX;

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
      document.head.appendChild(metricsFix);

      /*
       * Rubrikerna använder fyra typsnitt som laddas först när de behövs.
       * html2canvas ritar det som finns just nu och byter tyst till ett
       * reservtypsnitt för det som inte hunnit fram — bilden blir fel utan
       * något felmeddelande, och det upptäcks först när man tittar på PDF:en.
       */
      await document.fonts.ready;

      const html2canvas = (await import('html2canvas')).default;
      return await html2canvas(viewport, {
        width,
        height,
        scale: EXPORT_SCALE,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        // Exporten är ett dokument som delas med andra och ritas därför alltid
        // i standardutseendet, oavsett vilket tema den som exporterar valt
        // (docs/plans/kronberg-tema.md, 10.1). Kopian html2canvas ritar från
        // är ett eget dokument, så sidan själv byter aldrig tema.
        onclone: (clonedDocument) => {
          clonedDocument.documentElement.removeAttribute('data-theme');
          matchFieldsToScreen(clonedDocument);
          matchCheckboxesToScreen(clonedDocument);
          matchImageFitToScreen(clonedDocument);
        },
      });
    } finally {
      metricsFix.remove();
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
      downloadUrl(canvas.toDataURL(mime, 0.95), `${toFileSlug(surfaceName, 'workspace')}.${format === 'png' ? 'png' : 'jpg'}`);
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

      addCanvasCentered(pdf, canvas, 10);
      pdf.save(`${toFileSlug(surfaceName, 'workspace')}.pdf`);
      showNotice('PDF:en sparades.', 'success');
    } catch (error) {
      console.error('Workspace: PDF-export misslyckades', error);
      showNotice('Kunde inte skapa PDF.', 'error');
    }
  }, [renderToCanvas, surfaceName, showNotice]);

  return { exportImage, exportPdf };
}

/*
 * html2canvas ritar ett textfälts värde själv i stället för att låta
 * webbläsaren göra det, och det blir fel på flera sätt: texten hamnar några
 * pixlar för lågt och klipps, platshållaren får textens färg, och
 * text-transform och text-decoration ignoreras (kanbankolumnernas versaler,
 * en avbockad punkt i en olåst lista).
 *
 * I klonen byts varje textfält på korten mot ett span med samma klasser och
 * samma mått, så att texten ritas som all annan text. Klonen är ett eget
 * dokument; sidans fält rörs inte.
 */
function matchFieldsToScreen(doc: Document) {
  const view = doc.defaultView;
  if (!view) return;

  doc.querySelectorAll<HTMLInputElement>('.ws-element input:not([type]), .ws-element input[type="text"]')
    .forEach((input) => {
      // Bredden mäts; höjden blir densamma av sig själv, eftersom spannet
      // ärver samma radhöjd som fältet och får samma klasser. Med overflow
      // hidden ligger ett inline-blocks baslinje i nederkanten, och då växer
      // raden runt det — vertical-align: top håller tabellcellerna i höjd.
      const width = input.getBoundingClientRect().width;
      const span = doc.createElement('span');
      span.className = input.className;
      span.style.cssText = input.style.cssText;
      Object.assign(span.style, {
        display: 'inline-block',
        boxSizing: 'border-box',
        width: `${width}px`,
        overflow: 'hidden',
        whiteSpace: 'pre',
        verticalAlign: 'top',
      });
      if (input.value) {
        span.textContent = input.value;
      } else {
        span.textContent = input.placeholder;
        span.style.color = view.getComputedStyle(input, '::placeholder').color;
      }
      input.replaceWith(span);
    });
}

/** Bocken i en ikryssad ruta, i Chromes form. */
const CHECK_PATH = 'M2.5 6.2 4.8 8.5 9.5 3.6';
/** Chromes grå för avstängda kryssrutor, uppmätt. */
const DISABLED_CHECK = '#d1d1d1';

/*
 * html2canvas ritar kryssrutor i en egen grå stil, oavsett hur webbläsaren
 * och accent-color visar dem. I klonen byts varje kryssruta på korten mot en
 * ruta i Chromes form: vit med grå ram, eller ifylld i accentfärgen med en
 * vit bock. En låst ruta ritas ljusgrå oavsett accent, som Chrome gör.
 */
function matchCheckboxesToScreen(doc: Document) {
  const view = doc.defaultView;
  if (!view) return;

  doc.querySelectorAll<HTMLInputElement>('.ws-element input[type="checkbox"]').forEach((input) => {
    const style = view.getComputedStyle(input);
    const { width, height } = input.getBoundingClientRect();
    // accent-color: auto är Chromes egen blå. Avstängda rutor är ljusgrå.
    const accent = input.disabled ? DISABLED_CHECK
      : style.accentColor === 'auto' ? '#0075ff' : style.accentColor;
    const frame = input.disabled ? DISABLED_CHECK : '#767676';

    const box = doc.createElement('span');
    box.className = input.className;
    Object.assign(box.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      width: `${width}px`,
      height: `${height}px`,
      margin: style.margin,
      border: `1px solid ${input.checked ? accent : frame}`,
      borderRadius: '2px',
      background: input.checked ? accent : '#ffffff',
    });
    if (input.checked) {
      const size = Math.round(width * 0.85);
      box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 12 12">`
        + `<path d="${CHECK_PATH}" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    input.replaceWith(box);
  });
}

/*
 * html2canvas känner inte till object-fit och sträcker bilden till sin ruta.
 * En miniatyr med object-fit: cover blir då förvrängd. I klonen blir varje
 * sådan bild en ruta med bilden som bakgrund, där background-size gör samma
 * sak som object-fit och background-position som object-position.
 */
function matchImageFitToScreen(doc: Document) {
  const view = doc.defaultView;
  if (!view) return;

  doc.querySelectorAll<HTMLImageElement>('.ws-element img').forEach((img) => {
    const style = view.getComputedStyle(img);
    if (style.objectFit !== 'cover' && style.objectFit !== 'contain') return;

    const { width, height } = img.getBoundingClientRect();
    const src = (img.currentSrc || img.src).replace(/"/g, '%22');
    const frame = doc.createElement('div');
    frame.className = img.className;
    Object.assign(frame.style, {
      flexShrink: '0',
      width: `${width}px`,
      height: `${height}px`,
      backgroundImage: `url("${src}")`,
      backgroundSize: style.objectFit,
      backgroundPosition: style.objectPosition,
      backgroundRepeat: 'no-repeat',
    });
    img.replaceWith(frame);
  });
}
