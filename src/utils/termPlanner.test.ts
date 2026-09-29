import { describe, expect, it } from 'vitest';
import type { PlannerArchiveSummary } from '@/types/schedule';
import type { ThemeWheel } from '@/types/themeWheel';
import {
  buildTermStats,
  columnForTitle,
  fillSuggestedArchives,
  formatHours,
  resizeTermWeeks,
  StatsActivity,
  suggestArchiveForWeek,
  teacherMinutesForWeek,
  termThemes,
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
  it('tar lov och huvudområden som tema', () => {
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
      { theme: 'Hav', holiday: false, archiveId: null },
      { theme: 'Hav / Rymd', holiday: false, archiveId: null },
      { theme: 'Rymd', holiday: true, archiveId: null },
      { theme: 'Rymd', holiday: false, archiveId: null },
    ]);
  });
});

describe('resizeTermWeeks och termThemes', () => {
  it('behåller veckor och fyller på tomma', () => {
    const weeks = [{ theme: 'Hav', holiday: false, archiveId: 'a' }];
    expect(resizeTermWeeks(weeks, 2)).toEqual([weeks[0], { theme: '', holiday: false, archiveId: null }]);
    expect(resizeTermWeeks(resizeTermWeeks(weeks, 2), 1)).toEqual(weeks);
  });

  it('listar teman i ordning utan dubbletter', () => {
    expect(termThemes([
      { theme: 'Hav', holiday: false, archiveId: null },
      { theme: ' ', holiday: false, archiveId: null },
      { theme: 'Rymd', holiday: false, archiveId: null },
      { theme: 'Hav', holiday: true, archiveId: null },
    ])).toEqual(['Hav', 'Rymd']);
  });
});
