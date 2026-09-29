import { describe, expect, it } from 'vitest';
import { LAB_SEED } from '@/config/lessonLabSeed';
import type { LabLesson, LabState } from '@/types/lessonLab';
import {
  classAreaMinutes,
  fillFromTeam,
  isBeforeLunch,
  labWarnings,
  parseLabState,
  rotateClasses,
  sanitizeLabState,
  teacherOptions,
  teacherSummaries,
  teamSummaries,
  weekFromTemplate,
  withLessons,
} from '@/utils/lessonLab';

const lesson = (id: string, overrides: Partial<LabLesson> = {}): LabLesson => ({
  id,
  day: 'Måndag',
  start: '08:30',
  end: '09:45',
  title: '',
  areaId: null,
  teamId: null,
  classTeachers: {},
  ...overrides,
});

/** Tavlan med en arbetsgrupp för skrivandet på måndagar. */
const withTeam = (lessons: LabLesson[], memberIds = ['t-tobias', 't-victor', 't-camilla']): LabState => ({
  ...LAB_SEED,
  teams: [{ id: 'g-skriv', name: 'Skrivlaget', color: '#fde68a', memberIds }],
  template: lessons,
});

describe('tavlan', () => {
  it('har elva lektioner: sju före lunch och fyra efter', () => {
    expect(LAB_SEED.template).toHaveLength(11);
    expect(LAB_SEED.template.filter(isBeforeLunch)).toHaveLength(7);
  });

  it('har minst tre tillgängliga lärare varje dag, utan resursen', () => {
    for (const day of ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'] as const) {
      const available = LAB_SEED.teachers.filter(t => !t.resource && t.days.includes(day));
      expect(available.length, day).toBeGreaterThanOrEqual(3);
    }
  });

  it('klarar en egen tvätt oförändrad', () => {
    expect(parseLabState(JSON.parse(JSON.stringify(LAB_SEED)))).toEqual(LAB_SEED);
  });
});

describe('parseLabState', () => {
  it('underkänner sådant som inte är ett labbläge', () => {
    expect(parseLabState(null)).toBeNull();
    expect(parseLabState({ version: 2 })).toBeNull();
    expect(parseLabState({ version: 1, classes: [] })).toBeNull();
    expect(sanitizeLabState('trasigt')).toBe(LAB_SEED);
  });

  it('nollar referenser till sådant som inte finns', () => {
    const raw = {
      ...LAB_SEED,
      teams: [{ id: 'g', name: 'Lag', color: '#fde68a', memberIds: ['t-tobias', 't-borta', 't-tamara'] }],
      template: [lesson('l', { teamId: 'g-borta', areaId: 'a-borta', classTeachers: { Grund: 't-borta', Oliv: 't-anna', Blå: 't-anna' } })],
    };
    const parsed = parseLabState(raw)!;
    // Tamara är resurs och kan inte sitta i en arbetsgrupp.
    expect(parsed.teams[0].memberIds).toEqual(['t-tobias']);
    expect(parsed.template[0]).toMatchObject({ teamId: null, areaId: null, classTeachers: { Oliv: 't-anna' } });
  });

  it('släpper lektioner med ogiltiga tider', () => {
    const parsed = parseLabState({
      ...LAB_SEED,
      template: [lesson('a', { start: '10:00', end: '09:00' }), lesson('b', { start: '8:30' }), lesson('c')],
    })!;
    expect(parsed.template.map(l => l.id)).toEqual(['c']);
  });
});

describe('labWarnings', () => {
  it('flaggar en lärare som inte är tillgänglig den dagen', () => {
    // Anna är inte tillgänglig på måndagar enligt tavlan.
    const state = withTeam([lesson('l', { classTeachers: { Grund: 't-anna' } })]);
    const kinds = labWarnings(state, state.template).map(w => w.kind);
    expect(kinds).toContain('unavailable');
  });

  it('flaggar dubbelbokning i samma lektion och i överlappande lektioner', () => {
    const state = withTeam([
      lesson('a', { classTeachers: { Grund: 't-tobias', Oliv: 't-tobias' } }),
      lesson('b', { start: '09:00', end: '10:00', classTeachers: { Rosa: 't-victor' } }),
      lesson('c', { start: '08:30', end: '09:45', classTeachers: { Rosa: 't-victor' } }),
    ]);
    const doubles = labWarnings(state, state.template).filter(w => w.kind === 'double');
    expect(doubles.map(w => `${w.lessonId}:${w.teacherId}`).sort()).toEqual(['a:t-tobias', 'b:t-victor', 'c:t-victor']);
  });

  it('flaggar inte lektioner som bara nuddar varandra', () => {
    const state = withTeam([
      lesson('a', { classTeachers: { Grund: 't-tobias' } }),
      lesson('b', { start: '09:45', end: '11:00', classTeachers: { Grund: 't-tobias' } }),
    ]);
    expect(labWarnings(state, state.template).some(w => w.kind === 'double')).toBe(false);
  });

  it('flaggar en arbetsgrupp med för få tillgängliga lärare', () => {
    // Anton är inte tillgänglig på måndagar: två av tre kvar.
    const state = withTeam([lesson('l', { teamId: 'g-skriv' })], ['t-tobias', 't-victor', 't-anton']);
    const short = labWarnings(state, state.template).find(w => w.kind === 'shortTeam');
    expect(short?.message).toContain('2 tillgängliga lärare till 3 klasser');
  });

  it('flaggar en lärare utanför arbetsgruppen och sorterar felen först', () => {
    const state = withTeam([
      lesson('l', { teamId: 'g-skriv', classTeachers: { Grund: 't-armine', Oliv: 't-anna' } }),
    ]);
    const warnings = labWarnings(state, state.template);
    expect(warnings[0].severity).toBe('error');
    expect(warnings.filter(w => w.kind === 'outsideTeam')).toHaveLength(2);
  });
});

