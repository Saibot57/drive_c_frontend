import { describe, expect, it } from 'vitest';
import { DEFAULT_STAMPS, emptySession, setPersonNote } from '@/utils/narvaro';
import { exampleTable } from '@/utils/narvaroExample';
import {
  NarvaroData,
  SETTINGS_KEY,
  documentsToSave,
  emptyData,
  groupByWeek,
  isExpiredWeek,
  isoWeekKey,
  mergeLegacy,
  mergeWeeks,
  sanitizeSettingsDoc,
  sanitizeWeekDoc,
  splitWeeks,
  knownClasses,
  latestSheets,
  removeSheet,
  renameClass,
  setSheet,
  weekMonday,
  weekHeading,
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
    tables: { 'w2026-44': { Oliv: table }, 'w2026-45': { Oliv: table, Rosa: table } },
    notes: {
      '2026-11-02|Måndag|B|8.30-9.45': note('a'),
      '2026-10-27|Tisdag|E|x': note('b'),
      '2025-10-27|Måndag|B|x': note('gammal'),
    },
    groups: { '2026-11-04|Onsdag|dag|': { groups: [['Amira Haddad']] } },
    passNames: {
      '2026-11-02|Måndag|B': { Rosa: 'Svenska' },
      '2026-10-27|Tisdag|dag': { Oliv: 'Studiedag' },
      '2025-10-27|Måndag|B': { Rosa: 'Gammal' },
    },
    stamps: [...DEFAULT_STAMPS],
  };

  it('delar per vecka och tar inte med gallrade', () => {
    const weeks = splitWeeks(data, NOW);
    expect(Object.keys(weeks).sort()).toEqual(['w2026-44', 'w2026-45']);
    expect(Object.keys(weeks['w2026-45'].notes)).toEqual(['2026-11-02|Måndag|B|8.30-9.45']);
    expect(Object.keys(weeks['w2026-45'].groups)).toEqual(['2026-11-04|Onsdag|dag|']);
    expect(Object.keys(weeks['w2026-44'].notes)).toEqual(['2026-10-27|Tisdag|E|x']);
    expect(weeks['w2026-45'].passNames).toEqual({ '2026-11-02|Måndag|B': { Rosa: 'Svenska' } });
    expect(weeks['w2026-44'].passNames).toEqual({ '2026-10-27|Tisdag|dag': { Oliv: 'Studiedag' } });
  });

  it('slår ihop igen utan förlust', () => {
    const roundTrip = mergeWeeks(splitWeeks(data, NOW), data.stamps, NOW);
    const { ['2025-10-27|Måndag|B|x']: _expired, ...kept } = data.notes;
    const { ['2025-10-27|Måndag|B']: _expiredName, ...keptNames } = data.passNames;
    expect(roundTrip).toEqual({ ...data, notes: kept, passNames: keptNames });
  });

  it('sparar tomma veckor som funnits och stämplarna', () => {
    const docs = documentsToSave({ ...emptyData(), tables: {} }, NOW, ['w2026-43', 'w2025-01', 'keyinfo']);
    expect(docs[SETTINGS_KEY]).toEqual({ stamps: DEFAULT_STAMPS });
    expect(docs['w2026-43']).toEqual({ sheets: {}, notes: {}, groups: {}, passNames: {} });
    expect(docs['w2025-01']).toBeUndefined();
    expect(docs.keyinfo).toBeUndefined();
  });

  it('ger varje klass senaste tabell till och med veckan', () => {
    const t = exampleTable();
    const tables = { 'w2026-44': { Oliv: t, Grund: t }, 'w2026-45': { Oliv: t }, 'w2026-46': { Rosa: t } };
    const latest = latestSheets(tables, 'w2026-45');
    expect(Object.fromEntries(Object.entries(latest).map(([k, r]) => [k, r.week]))).toEqual({ Oliv: 'w2026-45', Grund: 'w2026-44' });
    expect(latestSheets(tables, 'w2026-40')).toEqual({});
    expect(Object.keys(knownClasses(tables)).sort()).toEqual(['Grund', 'Oliv', 'Rosa']);
  });

  it('sätter, tar bort och byter namn på klassers tabeller', () => {
    const t = exampleTable();
    let d = setSheet(emptyData(), 'w2026-45', 'Rosa', t);
    d = setSheet(d, 'w2026-45', '', t);
    d = setSheet(d, 'w2026-44', '', t);
    d = { ...d, passNames: { '2026-11-02|Måndag|B': { '': 'Svenska', Rosa: 'Matte' } } };
    d = renameClass(d, '', 'Oliv');
    expect(Object.keys(d.tables['w2026-45']).sort()).toEqual(['Oliv', 'Rosa']);
    expect(d.passNames).toEqual({ '2026-11-02|Måndag|B': { Oliv: 'Svenska', Rosa: 'Matte' } });
    expect(Object.keys(d.tables['w2026-44'])).toEqual(['Oliv']);
    d = removeSheet(d, 'w2026-44', 'Oliv');
    expect(d.tables['w2026-44']).toBeUndefined();
  });

  it('läser ett veckodokument från före klasserna som en tabell utan klass', () => {
    const t = exampleTable();
    const old = sanitizeWeekDoc({
      table: t,
      notes: { '2026-11-02|Måndag|B|8.30-9.45': note('gammal') },
      groups: { '2026-11-02|Måndag|B|8.30-9.45': { groups: [['A']] } },
    });
    expect(old.sheets).toEqual({ '': t });
    expect(Object.keys(old.notes)).toEqual(['2026-11-02|Måndag|B']);
    expect(old.groups).toEqual({});
    expect(old.passNames).toEqual({});
  });

  it('läser trasiga dokument utan att krascha', () => {
    expect(sanitizeWeekDoc(null)).toEqual({ sheets: {}, notes: {}, groups: {}, passNames: {} });
    expect(sanitizeWeekDoc({ passNames: { a: { Rosa: 3, Oliv: '  ' }, b: 'x', 'c|d|e|f': { Rosa: ' Svenska ' } } }).passNames)
      .toEqual({ 'c|d|e': { Rosa: 'Svenska' } });
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
    expect(Object.keys(merged.tables['w2026-45'])).toEqual(['']);
    expect(merged.notes['2026-11-02|Måndag|B|x'].label).toBe('server');
    expect(merged.notes['2026-11-03|Tisdag|E|y'].label).toBe('bara lokal');
    expect(merged.stamps.map(s => s.id)).toEqual([...DEFAULT_STAMPS.map(s => s.id), 'egen']);
  });

  it('skriver inte över serverns tabell för veckan', () => {
    const t = exampleTable();
    const merged = mergeLegacy({ ...emptyData(), tables: { 'w2026-45': { Oliv: t } } }, { table: { ...t, days: ['X'] }, notes: {}, groups: {}, stamps: null }, NOW);
    expect(merged.tables['w2026-45']).toEqual({ Oliv: t });
  });
});

