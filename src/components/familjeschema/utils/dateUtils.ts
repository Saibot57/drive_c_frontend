import { MONTHS_SWEDISH } from '../constants';

export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const getWeeksInYear = (year: number): number => {
  const lastDay = new Date(year, 11, 31);
  const week = getWeekNumber(lastDay);
  return week === 1 ? getWeekNumber(new Date(year, 11, 24)) : week;
};

export const getWeekDateRange = (weekNumber: number, year: number, datesCount: number = 5): Date[] => {
  const jan4 = new Date(year, 0, 4);
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const monday = new Date(mondayWeek1);
  monday.setDate(mondayWeek1.getDate() + (weekNumber - 1) * 7);

  const dates: Date[] = [];
  for (let i = 0; i < datesCount; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
};

export const formatWeekRange = (dates: Date[]): string => {
  const start = dates[0];
  const end = dates[dates.length - 1];
  
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}-${end.getDate()} ${MONTHS_SWEDISH[start.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS_SWEDISH[start.getMonth()]} ‑ ${end.getDate()} ${MONTHS_SWEDISH[end.getMonth()]}`;
};

export const isToday = (date: Date): boolean => {
  const today = new Date();
  return today.toDateString() === date.toDateString();
};

export const isWeekInPast = (weekDates: Date[]): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return weekDates[weekDates.length - 1] < today;
};

export const isWeekInFuture = (weekDates: Date[]): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return weekDates[0] > today;
};