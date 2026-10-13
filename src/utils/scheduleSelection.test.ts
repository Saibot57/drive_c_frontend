import { describe, expect, it } from 'vitest';
import { PLANNER_DAYS } from '@/config/plannerConstants';
import { ScheduledEntry } from '@/types/schedule';
import {
  buildSelectionRows,
  createSelection,
  isInSelection,
  sanitizeSelections,
  setAllVisible,
  setPassVisible,
  setTitleVisible,
} from '@/utils/scheduleSelection';

const entry = (instanceId: string, title: string, day: string, startTime: string, endTime = '10:00'): ScheduledEntry => ({
  id: 'c',
  instanceId,
  title,
  teacher: '',
  room: '',
  color: '#cccccc',
  duration: 60,
  day,
  startTime,
  endTime,
});

const DEFAULTS = ['Lunch', 'Paus'];

const week = [
  entry('a', 'Ma 1', 'Måndag', '08:30'),
  entry('b', 'Ma 1', 'Fredag', '08:30'),
  entry('c', 'Ma Grund', 'Fredag', '08:30'),
  entry('d', 'Lunch', 'Fredag', '11:30', '12:30'),
];

const visibleIds = (schedule: ScheduledEntry[], selection: ReturnType<typeof createSelection>) => (
  schedule.filter(e => isInSelection(selection, e, DEFAULTS)).map(e => e.instanceId)
);

describe('createSelection', () => {
  it('börjar med bara de förkryssade titlarna', () => {
    const selection = createSelection('s', 'Anna', week, DEFAULTS);
    expect(visibleIds(week, selection)).toEqual(['d']);
  });
});

describe('setTitleVisible', () => {
  it('visar alla pass med titeln', () => {
    const selection = setTitleVisible(createSelection('s', 'Anna', week, DEFAULTS), week, DEFAULTS, 'Ma 1', true);
    expect(visibleIds(week, selection)).toEqual(['a', 'b', 'd']);
  });

  it('tömmer undantagen för titelns pass', () => {
    let selection = setTitleVisible(createSelection('s', 'Anna', week, DEFAULTS), week, DEFAULTS, 'Ma 1', true);
    selection = setPassVisible(selection, week, DEFAULTS, week[1], false);
    selection = setTitleVisible(selection, week, DEFAULTS, 'Ma 1', true);
    expect(selection.passOverrides).toEqual({});
  });
});

describe('setPassVisible', () => {
  it('väljer bort ett enskilt pass', () => {
    let selection = setTitleVisible(createSelection('s', 'Anna', week, DEFAULTS), week, DEFAULTS, 'Ma 1', true);
    selection = setPassVisible(selection, week, DEFAULTS, week[1], false);
    expect(visibleIds(week, selection)).toEqual(['a', 'd']);
  });

  it('kan visa ett pass vars titel inte är ikryssad', () => {
    const selection = setPassVisible(createSelection('s', 'Anna', week, DEFAULTS), week, DEFAULTS, week[2], true);
    expect(visibleIds(week, selection)).toEqual(['c', 'd']);
  });

  it('sparar inget undantag för ett pass som följer sin titel', () => {
    let selection = createSelection('s', 'Anna', week, DEFAULTS);
    selection = setPassVisible(selection, week, DEFAULTS, week[2], true);
    selection = setPassVisible(selection, week, DEFAULTS, week[2], false);
    expect(selection.passOverrides).toEqual({});
  });
});

describe('en annan vecka', () => {
  // Samma pass, kopierade med nya id, plus en ny titel och ett nytt förkryssat pass.
  const nextWeek = [
    entry('x1', 'Ma 1', 'Måndag', '08:30'),
    entry('x2', 'Ma 1', 'Fredag', '08:30'),
    entry('x3', 'Tema Oliv', 'Tisdag', '09:00'),
    entry('x4', 'Paus', 'Tisdag', '10:00', '10:15'),
  ];

  it('följer passen på dag, tid och titel i stället för id', () => {
    let selection = setTitleVisible(createSelection('s', 'Anna', week, DEFAULTS), week, DEFAULTS, 'Ma 1', true);
    selection = setPassVisible(selection, week, DEFAULTS, week[1], false);
    expect(visibleIds(nextWeek, selection)).toEqual(['x1', 'x4']);
  });

  it('döljer nya titlar men visar nya förkryssade, och märker ut dem', () => {
    const selection = createSelection('s', 'Anna', week, DEFAULTS);
    const rows = buildSelectionRows(nextWeek, selection, DEFAULTS, PLANNER_DAYS);
    expect(rows.map(row => [row.title, row.visibleCount, row.isNew])).toEqual([
      ['Ma 1', 0, false],
      ['Paus', 1, true],
      ['Tema Oliv', 0, true],
    ]);
  });

  it('låter en ny förkryssad titel synas kvar när något annat ändras', () => {
    let selection = createSelection('s', 'Anna', week, DEFAULTS);
    selection = setTitleVisible(selection, nextWeek, DEFAULTS, 'Tema Oliv', true);
    expect(visibleIds(nextWeek, selection)).toEqual(['x3', 'x4']);
    expect(buildSelectionRows(nextWeek, selection, DEFAULTS, PLANNER_DAYS).some(row => row.isNew)).toBe(false);
  });

  it('rör inte titlar från andra veckor när allt kryssas ur', () => {
    let selection = setTitleVisible(createSelection('s', 'Anna', week, DEFAULTS), week, DEFAULTS, 'Ma Grund', true);
    selection = setAllVisible(selection, nextWeek, DEFAULTS, false);
    expect(selection.titles).toEqual(['Lunch', 'Ma Grund']);
  });
});

describe('buildSelectionRows', () => {
  it('ordnar passen efter dag och tid', () => {
    const rows = buildSelectionRows(week, createSelection('s', 'Anna', week, DEFAULTS), DEFAULTS, PLANNER_DAYS);
    expect(rows.find(row => row.title === 'Ma 1')!.entries.map(e => e.instanceId)).toEqual(['a', 'b']);
  });
});

describe('sanitizeSelections', () => {
  it('hoppar över trasiga urval och dubbletter', () => {
    const good = { id: 'a', name: ' Anna ', titles: ['Ma 1'], knownTitles: ['Ma 1'], passOverrides: { k: false, j: 'x' } };
    expect(sanitizeSelections([good, { ...good }, { id: 'b' }, null, 'x'])).toEqual([
      { id: 'a', name: 'Anna', titles: ['Ma 1'], knownTitles: ['Ma 1'], passOverrides: { k: false } },
    ]);
    expect(sanitizeSelections('nej')).toEqual([]);
  });
});
