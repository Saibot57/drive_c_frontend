export type SwedishDay =
  | 'Måndag'
  | 'Tisdag'
  | 'Onsdag'
  | 'Torsdag'
  | 'Fredag'
  | 'Lördag'
  | 'Söndag';

export type ActivityImportItem = {
  name: string;
  icon?: string;
  participants: string[];
  startTime: string;
  endTime: string;
  days: SwedishDay[];
  week: number;
  year: number;
  seriesId?: string;
};

// --- Nya typer för Schema-planeraren (Timeline Version) ---

export interface PlannerCourse {
  id: string;
  title: string;
  teacher: string;
  room: string;
  color: string;
  duration: number; // Standardlängd i minuter
  category?: string;
}

export interface ScheduledEntry extends PlannerCourse {
  instanceId: string;
  day: string;
  startTime: string; // "HH:MM", t.ex "08:15"
  endTime: string;   // "HH:MM", t.ex "09:15"
}

export interface RestrictionRule {
  id: string;
  subjectA: string; 
  subjectB: string; 
}