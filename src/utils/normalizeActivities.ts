import type { ActivityImportItem, SwedishDay } from '@/types/schedule';
import { normalizeHHMM, isStartBeforeEnd } from './time';
import { isoWeekYear, swedishDayFromDate, dateFromISOWeek } from './dateSv';
import { normalizeSwedishDay } from './strings';

function ensureArray<T>(value: T | T[] | undefined, fallback: T[] = []): T[] {
  if (value == null) return fallback;
  return Array.isArray(value) ? value : [value];
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isoWeekdayFromSwedish(day: SwedishDay): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const index = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'].indexOf(day);
  return (index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export function normalizeActivitiesForBackend(
  rawItems: unknown[],
  uiWeek?: number,
  uiYear?: number,
): { ok: ActivityImportItem[]; errors: { index: number; message: string }[] } {
  const ok: ActivityImportItem[] = [];
  const errors: { index: number; message: string }[] = [];

  rawItems.forEach((raw, index) => {
    try {
      const name = String((raw as { name?: unknown })?.name ?? '').trim();
      if (!name) throw new Error('name is required');

      const startTime = normalizeHHMM(String((raw as { startTime?: unknown })?.startTime ?? ''));
      const endTime = normalizeHHMM(String((raw as { endTime?: unknown })?.endTime ?? ''));
      if (!isStartBeforeEnd(startTime, endTime)) {
        throw new Error('startTime must be earlier than endTime');
      }

      const rawParticipants = (raw as { participants?: unknown })?.participants;
      let participants: string[];
      if (Array.isArray(rawParticipants)) {
        participants = rawParticipants.map((p) => String(p));
      } else if (rawParticipants == null) {
        participants = [];
      } else {
        participants = [String(rawParticipants)];
      }

      const icon = (raw as { icon?: unknown })?.icon;
      const location = (raw as { location?: unknown })?.location;
      const notes = (raw as { notes?: unknown })?.notes;
      const color = (raw as { color?: unknown })?.color;
      const baseSeriesId = String((raw as { seriesId?: unknown })?.seriesId ?? uuid());

      const rawDates = ensureArray<string>((raw as { dates?: unknown })?.dates);
      const singleDate = (raw as { date?: unknown })?.date;

      const pushWeekObject = (week: number, year: number, days: SwedishDay[]) => {
        if (!Number.isInteger(week) || !Number.isInteger(year)) {
          throw new Error('week/year must be integers');
        }
        if (!days.length) throw new Error('days is required');

        const recurringEndDate = (raw as { recurringEndDate?: unknown })?.recurringEndDate;
        if (recurringEndDate != null) {
          const recurringEnd = new Date(`${recurringEndDate}T00:00:00Z`);
          if (Number.isNaN(recurringEnd.getTime())) {
            throw new Error("recurringEndDate must be 'YYYY-MM-DD'");
          }
          const firstIsoDay = isoWeekdayFromSwedish(days[0]);
          const firstDate = dateFromISOWeek(year, week, firstIsoDay);
          if (recurringEnd < firstDate) {
            throw new Error('recurringEndDate cannot be earlier than start date');
          }
        }

        const normalized: ActivityImportItem = {
          name,
          icon: icon == null ? undefined : String(icon),
          startTime,
          endTime,
          participants,
          location: location == null ? undefined : String(location),
          notes: notes == null ? undefined : String(notes),
          color: color == null ? undefined : String(color),
          seriesId: baseSeriesId,
          days,
          week,
          year,
        };

        if ((raw as { recurringEndDate?: unknown })?.recurringEndDate != null) {
          normalized.recurringEndDate = String(
            (raw as { recurringEndDate?: unknown })?.recurringEndDate,
          );
        }

        ok.push(normalized);
      };

      if (rawDates.length > 0 || singleDate) {
        const allDates = [...rawDates, ...(singleDate ? [String(singleDate)] : [])];
        allDates.forEach((dateString) => {
          const { week, year } = isoWeekYear(dateString);
          const day = swedishDayFromDate(dateString);
          pushWeekObject(week, year, [day]);
        });
        return;
      }

      let days = ensureArray((raw as { days?: unknown })?.days).map(normalizeSwedishDay);
      if (!days.length) {
        const singleDay = (raw as { day?: unknown })?.day;
        if (singleDay) {
          days = [normalizeSwedishDay(String(singleDay))];
        }
      }
      if (!days.length) {
        throw new Error("Provide 'days' or 'day' or 'date(s)'");
      }

      let week: number | undefined;
      let year: number | undefined;

      if (Number.isInteger((raw as { week?: unknown })?.week)) {
        week = Number((raw as { week?: unknown })?.week);
      }
      if (Number.isInteger((raw as { year?: unknown })?.year)) {
        year = Number((raw as { year?: unknown })?.year);
      }

      if (week == null) week = uiWeek;
      if (year == null) year = uiYear;

      if (!Number.isInteger(week) || !Number.isInteger(year)) {
        throw new Error('week/year missing; cannot infer');
      }

      pushWeekObject(week as number, year as number, days);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid activity';
      errors.push({ index, message });
    }
  });

  return { ok, errors };
}
