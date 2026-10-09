import { describe, expect, it } from 'vitest';
import type { PlannerArchiveSummary } from '@/types/schedule';
import type { ThemeWheel } from '@/types/themeWheel';
import {
  buildTermStats,
  classShareSlices,
  columnForTitle,
  fillSuggestedArchives,
  foldSlices,
  formatHours,
  isClassLesson,
  lessonTeacherBreakdown,
  OTHER_COLOR,
  OTHER_SLICE_KEY,
  resizeTermWeeks,
  sanitizeSelection,
  StatsActivity,
  suggestArchiveForWeek,
  TEACHER_COLORS,
  teacherColorMap,
  teacherLessonMix,
  teacherMinutesForWeek,
  teacherShareSlices,
  termWeeksFromWheel,
  weekNumberFromName,
} from '@/utils/termPlanner';

const pass = (
  title: string,
  teacher: string,
  startTime: string,
  endTime: string,
  day = 'Måndag'
): StatsActivity => ({ title, teacher, startTime, endTime, day });

const archive = (id: string, name: string, overrides: Partial<PlannerArchiveSummary> = {}): PlannerArchiveSummary => ({
  id,
  name,
  ownerId: 'me',
  ownerUsername: 'me',
  isOwner: true,
  sharedWith: [],
  lock: null,
  updatedAt: '2026-09-01T00:00:00',
  ...overrides,
});

describe('columnForTitle', () => {
  it.each([
    ['Tema Oliv', 'oliv'],
    ['tema  rosa', 'rosa'],
    ['Tema Grund', 'grund'],
    ['Ma  Grund', 'maGrund'],
    ['Matte 1', 'ma1'],
    ['Ma2 (tillval)', 'ma2'],
    ['Studieverkstad', 'studieverkstad'],
    ['Onsdagsklubben', 'ovrigt'],
    ['', 'ovrigt'],
  ])('%s → %s', (title, column) => {
    expect(columnForTitle(title)).toBe(column);
  });
});

describe('teacherMinutesForWeek', () => {
  it('räknar per klass och lärare', () => {
    const result = teacherMinutesForWeek([
      pass('Tema Oliv', 'Anna', '08:30', '10:00'),
      pass('Tema Rosa', 'Björn', '08:30', '10:00'),
      pass('Ma 1', 'Anna', '10:00', '11:00', 'Tisdag'),
    ]);
    const anna = result.get('anna')!;
    expect(anna.minutes.byColumn.oliv).toBe(90);
    expect(anna.minutes.byColumn.ma1).toBe(60);
    expect(anna.minutes.total).toBe(150);
    expect(result.get('björn')!.minutes.byColumn.rosa).toBe(90);
  });

  it('ger ingen tid åt "alla", men åt namngivna i samma fält', () => {
    const result = teacherMinutesForWeek([
      pass('Onsdagsklubben', 'alla', '13:00', '14:00'),
      pass('Samling', 'Anna, Alla', '08:00', '08:30'),
    ]);
    expect(Array.from(result.keys())).toEqual(['anna']);
    expect(result.get('anna')!.minutes.byColumn.ovrigt).toBe(30);
  });

  it('räknar samtidiga pass en gång i totalen', () => {
    const result = teacherMinutesForWeek([
      pass('Tema Oliv', 'Anna', '08:00', '09:00'),
      pass('Tema Oliv', 'anna', '08:30', '09:30'),
      pass('Tema Rosa', 'Anna', '08:00', '09:00'),
    ]);
    const anna = result.get('anna')!;
    expect(anna.label).toBe('Anna');
    expect(anna.minutes.byColumn.oliv).toBe(90);
    expect(anna.minutes.byColumn.rosa).toBe(60);
    expect(anna.minutes.total).toBe(90);
  });

  it('hoppar över pass utan lärare och med trasiga tider', () => {
    const result = teacherMinutesForWeek([
      pass('Lunch', '', '11:30', '12:30'),
      pass('Tema Oliv', 'Anna', '10:00', '09:00'),
    ]);
    expect(result.get('anna')!.minutes.total).toBe(0);
    expect(result.size).toBe(1);
  });
});

