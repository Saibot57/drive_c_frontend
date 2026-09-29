import { describe, expect, it } from 'vitest';
import { LAB_SEED } from '@/config/lessonLabSeed';
import type { PlannerActivity } from '@/types/schedule';
import type { LabState } from '@/types/lessonLab';
import { assignTeam, labWarnings, teacherShareMinutes } from '@/utils/lessonLab';
import {
  busyFromArchive,
  fixedHoursByTeacher,
  lessonsFromArchive,
  temaTarget,
  unknownTeacherNames,
} from '@/utils/lessonLabArchive';
import { timeToMinutes } from '@/utils/scheduleTime';

const CLASSES = ['Grund', 'Oliv', 'Rosa'];

let seq = 0;
const pass = (day: string, startTime: string, endTime: string, title: string, teacher = ''): PlannerActivity => ({
  id: `a${++seq}`,
  title,
  day,
  startTime,
  endTime,
  duration: timeToMinutes(endTime) - timeToMinutes(startTime),
  teacher,
});

const tema = (day: string, start: string, end: string, teachers: [string, string, string] = ['', '', '']) =>
  CLASSES.map((c, i) => pass(day, start, end, `Tema ${c}`, teachers[i]));

/** Ett utdrag ur v. 40 med v. 38:s udda torsdag och ett helgruppspass. */
const ARCHIVE: PlannerActivity[] = [
  ...tema('Måndag', '08:30', '09:45', ['Victor', 'Tobias', 'Anna']),
  pass('Måndag', '14:15', '15:45', 'APT', 'Alla'),
  pass('Tisdag', '08:30', '10:00', 'AK-möte', 'Alla'),
  pass('Tisdag', '10:15', '11:45', 'Ma 1', 'Anton'),
  pass('Tisdag', '10:15', '11:45', 'Ma  Grund', 'Armine'),
  pass('Tisdag', '10:15', '11:45', 'Studieverkstad', 'Tamara'),
  pass('Tisdag', '14:45', '15:45', 'Ma 1', 'Anton'),
  pass('Onsdag', '14:45', '15:45', 'Ma2 (tillval)', 'Anton, '),
  pass('Torsdag', '08:30', '09:00', 'Tema Grund'),
  pass('Torsdag', '08:30', '09:00', 'Tema Rosa'),
  pass('Torsdag', '08:30', '09:45', 'Tema Oliv', 'Tobias'),
  pass('Fredag', '12:30', '15:45', 'Tema', ''),
  pass('Fredag', '09:45', '11:45', 'Tema Oliv', 'Kalle'),
  pass('Lördag', '10:00', '11:00', 'Tema Grund'),
];

describe('temaTarget', () => {
  it.each([
    ['Tema Grund', 'Grund'],
    ['tema  OLIV', 'Oliv'],
    ['Tema', 'all'],
    ['Tema: självständigt arbete', 'all'],
    ['Tema Introduktion', 'all'],
    ['Ma 1', null],
    ['Temakväll', null],
  ])('%s → %s', (title, expected) => {
    expect(temaTarget(title, CLASSES)).toBe(expected);
  });
});

