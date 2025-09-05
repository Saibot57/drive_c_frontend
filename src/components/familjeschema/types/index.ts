export interface FamilyMember {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface Activity {
  id: string;
  seriesId?: string; // TILLAGD: För att identifiera händelser i samma serie
  name: string;
  icon: string;
  day: string;
  week: number;
  year: number;
  participants: string[];
  startTime: string;
  endTime: string;
  location?: string;
  notes?: string;
  color?: string;
}

export interface FormData {
  name: string;
  icon: string;
  days: string[];
  participants: string[];
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  recurring: boolean;
  recurringEndDate: string;
  color?: string;
}

export interface Settings {
  showWeekends: boolean;
  dayStart: number;
  dayEnd: number;
}

export interface Position {
  top: number;
  height: number;
}