describe('buildTermStats', () => {
  it('summerar veckorna per lärare och totalt', () => {
    const stats = buildTermStats([
      { index: 0, activities: [pass('Tema Oliv', 'Björn', '08:00', '10:00')] },
      { index: 2, activities: [pass('Tema Oliv', 'Björn', '08:00', '09:00'), pass('Ma 2', 'Anna', '08:00', '09:00')] },
    ]);

    expect(stats.rows.map(row => row.label)).toEqual(['Anna', 'Björn']);
    const björn = stats.rows[1];
    expect(björn.minutes.byColumn.oliv).toBe(180);
    expect(björn.weeks.map(week => [week.index, week.minutes.total])).toEqual([[0, 120], [2, 60]]);
    expect(stats.rows[0].weeks[0].minutes.total).toBe(0);
    expect(stats.totals.total).toBe(240);
    expect(stats.totals.byColumn.ma2).toBe(60);
  });
});

describe('formatHours', () => {
  it('skriver timmar med decimalkomma och noll som tomt', () => {
    expect(formatHours(0)).toBe('');
    expect(formatHours(90)).toBe('1,5');
    expect(formatHours(45)).toBe('0,75');
    expect(formatHours(600)).toBe('10');
  });
});

describe('weekNumberFromName', () => {
  it.each([
    ['v.35', 35],
    ['V35', 35],
    ['v. 4', 4],
    ['Vecka 40', 40],
    ['HT v.35 (ny)', 35],
    ['Allmän kurs', null],
    ['Rev 35', null],
    ['v.99', null],
  ])('%s → %s', (name, week) => {
    expect(weekNumberFromName(name)).toBe(week);
  });
});

describe('suggestArchiveForWeek', () => {
  it('föredrar eget arkiv och markerar flera träffar', () => {
    const archives = [
      archive('shared', 'v.35', { isOwner: false, updatedAt: '2026-09-10T00:00:00' }),
      archive('own', 'v35'),
      archive('other', 'v.36'),
    ];
    expect(suggestArchiveForWeek(35, archives)).toEqual({ archiveId: 'own', ambiguous: true });
    expect(suggestArchiveForWeek(36, archives)).toEqual({ archiveId: 'other', ambiguous: false });
    expect(suggestArchiveForWeek(37, archives)).toBeNull();
  });

  it('föreslår aldrig ett basschema', () => {
    const archives = [
      archive('bas', 'Bas v.35', { kind: 'base', updatedAt: '2026-09-20T00:00:00' }),
      archive('vecka', 'v.35', { kind: 'week' }),
      archive('bara-bas', 'Bas v.36', { kind: 'base' }),
    ];
    expect(suggestArchiveForWeek(35, archives)).toEqual({ archiveId: 'vecka', ambiguous: false });
    expect(suggestArchiveForWeek(36, archives)).toBeNull();
  });

  it('fyller bara tomma veckor som inte är lov', () => {
    const weeks = [
      { theme: '', holiday: false, archiveId: null },
      { theme: '', holiday: true, archiveId: null },
      { theme: '', holiday: false, archiveId: 'kept' },
    ];
    const archives = [archive('a', 'v.35'), archive('b', 'v.36'), archive('c', 'v.37')];
    expect(fillSuggestedArchives(weeks, [35, 36, 37], archives).map(week => week.archiveId))
      .toEqual(['a', null, 'kept']);
  });
});

describe('termWeeksFromWheel', () => {
  it('tar veckor och lov men inga teman', () => {
    const wheel: ThemeWheel = {
      id: 'w',
      name: 'HT',
      startWeek: 34,
      startYear: 2026,
      weekCount: 4,
      holidayWeeks: [2],
      blocks: [
        { instanceId: '1', title: 'Hav', color: '#fff', startWeek: 0, endWeek: 1 },
        { instanceId: '2', title: 'Delområde', color: '#fff', startWeek: 0, endWeek: 0, parentId: '1' },
        { instanceId: '3', title: 'Rymd', color: '#fff', startWeek: 1, endWeek: 3 },
      ],
    };
    expect(termWeeksFromWheel(wheel)).toEqual([
      { theme: '', holiday: false, archiveId: null },
      { theme: '', holiday: false, archiveId: null },
      { theme: '', holiday: true, archiveId: null },
      { theme: '', holiday: false, archiveId: null },
    ]);
  });
});

