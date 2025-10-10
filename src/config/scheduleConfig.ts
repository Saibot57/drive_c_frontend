// src/config/scheduleConfig.ts
export interface TimeSlot {
  id: string;
  startTime: string; // Format: "HH:MM"
  endTime: string;   // Format: "HH:MM"
  durationMinutes: number;
}

export interface ScheduleConfig {
  days: string[];
  timeSlots: TimeSlot[];
  allowCustomTimeSlots: boolean;
  allowVariableDuration: boolean;
  slotHeightMultiplier: number; // Controls the height of time slots relative to their duration
  maxSlotColumns: number; // Maximum number of parallel boxes in a single time slot
}

// Default configuration
export const DEFAULT_SLOT_HEIGHT_MULTIPLIER = 1.3;

export const defaultScheduleConfig: ScheduleConfig = {
  days: ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'],
  timeSlots: [
    { id: '1', startTime: '08:30', endTime: '09:30', durationMinutes: 60 },
    { id: '2', startTime: '09:40', endTime: '10:40', durationMinutes: 60 },
    { id: '3', startTime: '10:55', endTime: '11:55', durationMinutes: 60 },
    { id: '4', startTime: '12:45', endTime: '13:45', durationMinutes: 60 },
    { id: '5', startTime: '13:55', endTime: '14:55', durationMinutes: 60 }
  ],
  allowCustomTimeSlots: true,
  allowVariableDuration: true,
  slotHeightMultiplier: DEFAULT_SLOT_HEIGHT_MULTIPLIER,
  maxSlotColumns: 5
};

// Current application configuration
let currentConfig: ScheduleConfig = { ...defaultScheduleConfig };

// Configuration management functions
export function getScheduleConfig(): ScheduleConfig {
  return currentConfig;
}

export function updateScheduleConfig(newConfig: Partial<ScheduleConfig>): ScheduleConfig {
  currentConfig = {
    ...currentConfig,
    ...newConfig
  };
  return currentConfig;
}

export function resetScheduleConfig(): ScheduleConfig {
  currentConfig = { ...defaultScheduleConfig };
  return currentConfig;
}

// Helper function to format time slots for display
export function formatTimeSlot(timeSlot: TimeSlot): string {
  return `${timeSlot.startTime}-${timeSlot.endTime}`;
}

// Helper function to calculate time slot height based on duration
export function calculateTimeSlotHeight(durationMinutes: number, multiplier: number = 1): number {
  // Base height for a 60-minute slot
  const baseHeight = 60; // in pixels
  return (baseHeight * durationMinutes / 60) * multiplier;
}

// Helper function to check if two time slots overlap
export function doTimeSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  const start1 = timeToMinutes(slot1.startTime);
  const end1 = timeToMinutes(slot1.endTime);
  const start2 = timeToMinutes(slot2.startTime);
  const end2 = timeToMinutes(slot2.endTime);
  
  return start1 < end2 && start2 < end1;
}

// Helper function to convert time string to minutes
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper function to add minutes to a time string
export function addMinutesToTime(time: string, minutesToAdd: number): string {
  let [hours, minutes] = time.split(':').map(Number);
  
  minutes += minutesToAdd;
  hours += Math.floor(minutes / 60);
  minutes = minutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}