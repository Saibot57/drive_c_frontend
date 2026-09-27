import { describe, expect, it, vi } from 'vitest';
import { sanitizeScheduleImport } from './scheduleImport';
import { reportPlacementVerdict } from './scheduleRules';
import { extractUrl } from './links';

describe('sanitizeScheduleImport', () => {
  it('fyller i det som saknas', () => {
    const [entry] = sanitizeScheduleImport([{ title: 'Matte', day: 'Okänd' }]);
    expect(entry.startTime).toBe('08:00');
    expect(entry.endTime).toBe('09:00');
    expect(entry.duration).toBe(60);
    expect(entry.day).toBe('Måndag');
    expect(entry.instanceId).toBeTruthy();
  });

  it('räknar längden ur tiderna och behåller ett befintligt instanceId', () => {
    const [entry] = sanitizeScheduleImport([
      { title: 'Svenska', day: 'Onsdag', startTime: '10:00', endTime: '11:30', instanceId: 'x1' },
    ]);
    expect(entry.duration).toBe(90);
    expect(entry.day).toBe('Onsdag');
    expect(entry.instanceId).toBe('x1');
  });

  it('ger en tom lista för annat än en lista', () => {
    expect(sanitizeScheduleImport(null as unknown as any[])).toEqual([]);
  });
});

describe('reportPlacementVerdict', () => {
  it('stoppar en blockerad placering med ett fel', () => {
    const showNotice = vi.fn();
    expect(reportPlacementVerdict({ blocked: 'Krock', warning: null }, showNotice)).toBe(false);
    expect(showNotice).toHaveBeenCalledWith('Krock', 'error');
  });

  it('visar varningen direkt som standard', () => {
    const showNotice = vi.fn();
    expect(reportPlacementVerdict({ blocked: null, warning: 'Läraren är upptagen' }, showNotice)).toBe(true);
    expect(showNotice).toHaveBeenCalledWith('Läraren är upptagen', 'warning');
  });

  it('låter anroparen visa varningen själv', () => {
    const showNotice = vi.fn();
    const ok = reportPlacementVerdict(
      { blocked: null, warning: 'Läraren är upptagen' },
      showNotice,
      { announceWarning: false }
    );
    expect(ok).toBe(true);
    expect(showNotice).not.toHaveBeenCalled();
  });
});

describe('extractUrl', () => {
  it('hittar första länken i en text', () => {
    expect(extractUrl('Läs https://exempel.se/uppgift sen')).toBe('https://exempel.se/uppgift');
    expect(extractUrl('ingen länk')).toBeNull();
    expect(extractUrl(undefined)).toBeNull();
  });
});
