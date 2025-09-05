import type { FamilyMember } from '../types';

export const STORAGE_KEY = 'familjens-schema-activities';
export const SETTINGS_KEY = 'familjens-schema-settings';

export const DEFAULT_FAMILY_MEMBERS: FamilyMember[] = [
  { id: 'rut', name: 'Rut', color: '#FF6B6B', icon: '👧' },
  { id: 'pim', name: 'Pim', color: '#4E9FFF', icon: '👦' },
  { id: 'siv', name: 'Siv', color: '#6BCF7F', icon: '👧' },
  { id: 'mamma', name: 'Mamma', color: '#A020F0', icon: '👩' },
  { id: 'pappa', name: 'Pappa', color: '#FF9F45', icon: '👨' },
];

export const ACTIVITY_COLORS = [
  '#FFD93D', '#6BCF7F', '#FF6B6B', '#4E9FFF',
  '#A020F0', '#FF9F45', '#00D9FF', '#FF4757'
];

export const MONTHS_SWEDISH = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december'
];

export const WEEKDAYS_FULL = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'];
export const WEEKEND_DAYS = ['Lördag', 'Söndag'];
export const ALL_DAYS = [...WEEKDAYS_FULL, ...WEEKEND_DAYS];

export const DEFAULT_SETTINGS = {
  showWeekends: false,
  dayStart: 7,
  dayEnd: 18
};