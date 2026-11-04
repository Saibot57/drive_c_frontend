import { describe, expect, it } from 'vitest';
import { DEFAULT_STAMPS, emptySession, setPersonNote } from '@/utils/narvaro';
import { exampleTable } from '@/utils/narvaroExample';
import {
  NarvaroData,
  SETTINGS_KEY,
  documentsToSave,
  emptyData,
  isExpiredWeek,
  isoWeekKey,
  mergeLegacy,
  mergeWeeks,
  sanitizeSettingsDoc,
  sanitizeWeekDoc,
  splitWeeks,
  tableFor,
  weekMonday,
  weekOfSession,
} from '@/utils/narvaroDocs';

const NOW = new Date(2026, 10, 4, 10, 0); // onsdag v. 45
const note = (label: string) => setPersonNote(emptySession(label), 'Amira Haddad', { tags: ['aktiv'], note: '' });

describe('veckonycklar', () => {
  it('räknar ISO-vecka och dess år', () => {
    expect(isoWeekKey(NOW)).toBe('w2026-45');
    // 1 jan 2027 är en fredag och hör till vecka 53 år 2026.
    expect(isoWeekKey(new Date(2027, 0, 1))).toBe('w2026-53');
    // 29 dec 2025 är måndag i vecka 1 år 2026.
    expect(isoWeekKey(new Date(2025, 11, 29))).toBe('w2026-01');
  });

  it('ger veckans måndag', () => {
    expect(weekMonday('w2026-45')).toEqual(new Date(2026, 10, 2));
    expect(weekMonday('w2026-01')).toEqual(new Date(2025, 11, 29));
    expect(weekMonday('settings')).toBeNull();
  });

  it('gallrar veckor äldre än ett läsår', () => {
    expect(isExpiredWeek('w2025-46', NOW)).toBe(false); // måndag 10 nov 2025
    expect(isExpiredWeek('w2025-44', NOW)).toBe(true);
    expect(isExpiredWeek('settings', NOW)).toBe(false);
  });

  it('hittar passets vecka', () => {
    expect(weekOfSession('2026-11-02|Måndag|B|8.30-9.45')).toBe('w2026-45');
    expect(weekOfSession('trasig')).toBeNull();
  });
});

describe('dokument', () => {
  const table = exampleTable();
  const data: NarvaroData = {
    tables: { 'w2026-44': table, 'w2026-45': table },
    notes: {
      '2026-11-02|Måndag|B|8.30-9.45': note('a'),
      '2026-10-27|Tisdag|E|x': note('b'),
      '2025-10-27|Måndag|B|x': note('gammal'),
    },
    groups: { '2026-11-04|Onsdag|dag|': { groups: [['Amira Haddad']] } },
    stamps: [...DEFAULT_STAMPS],
  };

  it('delar per vecka och tar inte med gallrade', () => {
    const weeks = splitWeeks(data, NOW);
    expect(Object.keys(weeks).sort()).toEqual(['w2026-44', 'w2026-45']);
    expect(Object.keys(weeks['w2026-45'].notes)).toEqual(['2026-11-02|Måndag|B|8.30-9.45']);
    expect(Object.keys(weeks['w2026-45'].groups)).toEqual(['2026-11-04|Onsdag|dag|']);
    expect(Object.keys(weeks['w2026-44'].notes)).toEqual(['2026-10-27|Tisdag|E|x']);
  });

  it('slår ihop igen utan förlust', () => {
    const roundTrip = mergeWeeks(splitWeeks(data, NOW), data.stamps, NOW);
    const { ['2025-10-27|Måndag|B|x']: _expired, ...kept } = data.notes;
    expect(roundTrip).toEqual({ ...data, notes: kept });
  });

  it('sparar tomma veckor som funnits och stämplarna', () => {
    const docs = documentsToSave({ ...emptyData(), tables: {} }, NOW, ['w2026-43', 'w2025-01', 'keyinfo']);
    expect(docs[SETTINGS_KEY]).toEqual({ stamps: DEFAULT_STAMPS });
    expect(docs['w2026-43']).toEqual({ table: null, notes: {}, groups: {} });
    expect(docs['w2025-01']).toBeUndefined();
    expect(docs.keyinfo).toBeUndefined();
  });

  it('väljer veckans tabell, annars en tidigare', () => {
    expect(tableFor(data.tables, 'w2026-45')?.key).toBe('w2026-45');
    expect(tableFor(data.tables, 'w2026-47')?.key).toBe('w2026-45');
    expect(tableFor(data.tables, 'w2026-40')).toBeNull();
  });

  it('läser trasiga dokument utan att krascha', () => {
    expect(sanitizeWeekDoc(null)).toEqual({ table: null, notes: {}, groups: {} });
    expect(sanitizeWeekDoc({ table: 'x', notes: { k: { people: {} } } }).notes.k.added).toEqual([]);
    expect(sanitizeSettingsDoc({}).stamps).toEqual(DEFAULT_STAMPS);
  });
});

describe('överföring från webbläsaren', () => {
  it('lägger tabellen i den här veckan och låter serverns data vinna', () => {
    const server: NarvaroData = {
      ...emptyData(),
      notes: { '2026-11-02|Måndag|B|x': note('server') },
    };
    const merged = mergeLegacy(server, {
      table: exampleTable(),
      notes: { '2026-11-02|Måndag|B|x': note('lokal'), '2026-11-03|Tisdag|E|y': note('bara lokal') },
      groups: {},
      stamps: [...DEFAULT_STAMPS, { id: 'egen', label: 'Egen', color: 'lilac', custom: true }],
    }, NOW);
    expect(Object.keys(merged.tables)).toEqual(['w2026-45']);
    expect(merged.notes['2026-11-02|Måndag|B|x'].label).toBe('server');
    expect(merged.notes['2026-11-03|Tisdag|E|y'].label).toBe('bara lokal');
    expect(merged.stamps.map(s => s.id)).toEqual([...DEFAULT_STAMPS.map(s => s.id), 'egen']);
  });

  it('skriver inte över serverns tabell för veckan', () => {
    const t = exampleTable();
    const merged = mergeLegacy({ ...emptyData(), tables: { 'w2026-45': t } }, { table: { ...t, days: ['X'] }, notes: {}, groups: {}, stamps: null }, NOW);
    expect(merged.tables['w2026-45']).toBe(t);
  });
});
