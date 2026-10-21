import { describe, expect, it } from 'vitest';
import type { PlannerActivity } from '@/types/schedule';
import type { LabLesson, LabState } from '@/types/lessonLab';
import {
  activitiesForTeacher,
  activitiesForTeam,
  baseScheduleEndMinutes,
  exportInputsFor,
  exportTargets,
  lessonsWithoutPass,
  pagesFor,
  teamLabel,
} from '@/utils/labScheduleExport';
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

const lesson = (id: string, day: LabLesson['day'], start: string, end: string, extra: Partial<LabLesson> = {}): LabLesson => ({
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
  ...extra,
});

const ARCHIVE: PlannerActivity[] = [
  ...CLASSES.map(c => pass('Måndag', '08:30', '09:45', `Tema ${c}`)),
  pass('Måndag', '10:00', '10:15', 'Rast'),
  pass('Måndag', '10:15', '11:30', 'Tema Grund'),
  pass('Måndag', '10:15', '11:30', 'Tema Oliv'),
  pass('Måndag', '11:30', '12:15', 'Lunch'),
  pass('Måndag', '14:00', '14:15', 'Paus'),
  pass('Tisdag', '08:00', '08:15', 'Rast'),
  pass('Tisdag', '08:30', '10:00', 'Tema'),
  pass('Tisdag', '12:00', '12:45', 'Lunch'),
  pass('Onsdag', '09:00', '10:00', 'Ma 1', 'björn '),
  pass('Onsdag', '10:15', '11:00', 'Mentorstid', 'Alla, Anna'),
  pass('Onsdag', '12:00', '12:45', 'Lunch'),
  pass('Torsdag', '08:30', '09:30', 'Tema Grund'),
  pass('Torsdag', '13:00', '14:00', 'APT', 'Alla'),
  pass('Torsdag', '15:00', '16:30', 'Studieverkstad', 'Cecilia'),
  pass('Lördag', '10:00', '18:00', 'Tema Grund'),
];

const STATE: LabState = {
  version: 1,
  classes: CLASSES,
  teachers: [
    { id: 't1', name: 'Anna', days: [], resource: false },
    { id: 't2', name: 'Björn', days: [], resource: false },
    { id: 't3', name: 'Cecilia', days: [], resource: true },
    { id: 't4', name: 'David', days: [], resource: false },
    { id: 't5', name: 'Erik', days: [], resource: false },
  ],
  teams: [
    { id: 'lag2', number: 2, name: 'Arbetslag 2', color: '#000', memberIds: ['t1', 't2'] },
    { id: 'lag1', number: 1, name: 'Skrivande', color: '#000', memberIds: ['t1'] },
    { id: 'lag3', number: 3, name: 'NO', color: '#000', memberIds: ['t5'] },
  ],
  areas: [],
  template: [
    lesson('l1', 'Måndag', '08:30', '09:45', { teamId: 'lag1' }),
    lesson('l2', 'Måndag', '10:15', '11:30', {
      split: true,
      classTeams: { Grund: 'lag1', Oliv: 'lag2' },
      absentClasses: ['Rosa'],
    }),
    lesson('l3', 'Tisdag', '08:30', '10:00', { split: true, classTeams: { Grund: 'lag2', Oliv: 'lag2', Rosa: 'lag1' } }),
    lesson('l4', 'Torsdag', '08:30', '09:30', { absentClasses: ['Oliv', 'Rosa'] }),
    // Finns inte i arkivet längre.
    lesson('l5', 'Fredag', '13:00', '14:00', { teamId: 'lag2' }),
  ],
  weeks: [],
};

const describePasses = (activities: PlannerActivity[]) =>
  activities.map(a => `${a.day.slice(0, 3)} ${a.startTime} ${a.title}`);

describe('teamLabel', () => {
  it('skriver lagets siffra framför ett eget namn', () => {
    expect(teamLabel(STATE.teams[1])).toBe('Lag 1 Skrivande');
  });

  it('låter standardnamnet stå som det är', () => {
    expect(teamLabel(STATE.teams[0])).toBe('Arbetslag 2');
  });
});

describe('activitiesForTeam', () => {
  it('tar lagets klasser i delade lektioner, tema utan klass och lunch och rast runt passen', () => {
    expect(describePasses(activitiesForTeam(STATE, ARCHIVE, 'lag1'))).toEqual([
      'Mån 08:30 Tema Grund',
      'Mån 08:30 Tema Oliv',
      'Mån 08:30 Tema Rosa',
      // Mellan två av lagets pass.
      'Mån 10:00 Rast',
      'Mån 10:15 Tema Grund',
      'Mån 11:30 Lunch',
      // Lagets Rosa i den delade lektionen ger hela temapasset utan klass.
      'Tis 08:30 Tema',
      'Tis 12:00 Lunch',
    ]);
  });

  it('hoppar över rasten när laget inte har något pass före den', () => {
    expect(describePasses(activitiesForTeam(STATE, ARCHIVE, 'lag2'))).toEqual([
      'Mån 10:15 Tema Oliv',
      'Mån 11:30 Lunch',
      'Tis 08:30 Tema',
      'Tis 12:00 Lunch',
    ]);
  });

  it('ger inga pass, inte heller lunch, till ett lag utan lektioner', () => {
    expect(activitiesForTeam(STATE, ARCHIVE, 'lag3')).toEqual([]);
  });

  it('tar inte med fasta pass eller "Alla"-pass', () => {
    const titles = activitiesForTeam(STATE, ARCHIVE, 'lag2').map(a => a.title);
    expect(titles).not.toContain('APT');
    expect(titles).not.toContain('Mentorstid');
  });
});

