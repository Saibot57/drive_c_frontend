import { describe, expect, it } from 'vitest';
import { ScheduledEntry } from '@/types/schedule';
import { computeExportWindow, gridYForMinutes } from './exportWindow';
import { HEADER_H_PX, TITLE_H_PX, TOP_OFFSET_PX } from './theme';

const entry = (overrides: Partial<ScheduledEntry> = {}): ScheduledEntry => ({
  id: 'c1',
  instanceId: `i-${Math.random()}`,
  title: 'Matematik',
  teacher: 'TL',
  room: 'A12',
  color: '#fde68a',
  duration: 60,
  day: 'Måndag',
  startTime: '08:00',
  endTime: '09:00',
  ...overrides,
});

const allVisible = () => true;
const CHROME = TITLE_H_PX + HEADER_H_PX + TOP_OFFSET_PX;

describe('computeExportWindow', () => {
  it('rundar upp till nästa hela timme', () => {
    const result = computeExportWindow({
      entries: [entry({ endTime: '14:20' })],
      isVisible: allVisible,
    });
    expect(result.endMinutes).toBe(15 * 60);
    expect(result.sceneHeightPx).toBe(CHROME + 7 * 60 * 2);
  });

  it('lämnar en sluttid som redan är hel timme orörd', () => {
    // Regressionen: gamla vägen klippte 38 px för kort här och kapade
    // de sista 15 minuterna av lektionen ur filen.
    const result = computeExportWindow({
      entries: [entry({ endTime: '15:00' })],
      isVisible: allVisible,
    });
    expect(result.endMinutes).toBe(15 * 60);
    expect(gridYForMinutes(15 * 60, result)).toBe(result.sceneHeightPx);
  });

  it('räknar inte med uteslutna poster', () => {
    const kept = entry({ endTime: '10:00' });
    const dropped = entry({ endTime: '16:00', title: 'Lunch' });
    const result = computeExportWindow({
      entries: [kept, dropped],
      isVisible: e => e.title !== 'Lunch',
    });
    expect(result.endMinutes).toBe(10 * 60);
  });

  it('räknar inte med bortfiltrerade poster', () => {
    // Gamla `computeClipHeightPx` såg bara uteslutningslistan, så ett
    // bortfiltrerat sista pass lämnade dödyta i botten.
    const result = computeExportWindow({
      entries: [entry({ endTime: '09:00' }), entry({ endTime: '16:00', teacher: 'Hanna' })],
      isVisible: e => e.teacher === 'TL',
    });
    expect(result.endMinutes).toBe(9 * 60);
  });

  it('tar med planeringsblock som sträcker sig förbi sista lektionen', () => {
    const result = computeExportWindow({
      entries: [entry({ endTime: '11:00' })],
      isVisible: allVisible,
      extraEndMinutes: 16 * 60,
    });
    expect(result.endMinutes).toBe(16 * 60);
  });

  it('ger en timme för ett tomt schema', () => {
    const result = computeExportWindow({ entries: [], isVisible: allVisible });
    expect(result.startMinutes).toBe(8 * 60);
    expect(result.endMinutes).toBe(9 * 60);
    expect(result.sceneHeightPx).toBe(CHROME + 120);
  });

  it('klampar mot END_HOUR även om en post går längre', () => {
    const result = computeExportWindow({
      entries: [entry({ endTime: '19:00' })],
      isVisible: allVisible,
    });
    expect(result.endMinutes).toBe(17 * 60);
  });

  it('ger 1174 px scenhöjd för en hel dag', () => {
    const result = computeExportWindow({
      entries: [entry({ endTime: '17:00' })],
      isVisible: allVisible,
    });
    expect(result.sceneHeightPx).toBe(1174);
  });
});