describe('resizeTermWeeks', () => {
  it('behåller veckor och fyller på tomma', () => {
    const weeks = [{ theme: '', holiday: false, archiveId: 'a' }];
    expect(resizeTermWeeks(weeks, 2)).toEqual([weeks[0], { theme: '', holiday: false, archiveId: null }]);
    expect(resizeTermWeeks(resizeTermWeeks(weeks, 2), 1)).toEqual(weeks);
  });
});

describe('teacherColorMap', () => {
  it('ger lärarna paletten i ordning och grått efter den åttonde', () => {
    const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const colors = teacherColorMap(keys);
    expect(colors.get('a')).toBe(TEACHER_COLORS[0]);
    expect(colors.get('h')).toBe(TEACHER_COLORS[7]);
    expect(colors.get('i')).toBe(OTHER_COLOR);
  });
});

describe('foldSlices', () => {
  const slice = (key: string, minutes: number) => ({ key, label: key, minutes, color: '#000' });

  it('lämnar få bitar orörda men sorterar och tar bort nollor', () => {
    expect(foldSlices([slice('a', 10), slice('b', 30), slice('c', 0)], 7).map(s => s.key)).toEqual(['b', 'a']);
  });

  it('slår ihop resten till Övriga', () => {
    const folded = foldSlices([slice('a', 50), slice('b', 40), slice('c', 30), slice('d', 20), slice('e', 10)], 3);
    expect(folded.map(s => [s.key, s.minutes])).toEqual([['a', 50], ['b', 40], [OTHER_SLICE_KEY, 60]]);
    expect(folded[2].label).toBe('Övriga (3)');
    expect(folded[2].color).toBe(OTHER_COLOR);
  });
});

describe('classShareSlices', () => {
  it('fördelar en klass på lärarna i lärarens färg', () => {
    const stats = buildTermStats([{
      index: 0,
      activities: [
        pass('Tema Oliv', 'Anna', '08:00', '10:00'),
        pass('Tema Oliv', 'Björn', '10:00', '11:00'),
        pass('Tema Rosa', 'Cecilia', '08:00', '09:00'),
      ],
    }]);
    const colors = teacherColorMap(stats.rows.map(row => row.key));
    expect(classShareSlices(stats, 'oliv', colors)).toEqual([
      { key: 'anna', label: 'Anna', minutes: 120, color: TEACHER_COLORS[0] },
      { key: 'björn', label: 'Björn', minutes: 60, color: TEACHER_COLORS[1] },
    ]);
  });

  it('slår ihop lärare utan egen färg', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const stats = buildTermStats([{
      index: 0,
      activities: names.map(name => pass('Tema Grund', name, '08:00', '09:00')),
    }]);
    const slices = classShareSlices(stats, 'grund', teacherColorMap(stats.rows.map(row => row.key)));
    expect(slices).toHaveLength(9);
    expect(slices[8]).toEqual({ key: OTHER_SLICE_KEY, label: 'Övriga lärare (2)', minutes: 120, color: OTHER_COLOR });
  });
});