describe('lessonsFromArchive', () => {
  let n = 0;
  const newId = () => `ny${++n}`;
  const lessons = lessonsFromArchive(ARCHIVE, CLASSES, [], newId);
  const at = (day: string, start: string, end: string) => lessons.find(l => l.day === day && l.start === start && l.end === end);

  it('gör en lektion per tid, med alla klasser när alla har tema', () => {
    expect(at('Måndag', '08:30', '09:45')?.absentClasses).toBeUndefined();
    expect(lessons).toHaveLength(5);
  });

  it('markerar klasser som saknas vid en tid', () => {
    expect(at('Torsdag', '08:30', '09:00')?.absentClasses).toEqual(['Oliv']);
    expect(at('Torsdag', '08:30', '09:45')?.absentClasses).toEqual(['Grund', 'Rosa']);
    expect(at('Fredag', '09:45', '11:45')?.absentClasses).toEqual(['Grund', 'Rosa']);
  });

  it('låter ett tema utan klass gälla alla klasser, och hoppar över helgen', () => {
    expect(at('Fredag', '12:30', '15:45')?.absentClasses).toBeUndefined();
    expect(lessons.some(l => (l.day as string) === 'Lördag')).toBe(false);
  });

  it('använder inte arkivets lärare på temapassen', () => {
    expect(at('Måndag', '08:30', '09:45')).toMatchObject({ teamId: null, classTeachers: {} });
  });

  it('behåller grupp och lärare för en lektion som finns kvar vid samma tid', () => {
    const planned = { ...assignTeam(at('Måndag', '08:30', '09:45')!, CLASSES, 'g1'), classTeachers: { Grund: 't-victor' } };
    const again = lessonsFromArchive(ARCHIVE, CLASSES, [planned], newId);
    expect(again.find(l => l.id === planned.id)).toMatchObject({ teamId: 'g1', classTeachers: { Grund: 't-victor' } });
  });

  it('släpper grupp och lärare för en klass som inte längre har lektionen', () => {
    const planned = {
      ...at('Torsdag', '08:30', '09:45')!,
      absentClasses: undefined,
      split: true,
      classTeams: { Grund: 'g1', Oliv: 'g2', Rosa: 'g1' },
      classTeachers: { Grund: 't-anna', Oliv: 't-tobias' },
    };
    const again = lessonsFromArchive(ARCHIVE, CLASSES, [planned], newId).find(l => l.id === planned.id)!;
    expect(again).toMatchObject({ classTeams: { Oliv: 'g2' }, classTeachers: { Oliv: 't-tobias' }, absentClasses: ['Grund', 'Rosa'] });
  });
});

describe('fasta timmar', () => {
  it('räknar allt som inte är tema, utan "Alla", per labblärare', () => {
    const fixed = fixedHoursByTeacher(ARCHIVE, LAB_SEED.teachers, CLASSES);
    expect(fixed.get('t-anton')).toEqual({ total: 90 + 60 + 60, parts: [{ label: 'Matte', minutes: 210 }] });
    expect(fixed.get('t-armine')?.total).toBe(90);
    expect(fixed.get('t-tamara')?.parts).toEqual([{ label: 'Studieverkstad', minutes: 90 }]);
    // Tobias har bara tema, och APT/AK-möte står på "Alla".
    expect(fixed.has('t-tobias')).toBe(false);
  });

  it('gör läraren upptagen under de fasta passen', () => {
    const busy = busyFromArchive(ARCHIVE, LAB_SEED.teachers, CLASSES);
    expect(busy.get('t-anton')?.map(b => `${b.day} ${b.start}`)).toEqual(['Tisdag 10:15', 'Tisdag 14:45', 'Onsdag 14:45']);
  });

  it('hittar namn i arkivet som inte finns i labbet', () => {
    expect(unknownTeacherNames(ARCHIVE, LAB_SEED.teachers)).toEqual(['Kalle']);
  });
});

describe('labbet med ett arkiv', () => {
  const state: LabState = {
    ...LAB_SEED,
    teams: [{ id: 'ma', name: 'Matte', color: '#bae6fd', memberIds: ['t-anton', 't-armine', 't-anna'] }],
  };

  it('räknar inte en lärare med en fast lektion samtidigt som tillgänglig', () => {
    // Tisdag 10:15–11:45 krockar med Ma 1 och Ma Grund.
    const lesson = assignTeam({ ...LAB_SEED.template[0], id: 'x', day: 'Tisdag', start: '10:00', end: '11:00' }, CLASSES, 'ma');
    const busy = busyFromArchive(ARCHIVE, state.teachers, CLASSES);
    const short = labWarnings(state, [lesson], busy).find(w => w.kind === 'shortTeam');
    expect(short?.detail).toContain('1 tillgängliga lärare till 3 klasser');
    const withTeacher = { ...lesson, classTeachers: { Grund: 't-anton' } };
    expect(labWarnings(state, [withTeacher], busy).find(w => w.kind === 'busy')?.detail).toBe('Anton har Ma 1 samtidigt.');
  });

  it('delar tiden på klasserna som har lektionen', () => {
    // Bara Oliv har tema: hela lektionen går till den gruppen.
    const lesson = assignTeam({ ...LAB_SEED.template[0], id: 'y', absentClasses: ['Grund', 'Rosa'] }, CLASSES, 'ma', 'Oliv');
    const shares = teacherShareMinutes(state, [lesson]);
    expect(shares.get('t-anna')).toBe(25);
  });
});
