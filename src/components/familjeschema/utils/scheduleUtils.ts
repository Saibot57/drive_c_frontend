import type { Activity, Position } from '../types';

export const generateTimeSlots = (startHour: number = 7, endHour: number = 18): string[] => {
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
  }
  return slots;
};

export const calculatePosition = (
  start: string,
  end: string,
  hourHeight: number = 60,
  base: number = 7
): Position => {
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  const top = ((startHour - base) * 60 + startMin) / 60 * hourHeight;
  const height = ((endHour - startHour) * 60 + (endMin - startMin)) / 60 * hourHeight;
  
  return { top, height };
};

export const overlaps = (a: Activity, b: Activity): boolean => {
  return !(a.endTime <= b.startTime || b.endTime <= a.startTime);
};

export const calculateOverlapGroups = (activities: Activity[]): Activity[][] => {
  const sorted = [...activities].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const groups: Activity[][] = [];
  
  sorted.forEach(activity => {
    let placed = false;
    for (const group of groups) {
      if (!group.some(item => overlaps(item, activity))) {
        group.push(activity);
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push([activity]);
    }
  });
  
  return groups;
};

export const generateActivityId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `a-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const conflictsExist = (
  newActivities: Activity[],
  existingActivities: Activity[]
): boolean => {
  return newActivities.some(newAct =>
    existingActivities.some(existingAct =>
      existingAct.id !== newAct.id &&
      existingAct.day === newAct.day &&
      existingAct.week === newAct.week &&
      existingAct.year === newAct.year &&
      overlaps(existingAct, newAct) &&
      newAct.participants.some(p => existingAct.participants.includes(p))
    )
  );
};