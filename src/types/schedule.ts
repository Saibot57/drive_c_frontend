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
  startTime: string;
  endTime: string;
  participants: string[];
  days?: SwedishDay[];
  week?: number;
  year?: number;
  date?: string;
  dates?: string[];
  location?: string;
  notes?: string;
  color?: string;
  seriesId?: string;
  recurringEndDate?: string;
};
