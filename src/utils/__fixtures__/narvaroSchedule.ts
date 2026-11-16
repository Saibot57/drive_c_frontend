/**
 * Testdata för narvaroSchedule: närvaroarket och veckoschemat så som de
 * ser ut i docs/plans/narvaro-schemakoppling.md, avsnitt 3. Byggd för hand.
 * Lärar- och elevnamnen är påhittade.
 */

import type { ScheduledEntry } from '@/types/schedule';
import { AttendanceTable, parseAttendance } from '@/utils/narvaro';

const HEAD = [
  ['', 'Måndag', '', '', 'Tisdag', '', '', 'Onsdag', '', '', 'Torsdag', '', '', '', 'Fredag', '', ''],
  ['', '8.30-9.45', '10.00-11.30', '12.30-14.00', 'Studieverkstad', '12.30-14.30', 'Studieverkstad',
    '8.30-9.45', '10.00-11.30', '12.30-14.30', '8.30-10.00', '10.15-11.45', '12.30-14.30', 'Studieverkstad',
    'Studieverkstad', '9.45-11.30', '12.30-14.30'],
];

/** Ett klassark med samma uppställning som de riktiga. */
export function sheet(names: string[]): AttendanceTable {
  const grid = HEAD.map(r => [...r]);
  names.forEach(n => grid.push([n, ...Array.from({ length: 16 }, () => 'TRUE')]));
  const table = parseAttendance(grid);
  if (!table) throw new Error('Testarket gick inte att läsa');
  return table;
}

export const CLASSES = ['Grund', 'Oliv', 'Rosa'];

/** Tre klassers ark. "Delad Namnsson" finns i både Oliv och Rosa. */
export const sheets = (): Record<string, AttendanceTable> => ({
  Grund: sheet(['Grund Ett', 'Grund Två']),
  Oliv: sheet(['Oliv Ett', 'Delad Namnsson']),
  Rosa: sheet(['Rosa Ett', 'Delad Namnsson']),
});

/** Användarens namn i schemats lärarfält. */
export const ME = 'Kim';

let seq = 0;
const e = (day: string, startTime: string, endTime: string, title: string, teacher = '', extra: Partial<ScheduledEntry> = {}): ScheduledEntry => {
  seq += 1;
  return {
    id: `p${seq}`,
    instanceId: `p${seq}`,
    title,
    teacher,
    room: '',
    color: '#ffffff',
    duration: 0,
    day,
    startTime,
    endTime,
    ...extra,
  };
};

const tema = (day: string, start: string, end: string) => [
  e(day, start, end, 'Tema Grund', 'Robin'),
  e(day, start, end, 'Tema Oliv', 'Sam'),
  e(day, start, end, 'Tema Rosa', 'Kim  ', { room: 'Rådhuset', notes: 'Historia: Historiebruk' }),
];
const ma = (day: string, start: string, end: string) => [
  e(day, start, end, 'Ma 1', 'Robin, Kim'),
  e(day, start, end, 'Ma Grund', 'Sam'),
  e(day, start, end, 'Studieverkstad', 'Alex', { notes: '.' }),
];
const engelska = (day: string, start: string, end: string) => [
  e(day, start, end, 'Engelska 1', 'Sam'),
  e(day, start, end, 'Engelska 2', 'Kim'),
  e(day, start, end, 'Engelska Grund', 'Robin'),
];

const thursdayRegular = () => [
  ...tema('Torsdag', '08:30', '09:45'),
  e('Torsdag', '09:45', '10:00', 'Paus'),
  ...tema('Torsdag', '10:00', '11:30'),
  e('Torsdag', '11:30', '12:30', 'Lunch'),
  ...tema('Torsdag', '12:30', '14:30'),
  e('Torsdag', '14:30', '14:45', 'Paus'),
  e('Torsdag', '14:45', '15:45', 'Studieverkstad', 'Alex'),
];

/** En vanlig vecka (v. 45–46). Med `studiebesok` torsdagen i v. 47. */
export function week({ studiebesok = false } = {}): ScheduledEntry[] {
  return [
    ...tema('Måndag', '08:30', '10:00'),
    e('Måndag', '10:00', '10:15', 'Paus'),
    ...tema('Måndag', '10:15', '11:30'),
    e('Måndag', '11:30', '12:30', 'Lunch'),
    ...tema('Måndag', '12:30', '14:00'),
    e('Måndag', '14:00', '14:15', 'Paus'),
    e('Måndag', '14:15', '15:45', 'APT', 'Alla'),

    e('Tisdag', '08:30', '10:00', 'AK-möte', 'Alla'),
    e('Tisdag', '10:00', '10:15', 'Paus'),
    ...ma('Tisdag', '10:15', '11:45'),
    e('Tisdag', '11:45', '12:30', 'Lunch'),
    ...engelska('Tisdag', '12:30', '14:30'),
    e('Tisdag', '14:30', '14:45', 'Paus'),
    ...ma('Tisdag', '14:45', '15:45'),

    ...tema('Onsdag', '08:30', '09:45'),
    e('Onsdag', '09:45', '10:00', 'Paus'),
    ...tema('Onsdag', '10:00', '11:30'),
    e('Onsdag', '11:30', '12:30', 'Lunch'),
    e('Onsdag', '12:30', '14:30', 'Onsdagsklubben', 'Alla'),
    e('Onsdag', '14:30', '14:45', 'Paus'),
    e('Onsdag', '14:45', '15:45', 'Ma2', 'Robin'),

    ...(studiebesok
      ? [e('Torsdag', '08:30', '15:30', 'Studiebesök i Malmö', 'Alla')]
      : thursdayRegular()),

    ...ma('Fredag', '08:30', '09:30'),
    e('Fredag', '09:30', '09:45', 'Paus'),
    ...engelska('Fredag', '09:45', '11:45'),
    e('Fredag', '11:45', '12:30', 'Lunch'),
    ...tema('Fredag', '12:30', '14:00'),
    e('Fredag', '14:00', '14:15', 'Paus'),
    e('Fredag', '14:15', '15:15', 'Ma2', 'Robin'),
  ];
}