describe('tidigare pass per vecka', () => {
  it('grupperar per ISO-vecka, senaste först, och behåller ordningen inom veckan', () => {
    const keys = [
      '2026-11-09|Måndag|C', '2026-11-09|Måndag|B', '2026-11-09|Måndag|A',
      '2026-11-05|Torsdag|C', '2026-11-04|Onsdag|B',
    ];
    expect(groupByWeek(keys)).toEqual([
      { week: 'w2026-46', keys: ['2026-11-09|Måndag|C', '2026-11-09|Måndag|B', '2026-11-09|Måndag|A'] },
      { week: 'w2026-45', keys: ['2026-11-05|Torsdag|C', '2026-11-04|Onsdag|B'] },
    ]);
  });

  it('lägger söndagen i samma vecka som måndagen före', () => {
    expect(groupByWeek(['2026-11-15|Söndag|A', '2026-11-09|Måndag|A'])).toEqual([
      { week: 'w2026-46', keys: ['2026-11-15|Söndag|A', '2026-11-09|Måndag|A'] },
    ]);
  });

  it('följer ISO-året vid årsskiftet', () => {
    // 4 januari 2027 är måndag i v. 1; 1 januari 2027 hör till v. 53 år 2026.
    expect(groupByWeek(['2027-01-04|Måndag|A', '2027-01-01|Fredag|A', '2026-12-28|Måndag|A'])).toEqual([
      { week: 'w2027-01', keys: ['2027-01-04|Måndag|A'] },
      { week: 'w2026-53', keys: ['2027-01-01|Fredag|A', '2026-12-28|Måndag|A'] },
    ]);
  });

  it('lägger nycklar utan datum sist', () => {
    expect(groupByWeek(['gammal', '2026-11-04|Onsdag|B'])).toEqual([
      { week: 'w2026-45', keys: ['2026-11-04|Onsdag|B'] },
      { week: null, keys: ['gammal'] },
    ]);
    expect(groupByWeek([])).toEqual([]);
  });

  it('skriver rubriken med år bara när ISO-året är ett annat', () => {
    expect(weekHeading('w2026-45', 'w2026-46')).toBe('v. 45');
    expect(weekHeading('w2026-05', 'w2026-46')).toBe('v. 5');
    expect(weekHeading('w2026-53', 'w2027-01')).toBe('v. 53 · 2026');
    expect(weekHeading(null, 'w2026-46')).toBe('Utan datum');
  });
});
