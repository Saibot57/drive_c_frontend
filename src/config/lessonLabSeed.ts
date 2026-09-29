import type { LabLesson, LabState } from '@/types/lessonLab';

/**
 * Veckolabbets startläge: tavlan från arbetslaget (29 sep 2026).
 *
 * Tillgängligheten är tavlans, med Anna tillagd på tisdag. Den ersätter
 * planerarens spärrar, som var inaktuella. Tamara är resurs och studiecoach
 * och planerar inga lektioner.
 *
 * Lektionerna är de elva röda rutorna: temapassen i v. 40, med samma tider.
 * Varje ruta går samtidigt för Grund, Oliv och Rosa.
 */

const lesson = (id: string, day: LabLesson['day'], start: string, end: string): LabLesson => ({
  id,
  day,
  start,
  end,
  title: '',
  areaId: null,
  teamId: null,
  split: false,
  classTeams: {},
  classTeachers: {},
});

export const LAB_SEED: LabState = {
  version: 1,
  classes: ['Grund', 'Oliv', 'Rosa'],
  teachers: [
    { id: 't-tobias', name: 'Tobias', days: ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag'], resource: false },
    { id: 't-victor', name: 'Victor', days: ['Måndag', 'Tisdag', 'Torsdag', 'Fredag'], resource: false },
    { id: 't-armine', name: 'Armine', days: ['Måndag', 'Tisdag', 'Onsdag', 'Fredag'], resource: false },
    { id: 't-camilla', name: 'Camilla', days: ['Måndag', 'Tisdag', 'Torsdag', 'Fredag'], resource: false },
    { id: 't-anton', name: 'Anton', days: ['Tisdag', 'Onsdag', 'Fredag'], resource: false },
    { id: 't-anna', name: 'Anna', days: ['Tisdag', 'Onsdag', 'Torsdag', 'Fredag'], resource: false },
    { id: 't-tamara', name: 'Tamara', days: ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'], resource: true },
  ],
  teams: [],
  // Områdena som förekommit i temapassen v. 36–40.
  areas: [
    { id: 'a-skriv', name: 'Skrivande', color: '#fde68a', goalMinutes: null },
    { id: 'a-litt', name: 'Litteratur', color: '#fecdd3', goalMinutes: null },
    { id: 'a-sam', name: 'Samhälle', color: '#c7d2fe', goalMinutes: null },
    { id: 'a-rel', name: 'Religion', color: '#ddd6fe', goalMinutes: null },
    { id: 'a-no', name: 'NO/hälsa', color: '#a7f3d0', goalMinutes: null },
    { id: 'a-eng', name: 'Engelska', color: '#fed7aa', goalMinutes: null },
    { id: 'a-ma', name: 'Temamatte', color: '#bae6fd', goalMinutes: null },
  ],
  template: [
    lesson('l-man-1', 'Måndag', '08:30', '09:45'),
    lesson('l-man-2', 'Måndag', '10:00', '11:30'),
    lesson('l-man-3', 'Måndag', '12:30', '14:00'),
    lesson('l-tis-1', 'Tisdag', '12:30', '14:30'),
    lesson('l-ons-1', 'Onsdag', '08:30', '09:45'),
    lesson('l-ons-2', 'Onsdag', '10:00', '11:30'),
    lesson('l-tor-1', 'Torsdag', '08:30', '09:45'),
    lesson('l-tor-2', 'Torsdag', '10:00', '11:30'),
    lesson('l-tor-3', 'Torsdag', '12:30', '14:30'),
    lesson('l-fre-1', 'Fredag', '09:45', '11:45'),
    lesson('l-fre-2', 'Fredag', '12:30', '14:30'),
  ],
  weeks: [],
};
