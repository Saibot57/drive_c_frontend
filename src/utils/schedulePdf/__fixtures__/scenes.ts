import { ScheduleExportInput } from '@/types/scheduleExport';
import { ScheduledEntry } from '@/types/schedule';
import { TextMeasurer } from '../measure';

/** Varje tecken är halva fontstorleken bred — siffrorna går att räkna för hand. */
export const fakeMeasurer: TextMeasurer = {
  width: (text, _font, sizePx) => text.length * sizePx * 0.5,
  ascentRatio: () => 0.8,
};

let counter = 0;
export const entry = (overrides: Partial<ScheduledEntry> = {}): ScheduledEntry => {
  counter += 1;
  return {
    id: `c${counter}`,
    instanceId: `i${counter}`,
    title: 'Matematik',
    teacher: 'TL',
    room: 'A12',
    color: '#fde68a',
    duration: 60,
    day: 'Måndag',
    startTime: '08:00',
    endTime: '09:00',
    ...overrides,
  };
};

export const input = (overrides: Partial<ScheduleExportInput> = {}): ScheduleExportInput => ({
  schedule: [],
  isVisible: () => true,
  resolveColor: (_title, fallback) => fallback,
  resolveRoom: (_title, current) => current ?? '',
  planningByDay: null,
  archiveName: 'v.35',
  exportedAt: new Date('2026-08-29T10:00:00'),
  pageMode: 'digital',
  ...overrides,
});

/** En vanlig vecka: flera dagar, en anteckning, två lärare, en tom sal. */
export const normalWeek = (): ScheduledEntry[] => [
  entry({ day: 'Måndag', startTime: '08:00', endTime: '09:30', duration: 90, title: 'Matematik 1', teacher: 'Tobias Lundh', room: 'A12' }),
  entry({ day: 'Måndag', startTime: '09:45', endTime: '10:30', duration: 45, title: 'Svenska', teacher: 'Hanna', room: 'B3', notes: 'Ta med boken\nKapitel 4' }),
  entry({ day: 'Tisdag', startTime: '10:00', endTime: '11:30', duration: 90, title: 'Naturkunskap', teacher: 'Tobias Lundh, Hanna', room: 'Labbet', color: '#bae6fd' }),
  entry({ day: 'Onsdag', startTime: '08:00', endTime: '08:20', duration: 20, title: 'Mentorstid', teacher: 'TL', room: '', color: '#d9f99d' }),
  entry({ day: 'Fredag', startTime: '12:00', endTime: '13:00', duration: 60, title: 'Idrott och hälsa', teacher: 'AB', room: 'Hallen', color: '#fecdd3' }),
];

/** Tre poster som krockar i tid och måste packas i kolumner. */
export const overlapDay = (): ScheduledEntry[] => [
  entry({ day: 'Måndag', startTime: '09:00', endTime: '10:00', duration: 60, title: 'Ett', color: '#fde68a' }),
  entry({ day: 'Måndag', startTime: '09:15', endTime: '10:15', duration: 60, title: 'Två', color: '#bae6fd' }),
  entry({ day: 'Måndag', startTime: '09:30', endTime: '10:30', duration: 60, title: 'Tre', color: '#c7d2fe' }),
];
