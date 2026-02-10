import type { Activity, FamilyMember } from '../types';
import { ACTIVITY_COLORS } from '../constants';
import { buildActivityColumnLayout } from './layoutUtils';
import { timeToMinutes, minutesToTime } from '@/utils/scheduleTime';

export type VectorPdfExportOptions = {
  filename?: string;
  pageSize?: 'a4' | 'a3';
  orientation?: 'portrait' | 'landscape';
  visibleDays: string[];
  weekDates?: Date[];
  timeWindow: {
    start: string;
    end: string;
  };
  margins?: Partial<{
    top: number;
    right: number;
    bottom: number;
    left: number;
  }>;
  minEventHeightMM?: number;
  maxOverlapColumns?: number;
  timeSlotMinutes?: number;
  activityColorLightenFactor?: number;
  daySeparator?: {
    lineWidth?: number;
    color?: PdfColor;
  };
};

type PdfColor = { r: number; g: number; b: number };

const DEFAULT_MARGINS = { top: 12, right: 10, bottom: 10, left: 10 };
const DEFAULT_ACTIVITY_COLOR_LIGHTEN_FACTOR = 0.65;
const DEFAULT_DAY_SEPARATOR_LINE_WIDTH = 0.5;
const DEFAULT_DAY_SEPARATOR_COLOR: PdfColor = { r: 200, g: 205, b: 210 };
const DEFAULT_GRID_LINE_WIDTH = 0.2;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const lightenColor = (color: PdfColor, factor: number): PdfColor => {
  const clampedFactor = clamp(factor, 0, 1);
  return {
    r: Math.round(color.r + (255 - color.r) * clampedFactor),
    g: Math.round(color.g + (255 - color.g) * clampedFactor),
    b: Math.round(color.b + (255 - color.b) * clampedFactor),
  };
};

const hexToRgb = (hex: string): PdfColor => {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized.padEnd(6, '0');
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return { r, g, b };
};

const resolveActivityColor = (
  activity: Activity,
  familyMembers: FamilyMember[],
  fallbackIndex: number
): PdfColor => {
  if (activity.color) {
    return hexToRgb(activity.color);
  }
  const participants = activity.participants
    .map(id => familyMembers.find(member => member.id === id))
    .filter(Boolean) as FamilyMember[];
  if (participants.length > 0) {
    return hexToRgb(participants[0].color);
  }
  return hexToRgb(ACTIVITY_COLORS[fallbackIndex % ACTIVITY_COLORS.length]);
};

const formatDayLabel = (day: string, date?: Date) => {
  if (!date) return day;
  return `${day} ${date.getDate()}/${date.getMonth() + 1}`;
};

const withEllipsis = (text: string) => (text.endsWith('…') ? text : `${text.replace(/\s+$/, '')}…`);

const wrapLines = (lines: string[], maxLines: number) => {
  if (lines.length <= maxLines) return lines;
  const trimmed = lines.slice(0, maxLines);
  trimmed[maxLines - 1] = withEllipsis(trimmed[maxLines - 1]);
  return trimmed;
};