describe('fillFromTeam', () => {
  it('fyller tomma klasser med tillgängliga, lediga medlemmar', () => {
    const state = withTeam([
      lesson('l', { teamId: 'g-skriv', classTeachers: { Oliv: 't-victor' } }),
      // Tobias är upptagen samtidigt i en annan lektion.
      lesson('o', { classTeachers: { Grund: 't-tobias' } }),
    ]);
    const filled = fillFromTeam(state, state.template, 'l').find(l => l.id === 'l')!;
    expect(filled.classTeachers).toEqual({ Oliv: 't-victor', Grund: 't-camilla' });
  });

  it('gör ingenting utan arbetsgrupp', () => {
    const state = withTeam([lesson('l')]);
    expect(fillFromTeam(state, state.template, 'l')).toBe(state.template);
  });
});

describe('rotateClasses', () => {
  it('flyttar varje lärare ett steg och tar med tomma platser', () => {
    const rotated = rotateClasses(lesson('l', { classTeachers: { Grund: 'a', Oliv: 'b' } }), ['Grund', 'Oliv', 'Rosa']);
    expect(rotated.classTeachers).toEqual({ Grund: null, Oliv: 'a', Rosa: 'b' });
  });
});

describe('teacherOptions', () => {
  it('delar upp i arbetsgruppen, övriga och ej tillgängliga, utan resursen', () => {
    const state = withTeam([lesson('l', { teamId: 'g-skriv' })]);
    const options = teacherOptions(state, state.template[0]);
    expect(options.team.map(t => t.name)).toEqual(['Tobias', 'Victor', 'Camilla']);
    expect(options.others.map(t => t.name)).toEqual(['Armine']);
    expect(options.unavailable.map(t => t.name)).toEqual(['Anton', 'Anna']);
  });
});

describe('summeringar', () => {
  const state: LabState = {
    ...withTeam([
      lesson('a', { teamId: 'g-skriv', areaId: 'a-skriv', classTeachers: { Grund: 't-tobias', Oliv: 't-tobias' } }),
      lesson('b', { day: 'Tisdag', start: '12:30', end: '14:30', areaId: 'a-skriv', classTeachers: { Grund: 't-tobias' } }),
      lesson('c', { day: 'Onsdag', start: '10:00', end: '11:30' }),
    ]),
  };

  it('räknar en lektion en gång per lärare, och ansvaret via arbetsgruppen', () => {
    const tobias = teacherSummaries(state, state.template).find(s => s.teacher.id === 't-tobias')!;
    expect(tobias.minutes).toBe(75 + 120);
    expect(tobias.byArea).toEqual({ 'a-skriv': 195 });
    expect(tobias.ownedLessons).toBe(1);
    expect(teacherSummaries(state, state.template).some(s => s.teacher.resource)).toBe(false);
  });

  it('räknar minuter per klass och område, även utan lärare', () => {
    expect(classAreaMinutes(state, state.template).Rosa).toEqual({ 'a-skriv': 195, '': 90 });
  });

  it('räknar arbetsgruppens tillgängliga medlemmar per dag', () => {
    const [team] = teamSummaries(state, state.template);
    expect(team.availableByDay).toMatchObject({ Måndag: 3, Onsdag: 1, Fredag: 2 });
    expect(team.minutes).toBe(75);
  });
});

describe('veckor', () => {
  it('kopierar mallen utan att dela objekt med den', () => {
    const state = withTeam([lesson('a', { classTeachers: { Grund: 't-tobias' } })]);
    const week = weekFromTemplate(state, 'w1', 'v. 41');
    week.lessons[0].classTeachers.Grund = 't-victor';
    expect(state.template[0].classTeachers.Grund).toBe('t-tobias');
  });

  it('byter lektioner i rätt vy', () => {
    const base = withTeam([lesson('a')]);
    const state = { ...base, weeks: [weekFromTemplate(base, 'w1', 'v. 41')] };
    const changed = withLessons(state, 'w1', []);
    expect(changed.weeks[0].lessons).toEqual([]);
    expect(changed.template).toHaveLength(1);
  });
});