describe('activitiesForTeacher', () => {
  it('slår ihop lärarens lag och tar med "Alla"-pass, utan dubbletter', () => {
    expect(describePasses(activitiesForTeacher(STATE, ARCHIVE, 't1'))).toEqual([
      'Mån 08:30 Tema Grund',
      'Mån 08:30 Tema Oliv',
      'Mån 08:30 Tema Rosa',
      'Mån 10:00 Rast',
      'Mån 10:15 Tema Grund',
      'Mån 10:15 Tema Oliv',
      'Mån 11:30 Lunch',
      'Tis 08:30 Tema',
      'Tis 12:00 Lunch',
      'Ons 10:15 Mentorstid',
      // Mentorstiden ger Anna ett pass på onsdagen, så lunchen kommer med.
      'Ons 12:00 Lunch',
      'Tor 13:00 APT',
    ]);
  });

  it('matchar lärarnamnet oavsett versaler och mellanslag', () => {
    const passes = describePasses(activitiesForTeacher(STATE, ARCHIVE, 't2'));
    expect(passes).toContain('Ons 09:00 Ma 1');
    expect(passes).toContain('Ons 10:15 Mentorstid');
    expect(passes).not.toContain('Tor 15:00 Studieverkstad');
  });

  it('ger inga pass till en lärare utan lag', () => {
    expect(activitiesForTeacher(STATE, ARCHIVE, 't4')).toEqual([]);
  });
});

describe('exportTargets', () => {
  const targets = exportTargets(STATE, ARCHIVE);

  it('listar lagen i sifferordning', () => {
    expect(targets.teams.map(t => [t.label, t.passCount])).toEqual([
      ['Lag 1 Skrivande', 5],
      ['Arbetslag 2', 2],
      ['Lag 3 NO', 0],
    ]);
  });

  it('listar bara lärare som är med i ett lag, i bokstavsordning', () => {
    expect(targets.teachers.map(t => t.label)).toEqual(['Anna', 'Björn', 'Erik']);
  });

  it('ger en lärare i ett lag utan lektioner "Alla"-passen', () => {
    // APT och mentorstid. Lunchen räknas inte som pass.
    expect(targets.teachers.find(t => t.label === 'Erik')?.passCount).toBe(2);
  });
});

describe('pagesFor', () => {
  it('ger en sida per lag och hoppar över lag utan pass', () => {
    const result = pagesFor(STATE, ARCHIVE, { kind: 'allTeams' });
    expect(result.pages.map(p => p.label)).toEqual(['Lag 1 Skrivande', 'Arbetslag 2']);
    expect(result.skipped).toEqual(['Lag 3 NO']);
  });

  it('ger en sida per lärare och hoppar över lärare utan pass', () => {
    const withoutAll = ARCHIVE.filter(a => !a.teacher?.startsWith('Alla'));
    const result = pagesFor(STATE, withoutAll, { kind: 'allTeachers' });
    expect(result.label).toBe('Alla lärare');
    expect(result.pages.map(p => p.label)).toEqual(['Anna', 'Björn']);
    expect(result.skipped).toEqual(['Erik']);
  });

  it('ger en sida för ett lag', () => {
    const result = pagesFor(STATE, ARCHIVE, { kind: 'team', id: 'lag2' });
    expect(result.pages).toHaveLength(1);
    expect(result.label).toBe('Arbetslag 2');
  });
});

describe('lessonsWithoutPass', () => {
  it('räknar lektioner med lag som saknar temapass i arkivet', () => {
    expect(lessonsWithoutPass(STATE, ARCHIVE)).toBe(1);
  });
});

describe('exportInputsFor', () => {
  it('ritar varje sida till basschemats sista sluttid och sätter rubriken', () => {
    const { pages } = pagesFor(STATE, ARCHIVE, { kind: 'allTeams' });
    const inputs = exportInputsFor(pages, {
      archiveName: 'Ht26',
      activities: ARCHIVE,
      resolveColor: (_title, fallback) => fallback,
      resolveRoom: (_title, room) => room ?? '',
      pageMode: 'a4',
    });
    expect(inputs.map(i => i.archiveName)).toEqual(['Ht26 – Lag 1 Skrivande', 'Ht26 – Arbetslag 2']);
    // Torsdagens studieverkstad slutar sist på vardagarna. Lördagen ritas inte.
    expect(inputs.every(i => i.extraEndMinutes === timeToMinutes('16:30'))).toBe(true);
    expect(inputs[1].schedule.map(e => e.title)).toEqual(['Tema Oliv', 'Lunch', 'Tema', 'Lunch']);
  });

  it('ger ingen sluttid för ett tomt arkiv', () => {
    expect(baseScheduleEndMinutes([])).toBeUndefined();
  });
});
