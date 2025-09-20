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