describe('teacherLessonMix', () => {
  const colored = (title: string, teacher: string, start: string, end: string, color: string, day = 'Måndag') => ({
    ...pass(title, teacher, start, end, day), color,
  });

  it('delar lärarens tid per lektionstitel över veckorna', () => {
    const mix = teacherLessonMix([
      { activities: [colored('Tema Oliv', 'Anna', '08:00', '10:00', '#bef264'), colored('Ma 1', 'Anna', '10:00', '11:00', '#bae6fd')] },
      { activities: [colored('tema  oliv', 'Anna', '08:00', '09:00', '#bef264')] },
    ]);
    expect(mix).toEqual([{
      key: 'anna',
      label: 'Anna',
      total: 240,
      lessons: [
        { key: 'tema oliv', label: 'Tema Oliv', minutes: 180, color: '#bef264' },
        { key: 'ma 1', label: 'Ma 1', minutes: 60, color: '#bae6fd' },
      ],
    }]);
  });

  it('räknar samtidiga pass med samma titel en gång och hoppar över "alla"', () => {
    const mix = teacherLessonMix([{
      activities: [
        colored('Tema Rosa', 'Anna', '08:00', '09:00', '#fecdd3'),
        colored('Tema Rosa', 'Anna', '08:30', '09:30', '#fecdd3'),
        colored('Onsdagsklubben', 'alla', '13:00', '14:00', '#e9d5ff'),
      ],
    }]);
    expect(mix).toHaveLength(1);
    expect(mix[0].lessons).toEqual([{ key: 'tema rosa', label: 'Tema Rosa', minutes: 90, color: '#fecdd3' }]);
  });

  it('tar den vanligaste färgen och låter färgreglerna gå före', () => {
    const activities = [
      colored('Svenska', 'Anna', '08:00', '09:00', '#111111'),
      colored('Svenska', 'Anna', '09:00', '10:00', '#222222', 'Tisdag'),
      colored('Svenska', 'Anna', '09:00', '10:00', '#222222', 'Onsdag'),
    ];
    expect(teacherLessonMix([{ activities }])[0].lessons[0].color).toBe('#222222');
    const byRule = teacherLessonMix([{ activities }], title => (title === 'Svenska' ? '#ff0000' : '#000000'));
    expect(byRule[0].lessons[0].color).toBe('#ff0000');
  });
});

describe('lessonTeacherBreakdown', () => {
  it('vänder lärarnas lektioner till passens lärare', () => {
    const mixes = teacherLessonMix([{
      activities: [
        { ...pass('Ma 1', 'Anna', '08:00', '10:00'), color: '#a5f3fc' },
        { ...pass('Ma 1', 'Björn', '08:00', '09:00'), color: '#a5f3fc' },
        { ...pass('Onsdagsklubben', 'Björn', '13:00', '16:00'), color: '#fed7aa' },
      ],
    }]);
    expect(lessonTeacherBreakdown(mixes)).toEqual([
      {
        key: 'ma 1', label: 'Ma 1', color: '#a5f3fc', total: 180,
        teachers: [{ key: 'anna', label: 'Anna', minutes: 120 }, { key: 'björn', label: 'Björn', minutes: 60 }],
      },
      {
        key: 'onsdagsklubben', label: 'Onsdagsklubben', color: '#fed7aa', total: 180,
        teachers: [{ key: 'björn', label: 'Björn', minutes: 180 }],
      },
    ]);
  });
});

describe('isClassLesson', () => {
  it('känner igen Tema Oliv, Rosa och Grund men inte matte', () => {
    expect(['Tema Oliv', 'tema rosa', 'Tema  Grund'].every(isClassLesson)).toBe(true);
    expect(['Ma Grund', 'Onsdagsklubben', 'Studieverkstad'].some(isClassLesson)).toBe(false);
  });
});

describe('teacherShareSlices', () => {
  it('ger lärarnas färger och hoppar över nollor', () => {
    const colors = teacherColorMap(['anna', 'björn']);
    expect(teacherShareSlices([
      { key: 'anna', label: 'Anna', minutes: 30 },
      { key: 'björn', label: 'Björn', minutes: 90 },
      { key: 'cecilia', label: 'Cecilia', minutes: 0 },
    ], colors)).toEqual([
      { key: 'björn', label: 'Björn', minutes: 90, color: TEACHER_COLORS[1] },
      { key: 'anna', label: 'Anna', minutes: 30, color: TEACHER_COLORS[0] },
    ]);
  });
});

describe('sanitizeSelection', () => {
  it('behåller bara booleska värden', () => {
    expect(sanitizeSelection({ 'ma 1': true, lunch: false, x: 'ja' })).toEqual({ 'ma 1': true, lunch: false });
    expect(sanitizeSelection(['ma 1'])).toEqual({});
  });
});
