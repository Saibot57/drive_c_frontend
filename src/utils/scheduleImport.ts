import { v4 as uuidv4 } from 'uuid';
import { PLANNER_DAYS } from '@/config/plannerConstants';
import { ScheduledEntry } from '@/types/schedule';
import { minutesToTime, timeToMinutes } from '@/utils/scheduleTime';

/**
 * Lagar poster som kommer utifrån – en JSON-backup eller servern – så att de
 * går att rita: saknade tider och längder fylls i, varje post får ett
 * instanceId och en okänd dag blir måndag.
 */
export const sanitizeScheduleImport = (importedSchedule: any[]): ScheduledEntry[] => {
  if (!Array.isArray(importedSchedule)) return [];

  return importedSchedule.map(entry => {
    const start = entry.startTime || '08:00';
    const end = entry.endTime || minutesToTime(timeToMinutes(start) + 60);

    let duration = entry.duration;
    if (!duration || isNaN(duration)) {
      duration = timeToMinutes(end) - timeToMinutes(start);
    }

    return {
      ...entry,
      instanceId: entry.instanceId || uuidv4(),
      startTime: start,
      endTime: end,
      duration: duration > 0 ? duration : 60,
      day: PLANNER_DAYS.includes(entry.day as typeof PLANNER_DAYS[number]) ? entry.day : PLANNER_DAYS[0]
    };
  });
};
