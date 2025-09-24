// src/utils/exportUtils.ts

import type { Activity } from '../types';
import { getWeekDateRange } from './dateUtils';
import { ALL_DAYS } from '../constants';

export const downloadICS = (
  activities: Activity[],
  selectedWeek: number,
  selectedYear: number,
  weekDates: Date[],
  days: string[]
): void => {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  
  const toICS = (date: Date, time: string): string => {
    const [hour, minute] = time.split(':');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${hour}${minute}00`;
  };

  const events = activities.filter(a => a.week === selectedWeek && a.year === selectedYear);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FamiljensSchema//SE'
  ];

  events.forEach(event => {
    const dayIndex = days.indexOf(event.day);
    if (dayIndex === -1) return;
    
    const date = weekDates[dayIndex];
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}`);
    lines.push(`DTSTAMP:${toICS(new Date(), '00:00')}`);
    lines.push(`DTSTART;TZID=Europe/Stockholm:${toICS(date, event.startTime)}`);
    lines.push(`DTEND;TZID=Europe/Stockholm:${toICS(date, event.endTime)}`);
    lines.push(`SUMMARY:${event.icon} ${event.name}`);
    
    if (event.location) {
      lines.push(`LOCATION:${event.location}`);
    }
    
    if (event.notes) {
      lines.push(`DESCRIPTION:${event.notes}`);
    }
    
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vecka-${selectedWeek}-${selectedYear}.ics`;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadAllICS = (activities: Activity[]): void => {
  const pad = (n: number): string => n.toString().padStart(2, '0');

  const toICS = (date: Date, time: string): string => {
    const [hour, minute] = time.split(':');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${hour}${minute}00`;
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FamiljensSchema//SE'
  ];

  activities.forEach(event => {
    try {
      const weekDates = getWeekDateRange(event.week, event.year, 7);
      const dayIndex = ALL_DAYS.indexOf(event.day);
      if (dayIndex === -1) return;

      const date = weekDates[dayIndex];
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${event.id}`);
      lines.push(`DTSTAMP:${toICS(new Date(), '00:00')}`);
      lines.push(`DTSTART;TZID=Europe/Stockholm:${toICS(date, event.startTime)}`);
      lines.push(`DTEND;TZID=Europe/Stockholm:${toICS(date, event.endTime)}`);
      lines.push(`SUMMARY:${event.icon} ${event.name}`);
      
      if (event.location) {
        lines.push(`LOCATION:${event.location}`);
      }
      
      if (event.notes) {
        lines.push(`DESCRIPTION:${event.notes}`);
      }
      
      lines.push('END:VEVENT');
    } catch (e) {
      console.error(`Kunde inte exportera händelse: ${event.name}`, e);
    }
  });

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `familjens-schema-alla-veckor.ics`;
  a.click();
  URL.revokeObjectURL(url);
};

export type ExportOptions = {
  filename?: string;
  marginMM?: number;
  scale?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const createCanvasSlice = (
  source: HTMLCanvasElement,
  startY: number,
  height: number
) => {
  const slice = document.createElement('canvas');
  slice.width = source.width;
  slice.height = Math.ceil(height);

  const ctx = slice.getContext('2d');
  if (!ctx) throw new Error('2D context not available');

  ctx.drawImage(
    source,
    0,
    Math.floor(startY),
    source.width,
    Math.floor(height),
    0,
    0,
    source.width,
    Math.floor(height)
  );

  return slice;
};

const canvasToPagedPdf = async (canvas: HTMLCanvasElement, marginMM = 10) => {
  const jsPDFModule = await import('jspdf');
  const { jsPDF } = jsPDFModule;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const margin = clamp(marginMM, 0, 20);
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  const mmPerPx = usableWidth / canvas.width;
  const pageHeightPx = usableHeight / mmPerPx;

  let offsetY = 0;
  let firstPage = true;

  while (offsetY < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
    const sliceCanvas = createCanvasSlice(canvas, offsetY, sliceHeight);
    const imageData = sliceCanvas.toDataURL('image/jpeg', 0.92);

    if (!firstPage) {
      pdf.addPage();
    }
    firstPage = false;

    const renderedHeightMM = sliceCanvas.height * mmPerPx;
    pdf.addImage(imageData, 'JPEG', margin, margin, usableWidth, renderedHeightMM, undefined, 'FAST');

    offsetY += sliceHeight;
  }

  return pdf;
};

export const exportScheduleToPDF = async (
  element: HTMLElement,
  options: ExportOptions = {}
) => {
  if (!element) throw new Error('exportScheduleToPDF: element is null');

  const html2canvasModule = await import('html2canvas');
  const html2canvas = html2canvasModule.default;

  // Wait for fonts before rendering to canvas to avoid layout shifts
  type DocumentWithFonts = Document & {
    fonts?: {
      ready?: Promise<unknown>;
    };
  };
  const fonts = (document as DocumentWithFonts).fonts;
  if (fonts?.ready) {
    await fonts.ready;
  }

  const scale = clamp(options.scale ?? window.devicePixelRatio ?? 1, 2, 3);
  const margin = options.marginMM ?? 10;
  const filename = options.filename ?? 'familjeschema.pdf';

  element.classList.add('print-mode');

  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const canvas = await html2canvas(element, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });

    const pdf = await canvasToPagedPdf(canvas, margin);
    pdf.save(filename);
  } finally {
    element.classList.remove('print-mode');
  }
};
