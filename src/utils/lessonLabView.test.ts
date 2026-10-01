import { describe, expect, it } from 'vitest';
import { LAB_SEED } from '@/config/lessonLabSeed';
import type { LabDay, LabLesson, LabState } from '@/types/lessonLab';
import { BusyMap, labWarnings } from '@/utils/lessonLab';
import {
  canTeachLesson,
  classGroups,
  lessonStaffing,
  placeLessons,
  planStatus,
  staffingFixes,
  staffingLevel,
  timelineFor,
} from '@/utils/lessonLabView';

const lesson = (id: string, overrides: Partial<LabLesson> = {}): LabLesson => ({
  id,
  day: 'Måndag',
  start: '08:30',
  end: '09:45',
  title: '',
  areaId: null,
  teamId: null,
  split: false,
  classTeams: {},
  classTeachers: {},
  ...overrides,
});

const days = (...list: LabDay[]) => list;

/** Ett torsdagslag med tre lärare, varav Anna inte kan på torsdagar. */
const state = (template: LabLesson[]): LabState => ({
  ...LAB_SEED,
  teachers: [
    { id: 't-tobias', name: 'Tobias', days: days('Måndag', 'Torsdag'), resource: false },
    { id: 't-victor', name: 'Victor', days: days('Torsdag'), resource: false },
    { id: 't-anna', name: 'Anna', days: days('Måndag'), resource: false },
    { id: 't-camilla', name: 'Camilla', days: days('Torsdag'), resource: false },
    { id: 't-armine', name: 'Armine', days: days('Torsdag'), resource: false },
    { id: 't-tamara', name: 'Tamara', days: days('Torsdag'), resource: true },
  ],
  teams: [
    { id: 'g4', number: 4, name: 'Arbetsgrupp', color: '#a7f3d0', memberIds: ['t-tobias', 't-victor', 't-anna'] },
    { id: 'g1', number: 1, name: 'Historia', color: '#d9f99d', memberIds: ['t-tobias', 't-anna'] },
  ],
  template,
});

describe('timelineFor', () => {
  it('rundar till halvtimmar och hittar lunchen', () => {
    const t = timelineFor([
      lesson('a', { start: '08:30', end: '09:45' }),
      lesson('b', { start: '09:45', end: '11:45' }),
      lesson('c', { start: '12:30', end: '14:30' }),
    ]);
    expect(t.start).toBe(8 * 60 + 30);
    expect(t.end).toBe(14 * 60 + 30);
    expect(t.lunch).toEqual({ start: 11 * 60 + 45, end: 12 * 60 + 30 });
    expect(t.hours).toEqual([9, 10, 11, 12, 13, 14].map(h => h * 60));
  });

  it('har en standardaxel utan lektioner och ingen lunch utan eftermiddag', () => {
    expect(timelineFor([]).start).toBe(8 * 60);
    expect(timelineFor([lesson('a')]).lunch).toBeNull();
  });
});

describe('placeLessons', () => {
  it('lägger krockande lektioner bredvid varandra', () => {
    const placed = placeLessons([
      lesson('a', { start: '08:30', end: '10:00' }),
      lesson('b', { start: '09:00', end: '09:45' }),
      lesson('c', { start: '10:00', end: '11:00' }),
    ], { start: 8 * 60 + 30 });
    const byId = Object.fromEntries(placed.map(p => [p.lesson.id, p]));
    expect(byId.a).toMatchObject({ offset: 0, minutes: 90, column: 0, columns: 2 });
    expect(byId.b).toMatchObject({ offset: 30, column: 1, columns: 2 });
    expect(byId.c).toMatchObject({ offset: 90, column: 0, columns: 1 });
  });
});

describe('bemanning', () => {
  const thursday = lesson('r1', { day: 'Torsdag', teamId: 'g4' });

  it('räknar lagets lärare som kan dagen', () => {
    const [s] = lessonStaffing(state([thursday]), thursday);
    expect(s).toEqual({ teamId: 'g4', classes: LAB_SEED.classes, availableIds: ['t-tobias', 't-victor'] });
    expect(staffingLevel(s)).toBe('short');
  });

  it('räknar bort den som har ett fast pass samtidigt', () => {
    const busy: BusyMap = new Map([['t-victor', [{ day: 'Torsdag', start: '08:00', end: '09:00', title: 'Matte' }]]]);
    expect(lessonStaffing(state([thursday]), thursday, busy)[0].availableIds).toEqual(['t-tobias']);
    expect(canTeachLesson(state([thursday]), thursday, 't-victor', busy)).toBe(false);
    expect(canTeachLesson(state([thursday]), thursday, 't-tobias', busy)).toBe(true);
  });

  it('skiljer på precis lagom och gott om', () => {
    expect(staffingLevel({ teamId: 'x', classes: ['A', 'B'], availableIds: ['1', '2'] })).toBe('tight');
    expect(staffingLevel({ teamId: 'x', classes: ['A'], availableIds: ['1', '2'] })).toBe('ok');
  });
});

describe('classGroups', () => {
  it('slår ihop grannar med samma lag och håller frånvarande klasser för sig', () => {
    const split = lesson('m1', { split: true, classTeams: { Grund: 'g4', Oliv: 'g1', Rosa: 'g1' } });
    expect(classGroups(split, LAB_SEED.classes)).toEqual([
      { teamId: 'g4', classes: ['Grund'], absent: false },
      { teamId: 'g1', classes: ['Oliv', 'Rosa'], absent: false },
    ]);
    const partial = lesson('p', { split: true, classTeams: { Grund: 'g1' }, absentClasses: ['Oliv', 'Rosa'] });
    expect(classGroups(partial, LAB_SEED.classes)).toEqual([
      { teamId: 'g1', classes: ['Grund'], absent: false },
      { teamId: null, classes: ['Oliv', 'Rosa'], absent: true },
    ]);
  });
});

describe('planStatus och staffingFixes', () => {
  const lessons = [
    lesson('r1', { day: 'Torsdag', teamId: 'g4' }),
    lesson('r2', { day: 'Torsdag', start: '10:00', end: '11:30', teamId: 'g4' }),
    lesson('m1', { teamId: 'g1', split: true, classTeams: { Grund: 'g1', Oliv: 'g1', Rosa: null } }),
    lesson('m2', { start: '10:00', end: '11:30' }),
  ];
  const s = state(lessons);

  it('räknar lektioner med lag, varningar och pass utan marginal', () => {
    const status = planStatus(s, lessons, labWarnings(s, lessons));
    expect(status.lessonCount).toBe(4);
    expect(status.withTeam).toBe(2);
    expect(status.warnings.map(w => w.lessonId)).toEqual(['r1', 'r2']);
    expect(status.errors).toEqual([]);
    // Historia har två lärare till två klasser på måndag.
    expect(status.tight.map(l => l.id)).toEqual(['m1']);
  });

  it('föreslår den som kan och har minst tid, aldrig en resurs', () => {
    const totals = new Map([['t-camilla', 300], ['t-armine', 120]]);
    expect(staffingFixes(s, lessons, totals)).toEqual([
      { teamId: 'g4', day: 'Torsdag', lessonIds: ['r1', 'r2'], teacherId: 't-armine' },
    ]);
  });
});
