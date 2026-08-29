/**
 * Hur högt schemat är i filen.
 *
 * Ersätter `computeClipHeightPx` i `useScheduleExport.ts`. Två skillnader som
 * spelar roll:
 *
 * 1. Den räknar i minuter och lämnar px-matematiken till scenen, i stället för
 *    att returnera en höjd med två magiska konstanter inbakade.
 * 2. Den tar ett `isVisible`-predikat som täcker både filtret och
 *    uteslutningslistan. Gamla vägen filtrerade bara på uteslutning, så ett
 *    bortfiltrerat sista pass lämnade dödyta i botten på filen.
 */

import { ScheduledEntry } from '@/types/schedule';
import { END_HOUR, PIXELS_PER_MINUTE, START_HOUR, timeToMinutes } from '@/utils/scheduleTime';
import { HEADER_H_PX, TITLE_H_PX, TOP_OFFSET_PX } from './theme';

export type ExportWindow = {
  /** Alltid `START_HOUR * 60`. Rutnätet börjar aldrig någon annanstans. */
  startMinutes: number;
  /** Sista hela timmen som ritas. Både etiketter och linjer räknas härifrån. */
  endMinutes: number;
  sceneHeightPx: number;
};

export type ExportWindowInput = {
  entries: ScheduledEntry[];
  isVisible: (entry: ScheduledEntry) => boolean;
  /**
   * Sluttid som måste rymmas utöver posterna. Ett planeringsblock kan sträcka
   * sig förbi sista lektionen när ramens slut är satt för hand.
   */
  extraEndMinutes?: number;
};

/** Ett tomt schema ska ge ett läsbart dokument, inte ett degenererat. */
const MIN_WINDOW_MINUTES = 60;

export const computeExportWindow = ({
  entries,
  isVisible,
  extraEndMinutes,
}: ExportWindowInput): ExportWindow => {
  const startMinutes = START_HOUR * 60;

  const latestEnd = entries.reduce((latest, entry) => {
    if (!isVisible(entry)) return latest;
    const endMinutes = timeToMinutes(entry.endTime);
    return Number.isFinite(endMinutes) ? Math.max(latest, endMinutes) : latest;
  }, Number.isFinite(extraEndMinutes) ? (extraEndMinutes as number) : Number.NEGATIVE_INFINITY);

  // Rundas upp till hel timme så rutnätet alltid slutar på en etikett.
  const wanted = Number.isFinite(latestEnd)
    ? Math.ceil(latestEnd / 60) * 60
    : startMinutes + MIN_WINDOW_MINUTES;

  const endMinutes = Math.min(
    END_HOUR * 60,
    Math.max(startMinutes + MIN_WINDOW_MINUTES, wanted)
  );

  const gridHeightPx = (endMinutes - startMinutes) * PIXELS_PER_MINUTE;

  return {
    startMinutes,
    endMinutes,
    sceneHeightPx: TITLE_H_PX + HEADER_H_PX + TOP_OFFSET_PX + gridHeightPx,
  };
};

/** Y-koordinaten i scenen för en tidpunkt i minuter. */
export const gridYForMinutes = (minutes: number, window: ExportWindow) =>
  TITLE_H_PX + HEADER_H_PX + TOP_OFFSET_PX + (minutes - window.startMinutes) * PIXELS_PER_MINUTE;
