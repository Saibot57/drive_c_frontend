'use client';

import { useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { isVectorPdfExportEnabled } from '@/config/featureFlags';
import { ScheduledEntry } from '@/types/schedule';
import { END_HOUR, PIXELS_PER_MINUTE, START_HOUR, timeToMinutes } from '@/utils/scheduleTime';
import { exportElementToVectorPdf } from '@/utils/vectorPdfExport';

type UseScheduleExportParams = {
  schedule: ScheduledEntry[];
};

export const useScheduleExport = ({ schedule }: UseScheduleExportParams) => {
  const captureScheduleCanvas = useCallback(async () => {
    const element = document.getElementById('schedule-canvas');
    if (!element) return null;
    element.classList.add('pdf-export');
    try {
      const maxCanvasSize = 16000;
      const targetWidth = element.scrollWidth;
      const targetHeight = element.scrollHeight;
      const scaleToLimit = Math.min(
        2,
        maxCanvasSize / Math.max(targetWidth, 1),
        maxCanvasSize / Math.max(targetHeight, 1)
      );
      return await html2canvas(element, {
        scale: scaleToLimit,
        width: targetWidth,
        height: targetHeight,
        windowWidth: targetWidth,
        windowHeight: targetHeight
      });
    } finally {
      element.classList.remove('pdf-export');
    }
  }, []);

  const computeClipHeightPx = useCallback(() => {
    const maxEndMinutes = schedule.reduce((latestEndMinutes, entry) => {
      const endMinutes = timeToMinutes(entry.endTime);
      return Number.isFinite(endMinutes)
        ? Math.max(latestEndMinutes, endMinutes)
        : latestEndMinutes;
    }, Number.NEGATIVE_INFINITY);

    if (!Number.isFinite(maxEndMinutes)) return undefined;
    const contentHeightPx = (maxEndMinutes - START_HOUR * 60) * PIXELS_PER_MINUTE;
    if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0) return undefined;
    const topOffsetPx = 16;
    const safetyMarginPx = 8;
    return contentHeightPx + topOffsetPx + safetyMarginPx;
  }, [schedule]);

  const handleExportPDF = useCallback(async () => {
    const exportElement = document.getElementById('schedule-canvas');
    const clipHeightPx = computeClipHeightPx();

    if (isVectorPdfExportEnabled && exportElement) {
      await exportElementToVectorPdf(exportElement, {
        filename: 'schema.pdf',
        extraClassNames: ['pdf-export'],
        clipHeightPx
      });
      return;
    }

    const canvas = await captureScheduleCanvas();
    if (!canvas) return;
    const pdf = new jsPDF('l', 'pt', 'a4');
    const imageData = canvas.toDataURL('image/png');
    const imgProps = pdf.getImageProperties(imageData);
    const margin = 20;
    const pdfWidth = pdf.internal.pageSize.getWidth() - margin * 2;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imageData, 'PNG', margin, margin, pdfWidth, pdfHeight);
    pdf.save('schema.pdf');
  }, [captureScheduleCanvas, computeClipHeightPx]);

  const handleExportImage = useCallback(async (type: 'png' | 'jpeg') => {
    const canvas = await captureScheduleCanvas();
    if (!canvas) return;
    const dataUrl = type === 'png'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.92);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = type === 'png' ? 'schema.png' : 'schema.jpg';
    link.click();
  }, [captureScheduleCanvas]);

  return {
    handleExportPDF,
    handleExportImage
  };
};
