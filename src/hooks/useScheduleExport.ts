'use client';

import { useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { isVectorPdfExportEnabled } from '@/config/featureFlags';
import { ScheduledEntry } from '@/types/schedule';
import { END_HOUR, PIXELS_PER_MINUTE, START_HOUR, timeToMinutes } from '@/utils/scheduleTime';
import { fitScheduleCardsForExport } from '@/utils/scheduleExportFit';
import { exportElementToVectorPdf } from '@/utils/vectorPdfExport';

type UseScheduleExportParams = {
  schedule: ScheduledEntry[];
  /**
   * Poster som är dolda i filen. Själva döljandet sköts av CSS under
   * `.pdf-export`, men höjdklippningen räknar på datan och måste veta.
   */
  isExcludedFromExport?: (entry: ScheduledEntry) => boolean;
  /**
   * Senaste sluttid som måste rymmas utöver posterna, i minuter. Planeringsblock
   * kan sträcka sig förbi sista lektionen när ramen är satt för hand.
   */
  extraEndMinutes?: number;
  /** Körs först när filen faktiskt är skapad, så en kraschad export rensar inget. */
  onExportComplete?: (outcome: ExportOutcome) => void;
};

export type ExportOutcome = {
  /**
   * Poster där texten inte rymdes i kortet och klipptes med "…". Tomt när allt
   * fick plats. Anropas bara med det som faktiskt hamnade i filen — uteslutna
   * poster mäts aldrig, de är `display: none` under `.pdf-export`.
   */
  truncated: ScheduledEntry[];
  /**
   * Schemat fick skalas ned så långt att texten knappt går att läsa. Bara
   * vektorexporten på papper kan rapportera det — utskriftsvägen vet inte hur
   * webbläsaren till slut valde att skala sidan.
   */
  lowScale?: boolean;
};

export const useScheduleExport = ({
  schedule,
  isExcludedFromExport,
  extraEndMinutes,
  onExportComplete
}: UseScheduleExportParams) => {
  const captureScheduleCanvas = useCallback(async () => {
    const element = document.getElementById('schedule-canvas');
    if (!element) return null;
    element.classList.add('pdf-export');
    // Bildvägen fotar det levande elementet, så klämningen måste städas bort
    // igen — annars sitter "…" kvar på skärmen efter exporten.
    const fit = fitScheduleCardsForExport(element);
    try {
      const maxCanvasSize = 16000;
      const targetWidth = element.scrollWidth;
      const targetHeight = element.scrollHeight;
      const scaleToLimit = Math.min(
        2,
        maxCanvasSize / Math.max(targetWidth, 1),
        maxCanvasSize / Math.max(targetHeight, 1)
      );
      const canvas = await html2canvas(element, {
        scale: scaleToLimit,
        width: targetWidth,
        height: targetHeight,
        windowWidth: targetWidth,
        windowHeight: targetHeight
      });
      return { canvas, truncatedInstanceIds: fit.truncatedInstanceIds };
    } finally {
      fit.restore();
      element.classList.remove('pdf-export');
    }
  }, []);

  /** Kortens `data-instance-id` tillbaka till posterna notisen ska namnge. */
  const toEntries = useCallback((instanceIds: string[]) => {
    const byInstanceId = new Map(schedule.map(entry => [entry.instanceId, entry]));
    return instanceIds
      .map(instanceId => byInstanceId.get(instanceId))
      .filter((entry): entry is ScheduledEntry => Boolean(entry));
  }, [schedule]);

  const computeClipHeightPx = useCallback(() => {
    // En utesluten post ska inte lämna ett tomt fält sist i filen.
    const included = isExcludedFromExport
      ? schedule.filter(entry => !isExcludedFromExport(entry))
      : schedule;

    const maxEndMinutes = included.reduce((latestEndMinutes, entry) => {
      const endMinutes = timeToMinutes(entry.endTime);
      return Number.isFinite(endMinutes)
        ? Math.max(latestEndMinutes, endMinutes)
        : latestEndMinutes;
    }, Number.isFinite(extraEndMinutes) ? (extraEndMinutes as number) : Number.NEGATIVE_INFINITY);

    if (!Number.isFinite(maxEndMinutes)) return undefined;
    const nextFullHour = Math.ceil(maxEndMinutes / 60) * 60;
    const contentHeightPx = (nextFullHour - START_HOUR * 60) * PIXELS_PER_MINUTE;
    if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0) return undefined;
    const topOffsetPx = 16;
    const safetyMarginPx = 8;
    return contentHeightPx + topOffsetPx + safetyMarginPx;
  }, [schedule, isExcludedFromExport, extraEndMinutes]);

  const handleExportPDF = useCallback(async (pageSize?: 'a4' | 'a3') => {
    const exportElement = document.getElementById('schedule-canvas');
    const clipHeightPx = computeClipHeightPx();
    const size = pageSize ?? 'a4';

    if (isVectorPdfExportEnabled && exportElement) {
      let truncatedInstanceIds: string[] = [];
      await exportElementToVectorPdf(exportElement, {
        filename: 'schema.pdf',
        extraClassNames: ['pdf-export'],
        clipHeightPx,
        pageSize: size,
        // Klonen kastas efter utskriften, så den behöver aldrig städas.
        onLayoutReady: root => {
          truncatedInstanceIds = fitScheduleCardsForExport(root).truncatedInstanceIds;
        },
      });
      onExportComplete?.({ truncated: toEntries(truncatedInstanceIds) });
      return;
    }

    const captured = await captureScheduleCanvas();
    if (!captured) return;
    const { canvas, truncatedInstanceIds } = captured;
    const pdf = new jsPDF('l', 'pt', size);
    const imageData = canvas.toDataURL('image/png');
    const imgProps = pdf.getImageProperties(imageData);
    const margin = 20;
    const pdfWidth = pdf.internal.pageSize.getWidth() - margin * 2;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imageData, 'PNG', margin, margin, pdfWidth, pdfHeight);
    pdf.save('schema.pdf');
    onExportComplete?.({ truncated: toEntries(truncatedInstanceIds) });
  }, [captureScheduleCanvas, computeClipHeightPx, onExportComplete, toEntries]);

  const handleExportImage = useCallback(async (type: 'png' | 'jpeg') => {
    const captured = await captureScheduleCanvas();
    if (!captured) return;
    const { canvas, truncatedInstanceIds } = captured;
    const dataUrl = type === 'png'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.92);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = type === 'png' ? 'schema.png' : 'schema.jpg';
    link.click();
    onExportComplete?.({ truncated: toEntries(truncatedInstanceIds) });
  }, [captureScheduleCanvas, onExportComplete, toEntries]);

  return {
    handleExportPDF,
    handleExportImage
  };
};