export const exportScheduleVectorPdf = async (
  activities: Activity[],
  familyMembers: FamilyMember[],
  selectedWeek: number,
  selectedYear: number,
  options: VectorPdfExportOptions
) => {
  const jsPDFModule = await import('jspdf');
  const { jsPDF } = jsPDFModule;

  const pdf = new jsPDF({
    orientation: options.orientation ?? 'landscape',
    unit: 'mm',
    format: options.pageSize ?? 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margins = {
    ...DEFAULT_MARGINS,
    ...options.margins,
  };

  const headerHeight = 12;
  const timeColumnWidth = 18;
  const contentWidth = pageWidth - margins.left - margins.right;
  const contentHeight = pageHeight - margins.top - margins.bottom;
  const dayColumnWidth = (contentWidth - timeColumnWidth) / options.visibleDays.length;
  const gridTop = margins.top + headerHeight;
  const gridHeight = contentHeight - headerHeight;

  const windowStart = timeToMinutes(options.timeWindow.start);
  const windowEnd = timeToMinutes(options.timeWindow.end);
  const windowMinutes = Math.max(windowEnd - windowStart, 1);
  const minutesToMm = gridHeight / windowMinutes;
  const timeSlotMinutes = options.timeSlotMinutes ?? 60;
  const activityColorLightenFactor = clamp(
    options.activityColorLightenFactor ?? DEFAULT_ACTIVITY_COLOR_LIGHTEN_FACTOR,
    0,
    1
  );
  const daySeparatorLineWidth = options.daySeparator?.lineWidth ?? DEFAULT_DAY_SEPARATOR_LINE_WIDTH;
  const daySeparatorColor = options.daySeparator?.color ?? DEFAULT_DAY_SEPARATOR_COLOR;

  const gridLeft = margins.left + timeColumnWidth;
  const gridRight = gridLeft + dayColumnWidth * options.visibleDays.length;

  pdf.setDrawColor(218, 223, 230);
  pdf.setLineWidth(DEFAULT_GRID_LINE_WIDTH);
  pdf.setFont('helvetica', 'normal');

  pdf.setFillColor(245, 247, 250);
  pdf.rect(margins.left, margins.top, contentWidth, headerHeight, 'F');

  options.visibleDays.forEach((day, index) => {
    const x = gridLeft + dayColumnWidth * index;
    pdf.setDrawColor(daySeparatorColor.r, daySeparatorColor.g, daySeparatorColor.b);
    pdf.setLineWidth(daySeparatorLineWidth);
    pdf.line(x, margins.top, x, margins.top + contentHeight);

    const label = formatDayLabel(day, options.weekDates?.[index]);
    pdf.setFontSize(10);
    pdf.setTextColor(40, 44, 52);
    pdf.text(label, x + 2, margins.top + 8);
  });

  pdf.setDrawColor(daySeparatorColor.r, daySeparatorColor.g, daySeparatorColor.b);
  pdf.setLineWidth(daySeparatorLineWidth);
  pdf.line(gridRight, margins.top, gridRight, margins.top + contentHeight);
  // Keep horizontal time grid lines thin; only day separators should stand out.
  pdf.setLineWidth(DEFAULT_GRID_LINE_WIDTH);

  for (let minutes = windowStart; minutes <= windowEnd; minutes += timeSlotMinutes) {
    const offset = (minutes - windowStart) * minutesToMm;
    const y = gridTop + offset;
    pdf.setDrawColor(220, 224, 230);
    pdf.line(margins.left, y, gridRight, y);
    pdf.setFontSize(8);
    pdf.setTextColor(90, 96, 104);
    const label = minutesToTime(minutes);
    pdf.text(label, margins.left + timeColumnWidth - 2, y + 2, { align: 'right' });
  }

  options.visibleDays.forEach((day, dayIndex) => {
    const dayActivities = activities.filter(activity =>
      activity.day === day &&
      activity.week === selectedWeek &&
      activity.year === selectedYear
    );
    const layout = buildActivityColumnLayout(dayActivities);
    const maxOverlapColumns = options.maxOverlapColumns ?? 3;
    const hiddenColumns = Math.max((layout.values().next().value?.colCount ?? 1) - maxOverlapColumns, 0);

    if (hiddenColumns > 0) {
      const x = gridLeft + dayColumnWidth * dayIndex;
      pdf.setFontSize(9);
      pdf.setTextColor(120, 126, 135);
      pdf.text(`+${hiddenColumns}`, x + dayColumnWidth - 4, margins.top + 8, { align: 'right' });
    }

    dayActivities.forEach((activity, index) => {
      const position = layout.get(activity.id);
      const colIndex = position?.colIndex ?? 0;
      const colCount = position?.colCount ?? 1;
      if (colIndex >= maxOverlapColumns) {
        return;
      }

      const effectiveColCount = Math.min(colCount, maxOverlapColumns);
      const columnWidth = dayColumnWidth / effectiveColCount;
      const x = gridLeft + dayColumnWidth * dayIndex + columnWidth * colIndex;
      const padding = 1.2;

      const startMin = timeToMinutes(activity.startTime);
      const endMin = timeToMinutes(activity.endTime);
      const visibleStart = clamp(startMin, windowStart, windowEnd);
      const visibleEnd = clamp(endMin, windowStart, windowEnd);
      if (visibleEnd <= visibleStart) {
        return;
      }

      const rawHeight = (visibleEnd - visibleStart) * minutesToMm;
      const minEventHeight = options.minEventHeightMM ?? 6;
      const height = Math.max(rawHeight, minEventHeight);
      const y = gridTop + (visibleStart - windowStart) * minutesToMm;

      const rawColor = resolveActivityColor(activity, familyMembers, index);
      const color = lightenColor(rawColor, activityColorLightenFactor);
      pdf.setFillColor(color.r, color.g, color.b);
      pdf.setDrawColor(255, 255, 255);
      pdf.rect(x + padding, y, columnWidth - padding * 2, height, 'F');

      pdf.setTextColor(32, 32, 32);
      pdf.setFontSize(8.5);
      const textWidth = columnWidth - padding * 4;
      const lineHeight = pdf.getTextDimensions('Mg').h;
      const availableLines = Math.max(1, Math.floor((height - padding * 2) / lineHeight));
      const includeTime = availableLines >= 2;
      const titleLinesAllowed = includeTime ? Math.max(1, availableLines - 1) : 1;

      const titleText = `${activity.icon} ${activity.name}`.trim();
      const titleLines = wrapLines(
        pdf.splitTextToSize(titleText, textWidth) as string[],
        titleLinesAllowed
      );
      const lines = includeTime
        ? [...titleLines, `${activity.startTime}–${activity.endTime}`]
        : titleLines;

      lines.forEach((line, lineIndex) => {
        pdf.text(line, x + padding * 2, y + padding + lineHeight * (lineIndex + 1));
      });
    });
  });

  // Dense overlap policy: cap columns and surface "+N" in the day header.
  // This keeps the PDF legible while indicating extra concurrent events.

  const filename = options.filename ?? `familjeschema-${selectedWeek}-${selectedYear}.pdf`;
  pdf.save(filename);
};
