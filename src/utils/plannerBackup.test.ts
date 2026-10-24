import { describe, expect, it } from 'vitest';
import type { HiddenSettingsDraft } from '@/hooks/useHiddenSettings';
import { HIDDEN_SETTING_KEYS, pickHiddenSettings } from './plannerBackup';

const settings: HiddenSettingsDraft = {
  teachers: ['Anna'],
  rooms: ['A1'],
  teacherAvailability: {},
  colorTriggers: [],
  roomTriggers: [],
  planningMinGap: 20,
  exportExcludes: ['ATP*'],
  pasteProtect: ['Lunch'],
  selectionDefaults: ['Mentorstid'],
  planningStartMinutes: 480,
  planningEndMinutes: null,
};

describe('pickHiddenSettings', () => {
  it('tar med varje inställning genom en export och import', () => {
    const file = JSON.parse(JSON.stringify({ version: 13, courses: [], schedule: [], ...settings }));
    expect(pickHiddenSettings(file)).toEqual(settings);
  });

  // Arkitektur F10: de här tre föll bort vid en återställning.
  it('tar med urvalets förval, inklistringsskyddet och exportens undantag', () => {
    const picked = pickHiddenSettings(settings);
    expect(picked.selectionDefaults).toEqual(['Mentorstid']);
    expect(picked.pasteProtect).toEqual(['Lunch']);
    expect(picked.exportExcludes).toEqual(['ATP*']);
  });

  it('lämnar en inställning som saknas i en äldre backup orörd', () => {
    const picked = pickHiddenSettings({ version: 12, courses: [], schedule: [], teachers: ['Anna'] });
    expect(picked).toEqual({ teachers: ['Anna'] });
    expect('pasteProtect' in picked).toBe(false);
  });

  it('behåller null, som betyder standardram', () => {
    expect(pickHiddenSettings({ planningEndMinutes: null })).toEqual({ planningEndMinutes: null });
  });

  it('tar inte med annat ur filen', () => {
    expect(pickHiddenSettings({ courses: [], schedule: [], okänd: 1 })).toEqual({});
    expect(pickHiddenSettings(null)).toEqual({});
  });

  it('har lärarna före spärrarna som hänger på dem', () => {
    expect(HIDDEN_SETTING_KEYS.indexOf('teachers'))
      .toBeLessThan(HIDDEN_SETTING_KEYS.indexOf('teacherAvailability'));
  });
});
