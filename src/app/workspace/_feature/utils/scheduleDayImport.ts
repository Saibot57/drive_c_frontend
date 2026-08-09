/**
 * En dag ur schemaplaneraren omvandlad till ritfärdigt innehåll.
 *
 * Ren funktion: aktiviteter in, dagar ut. Den anropar schemaplanerarens egna
 * tidsfunktioner men ändrar inget i dem.
 */

import type { PlannerActivity } from '@/types/schedule';
import { PLANNER_DAYS } from '@/components/schedule/constants';
import {
  END_HOUR,
  PIXELS_PER_MINUTE,
  START_HOUR,
  minutesToTime,
  timeToMinutes,
} from '@/utils/scheduleTime';
import type { ScheduleDayContent, ScheduleDayEntry } from '../types/scheduleDay.types';

/** Kortets bredd. Rymmer två krockande lektioner bredvid varandra. */
export const DAY_CARD_WIDTH = 208;
/** Extra bredd när kortet bär timlinjalen. */
export const DAY_RULER_WIDTH = 38;
/** Rubriken med dagens namn, ovanför tidsrutnätet. */
export const DAY_HEADER_HEIGHT = 26;
/** Luft mellan dagkorten när en hel vecka läggs ut. */
export const DAY_CARD_GAP = 12;

/** Reservfärg för aktiviteter som saknar egen. Samma grå som schemats rutnät. */
const FALLBACK_COLOR = '#e5e7eb';

export interface ScheduleDayDraft {
  content: ScheduleDayContent;
  size: { width: number; height: number };
  offset: { x: number; y: number };
}

/**
 * Aktiviteterna omgjorda till lektioner, per dag.
 *
 * Backend lämnar `duration` som den är, och den kan saknas eller vara skräp i
 * gamla rader — samma sak som `sanitizeScheduleImport` löser i planeraren. Här
 * härleds den ur tiderna i stället för att lita på fältet.
 */
export const groupActivitiesByDay = (
  activities: PlannerActivity[],
): Map<string, ScheduleDayEntry[]> => {
  const byDay = new Map<string, ScheduleDayEntry[]>();

  activities.forEach((activity) => {
    if (!activity.day || !activity.startTime) return;

    const startTime = activity.startTime;
    const endTime = activity.endTime || minutesToTime(timeToMinutes(startTime) + 60);
    const span = timeToMinutes(endTime) - timeToMinutes(startTime);
    const duration = Number.isFinite(activity.duration) && (activity.duration ?? 0) > 0
      ? Number(activity.duration)
      : Math.max(span, 0);

    const entry: ScheduleDayEntry = {
      instanceId: activity.id,
      title: activity.title,
      startTime,
      endTime,
      duration: duration > 0 ? duration : 60,
      color: activity.color || FALLBACK_COLOR,
      teacher: activity.teacher || undefined,
      room: activity.room || undefined,
      notes: activity.notes || undefined,
    };

    const list = byDay.get(activity.day);
    if (list) list.push(entry);
    else byDay.set(activity.day, [entry]);
  });

  byDay.forEach((entries) => {
    entries.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  });

  return byDay;
};

/** Dagarna i schemats ordning, med de som inte är veckodagar sist. */
export const sortDays = (days: string[]): string[] => {
  const order = (day: string) => {
    const index = (PLANNER_DAYS as readonly string[]).indexOf(day);
    return index === -1 ? PLANNER_DAYS.length : index;
  };
  return [...days].sort((a, b) => order(a) - order(b) || a.localeCompare(b, 'sv'));
};

/**
 * Tidsfönstret som rymmer allt i urvalet, avrundat till hela timmar.
 *
 * Gemensamt för hela importen med flit: dagar bredvid varandra måste ha samma
 * skala och samma nollpunkt, annars ligger måndagens klockan tio och tisdagens
 * på olika höjd.
 */
export const commonWindow = (
  entriesByDay: Map<string, ScheduleDayEntry[]>,
  days: string[],
): { windowStartHour: number; windowEndHour: number } => {
  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;

  days.forEach((day) => {
    (entriesByDay.get(day) ?? []).forEach((entry) => {
      earliest = Math.min(earliest, timeToMinutes(entry.startTime));
      latest = Math.max(latest, timeToMinutes(entry.endTime));
    });
  });

  // Tom dag, eller bara dagar utan lektioner: visa schemats vanliga fönster.
  if (!Number.isFinite(earliest) || !Number.isFinite(latest)) {
    return { windowStartHour: START_HOUR, windowEndHour: END_HOUR };
  }

  return {
    windowStartHour: Math.max(Math.floor(earliest / 60), 0),
    // Minst en timme hög, även om allt ligger inom samma klocktimme.
    windowEndHour: Math.min(Math.max(Math.ceil(latest / 60), Math.floor(earliest / 60) + 1), 24),
  };
};

/** Kortets höjd för ett givet fönster. */
export const dayCardHeight = (windowStartHour: number, windowEndHour: number): number =>
  DAY_HEADER_HEIGHT + (windowEndHour - windowStartHour) * 60 * PIXELS_PER_MINUTE;

export const buildScheduleDays = (
  activities: PlannerActivity[],
  days: string[],
  source: { archiveName: string | null; sourceLabel: string },
  capturedAt: string = new Date().toISOString(),
): ScheduleDayDraft[] => {
  const entriesByDay = groupActivitiesByDay(activities);
  const ordered = sortDays(days);
  const { windowStartHour, windowEndHour } = commonWindow(entriesByDay, ordered);
  const height = dayCardHeight(windowStartHour, windowEndHour);

  let x = 0;
  return ordered.map((day, index) => {
    // Bara första dagen bär linjalen. Fem linjaler bredvid varandra säger inget
    // mer än en, och de äter bredd från det som faktiskt ska läsas.
    const showRuler = index === 0;
    const width = DAY_CARD_WIDTH + (showRuler ? DAY_RULER_WIDTH : 0);
    const offset = { x, y: 0 };
    x += width + DAY_CARD_GAP;

    return {
      content: {
        archiveName: source.archiveName,
        sourceLabel: source.sourceLabel,
        capturedAt,
        day,
        entries: entriesByDay.get(day) ?? [],
        windowStartHour,
        windowEndHour,
        showRuler,
      },
      size: { width, height },
      offset,
    };
  });
};
