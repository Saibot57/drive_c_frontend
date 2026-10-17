import { describe, expect, it } from 'vitest';
import type { ScheduledEntry } from '@/types/schedule';
import {
  collectTeacherNames,
  formatMinutes,
  isAllTeachersField,
  mergeIntervalMinutes,
  mergeIntervals,
  splitTeacherNames,
  totalMinutesByTeacher,
  totalMinutesByTitle,
} from './scheduleStats';

const entry = (
  title: string,
  teacher: string,
  startTime: string,
  endTime: string,
  day = 'Måndag'
): ScheduledEntry => ({
  id: `${title}-${day}-${startTime}`,
  instanceId: `${title}-${day}-${startTime}`,
  title,
  teacher,
  room: '',
  color: '#ffffff',
  duration: 0,
  day,
  startTime,
  endTime,
});

describe('mergeIntervals', () => {
  it('slår ihop överlappande och angränsande intervall och sorterar dem', () => {
    expect(mergeIntervals([
      { start: 600, end: 660 },
      { start: 480, end: 540 },
      { start: 540, end: 570 },
      { start: 630, end: 700 },
    ])).toEqual([
      { start: 480, end: 570 },
      { start: 600, end: 700 },
    ]);
  });

  it('hoppar över tomma och bakvända intervall', () => {
    expect(mergeIntervals([{ start: 600, end: 600 }, { start: 700, end: 650 }])).toEqual([]);
  });

  it('ändrar inte listan den får', () => {
    const input = [{ start: 480, end: 540 }, { start: 500, end: 600 }];
    mergeIntervals(input);
    expect(input).toEqual([{ start: 480, end: 540 }, { start: 500, end: 600 }]);
  });
});

describe('mergeIntervalMinutes', () => {
  it('räknar parallella lektioner en gång', () => {
    expect(mergeIntervalMinutes([{ start: 480, end: 540 }, { start: 480, end: 540 }])).toBe(60);
    expect(mergeIntervalMinutes([{ start: 480, end: 540 }, { start: 600, end: 630 }])).toBe(90);
    expect(mergeIntervalMinutes([])).toBe(0);
  });
});

describe('lärarfältet', () => {
  it('delar på komma och tar bort tomma namn', () => {
    expect(splitTeacherNames(' Anna, Björn ,, ')).toEqual(['Anna', 'Björn']);
    expect(splitTeacherNames(undefined)).toEqual([]);
    expect(splitTeacherNames(42)).toEqual([]);
  });

  it('känner igen "alla" ensamt eller bland andra namn, utan hänsyn till versaler', () => {
    expect(isAllTeachersField('Alla')).toBe(true);
    expect(isAllTeachersField('Anna, ALLA')).toBe(true);
    expect(isAllTeachersField('Allan')).toBe(false);
    expect(isAllTeachersField('')).toBe(false);
  });

  it('samlar lärare ur listan och schemat, slår ihop versaler och räknar inte "alla"', () => {
    const entries = [entry('Ma', 'anna, Björn', '08:00', '09:00'), entry('Sv', 'alla', '09:00', '10:00')];
    expect(collectTeacherNames(entries, ['Anna', 'Cecilia'])).toEqual(['Anna', 'Björn', 'Cecilia']);
  });
});

describe('formatMinutes', () => {
  it('utelämnar delar som är noll', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 tim');
    expect(formatMinutes(1035)).toBe('17 tim, 15 min');
  });

  it('avrundar och visar aldrig negativt', () => {
    expect(formatMinutes(59.6)).toBe('1 tim');
    expect(formatMinutes(-10)).toBe('0 min');
  });
});

describe('timmar per ämne och lärare', () => {
  const entries = [
    // Två parallella mattelektioner räknas en gång.
    entry('Ma', 'Anna', '08:00', '09:00'),
    entry('Ma', 'Björn', '08:00', '09:00'),
    // Samma tid en annan dag räknas för sig.
    entry('Ma', 'anna', '08:00', '09:00', 'Tisdag'),
    entry('Sv', 'Anna, Björn', '10:00', '11:30'),
  ];

  it('summerar per titel och sorterar efter tid', () => {
    expect(totalMinutesByTitle(entries)).toEqual([['Ma', 120], ['Sv', 90]]);
  });

  it('ger varje lärare full tid och slår ihop versaler', () => {
    expect(totalMinutesByTeacher(entries)).toEqual([['Anna', 210], ['Björn', 150]]);
  });

  it('hoppar över poster utan titel eller lärare', () => {
    expect(totalMinutesByTitle([entry('', 'Anna', '08:00', '09:00')])).toEqual([]);
    expect(totalMinutesByTeacher([entry('Ma', '', '08:00', '09:00')])).toEqual([]);
  });
});
