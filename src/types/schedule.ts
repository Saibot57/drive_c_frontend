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

export interface PlannerActivity {
  id: string;
  userId?: string;
  title: string;
  day: string;
  startTime: string;
  endTime: string;
  duration: number;
  archiveName?: string | null;
  teacher?: string;
  room?: string;
  notes?: string;
  color?: string;
  category?: string;
}

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
  notes?: string;
}

export interface RestrictionRule {
  id: string;
  subjectA: string;
  subjectB: string;
}

/** Del av dagen som en lärare är otillgänglig. 'all' = hela dagen. */
export type TeacherDayBlock = 'all' | 'fm' | 'em';

/**
 * Lärarnamn -> dag -> spärrade delar av dagen. En dag som saknas eller har en
 * tom lista är ledig.
 */
export type TeacherAvailability = Record<string, Record<string, TeacherDayBlock[]>>;

/** Ett ord i titeln som ger posten en bestämd färg. */
export interface ColorTriggerRule {
  id: string;
  word: string;
  color: string;
}

export interface PersistedPlannerState {
  version: number;
  timestamp: string;
  courses: PlannerCourse[];
  schedule: ScheduledEntry[];
  restrictions: RestrictionRule[];
  teacherAvailability?: TeacherAvailability;
  colorTriggers?: ColorTriggerRule[];
}
