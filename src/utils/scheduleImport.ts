import { v4 as uuidv4 } from 'uuid';
import { FALLBACK_ENTRY_DURATION_MINUTES, PLANNER_DAYS } from '@/config/plannerConstants';
import { ScheduledEntry } from '@/types/schedule';
import { endTimeAfter, timeToMinutes } from '@/utils/scheduleTime';

/**
 * Lagar poster som kommer utifrån – en JSON-backup eller servern – så att de
 * går att rita: saknade tider och längder fylls i, varje post får ett
 * instanceId och en okänd dag blir måndag.
 *
 * En sluttid som inte ligger efter starten räknas om från postens längd.
 * Servern godtar den i dag men loggar den, och sådana poster läkas här när
 * schemat läses in och sparas igen.
 */
export const sanitizeScheduleImport = (importedSchedule: any[]): ScheduledEntry[] => {
  if (!Array.isArray(importedSchedule)) return [];

  return importedSchedule.map(entry => {
    const start = entry.startTime || '08:00';
    const startMinutes = timeToMinutes(start);
    const givenEnd = entry.endTime || endTimeAfter(startMinutes, FALLBACK_ENTRY_DURATION_MINUTES);
    const end = timeToMinutes(givenEnd) > startMinutes
      ? givenEnd
      : endTimeAfter(startMinutes, Number(entry.duration), FALLBACK_ENTRY_DURATION_MINUTES);

    let duration = entry.duration;
    if (!duration || isNaN(duration)) {
      duration = timeToMinutes(end) - startMinutes;
    }

    return {
      ...entry,
      instanceId: entry.instanceId || uuidv4(),
      startTime: start,
      endTime: end,
      duration: duration > 0 ? duration : FALLBACK_ENTRY_DURATION_MINUTES,
      day: PLANNER_DAYS.includes(entry.day as typeof PLANNER_DAYS[number]) ? entry.day : PLANNER_DAYS[0]
    };
  });
};
