import { describe, expect, it } from 'vitest';
import { LAB_SEED } from '@/config/lessonLabSeed';
import type { LabLesson, LabState } from '@/types/lessonLab';
import {
  assignTeam,
  classAreaMinutes,
  classTeamId,
  formatHours,
  mergeLesson,
  reassignTeam,
  splitLesson,
  teacherShareMinutes,
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
  split: false,
  classTeams: {},
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
    const options = teacherOptions(state, state.template[0], 'Grund');
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

describe('arbetsgrupper per klass', () => {
  const classes = ['Grund', 'Oliv', 'Rosa'];

  it('ger hela lektionen en grupp, och tar bort den igen', () => {
    const assigned = assignTeam(lesson('l'), classes, 'g1');
    expect(classes.map(c => classTeamId(assigned, c))).toEqual(['g1', 'g1', 'g1']);
    expect(assignTeam(assigned, classes, null).teamId).toBeNull();
  });

  it('delar lektionen när en klass får en annan grupp', () => {
    const next = assignTeam(assignTeam(lesson('l'), classes, 'g1'), classes, 'g2', 'Oliv');
    expect(next.split).toBe(true);
    expect(classes.map(c => classTeamId(next, c))).toEqual(['g1', 'g2', 'g1']);
  });

  it('blir hel igen när alla klasser hamnar i samma grupp', () => {
    let next = assignTeam(lesson('l'), classes, 'g1', 'Grund');
    next = assignTeam(next, classes, 'g1', 'Oliv');
    expect(next.split).toBe(true);
    next = assignTeam(next, classes, 'g1', 'Rosa');
    expect(next).toMatchObject({ split: false, teamId: 'g1', classTeams: {} });
  });

  it('förblir delad när alla klasser saknar grupp', () => {
    const next = assignTeam(splitLesson(lesson('l'), classes), classes, null, 'Grund');
    expect(next.split).toBe(true);
  });

  it('slår ihop till gemensam grupp, eller ingen när de skiljer sig', () => {
    const same = splitLesson(lesson('l', { teamId: 'g1' }), classes);
    expect(mergeLesson(same, classes).teamId).toBe('g1');
    const mixed = assignTeam(same, classes, 'g2', 'Rosa');
    expect(mergeLesson(mixed, classes)).toMatchObject({ split: false, teamId: null });
  });

  it('räknar tillgängliga lärare mot klasserna gruppen äger', () => {
    // Två tillgängliga på måndag räcker för två klasser men inte för tre.
    const base = withTeam([], ['t-tobias', 't-victor', 't-anton']);
    const two = assignTeam(assignTeam(lesson('l'), classes, 'g-skriv'), classes, null, 'Rosa');
    const whole = assignTeam(lesson('m', { start: '10:00', end: '11:00' }), classes, 'g-skriv');
    const kinds = labWarnings({ ...base, template: [two, whole] }, [two, whole])
      .filter(w => w.kind === 'shortTeam').map(w => w.lessonId);
    expect(kinds).toEqual(['m']);
  });

  it('fyller varje klass från sin egen grupp', () => {
    const state: LabState = {
      ...LAB_SEED,
      teams: [
        { id: 'g1', name: 'Ett', color: '#fde68a', memberIds: ['t-tobias'] },
        { id: 'g2', name: 'Två', color: '#bae6fd', memberIds: ['t-camilla', 't-victor'] },
      ],
    };
    const split = assignTeam(assignTeam(lesson('l'), classes, 'g2'), classes, 'g1', 'Grund');
    const filled = fillFromTeam(state, [split], 'l')[0];
    expect(filled.classTeachers).toEqual({ Grund: 't-tobias', Oliv: 't-camilla', Rosa: 't-victor' });
  });

  it('flyttar bara klasserna gruppen äger', () => {
    const split = assignTeam(assignTeam(lesson('l'), classes, 'g1'), classes, 'g2', 'Rosa');
    const moved = reassignTeam(split, classes, 'g1', 'g3');
    expect(classes.map(c => classTeamId(moved, c))).toEqual(['g3', 'g3', 'g2']);
    const cleared = reassignTeam(split, classes, 'g2', null);
    expect(classes.map(c => classTeamId(cleared, c))).toEqual(['g1', 'g1', null]);
    const whole = reassignTeam(assignTeam(lesson('m'), classes, 'g1'), classes, 'g1', 'g2');
    expect(whole).toMatchObject({ split: false, teamId: 'g2' });
  });

  it('tvättar bort grupper per klass i en hel lektion', () => {
    const parsed = parseLabState({
      ...LAB_SEED,
      template: [lesson('l', { split: false, classTeams: { Grund: 'x' } })],
    })!;
    expect(parsed.template[0].classTeams).toEqual({});
  });
});

describe('teacherShareMinutes', () => {
  const classes = ['Grund', 'Oliv', 'Rosa'];
  const state: LabState = {
    ...LAB_SEED,
    teams: [
      { id: 'två', name: 'Två', color: '#fde68a', memberIds: ['t-tobias', 't-victor'] },
      { id: 'en', name: 'En', color: '#bae6fd', memberIds: ['t-anna'] },
      { id: 'tom', name: 'Tom', color: '#bae6fd', memberIds: [] },
    ],
  };

  it('delar en lektion lika mellan gruppens medlemmar', () => {
    const lessons = [assignTeam(lesson('l', { start: '12:30', end: '14:30' }), classes, 'två')];
    const shares = teacherShareMinutes(state, lessons);
    expect(shares.get('t-tobias')).toBe(60);
    expect(shares.get('t-victor')).toBe(60);
  });

  it('ger en grupp sin del av en delad lektion', () => {
    // 90 min: en klass till "en", två klasser till "två".
    const split = assignTeam(assignTeam(lesson('l', { start: '10:00', end: '11:30' }), classes, 'två'), classes, 'en', 'Grund');
    const shares = teacherShareMinutes(state, [split]);
    expect(shares.get('t-anna')).toBe(30);
    expect(shares.get('t-tobias')).toBe(30);
  });

  it('räknar inte lektioner utan grupp eller grupper utan medlemmar', () => {
    const lessons = [lesson('a'), assignTeam(lesson('b'), classes, 'tom')];
    expect(teacherShareMinutes(state, lessons).size).toBe(0);
  });

  it('skriver timmar med en decimal', () => {
    expect([60, 90, 40, 0].map(formatHours)).toEqual(['1 h', '1,5 h', '0,7 h', '0 h']);
  });
});
