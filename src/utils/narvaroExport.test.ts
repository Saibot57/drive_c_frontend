import { describe, expect, it } from 'vitest';
import { DEFAULT_STAMPS, NotesStore } from '@/utils/narvaro';
import { ExportInput, exportClasses, exportFileName, exportText, exportWeeks, weekTitle } from '@/utils/narvaroExport';
import { ME, sheets, week } from '@/utils/__fixtures__/narvaroSchedule';

// Vecka 47 år 2026 börjar måndag 16 november.
const W47 = 'w2026-47';
const W46 = 'w2026-46';
const note = (tags: string[], text = '') => ({ tags, note: text });

const notes = (): NotesStore => ({
  // Måndag andra passet (kolumn C): Rosa och Oliv i samma pass.
  '2026-11-16|Måndag|C': {
    label: 'Måndag 16/11 · 10.00-11.30',
    people: { 'Rosa Ett': note(['aktiv'], 'Bra fråga'), 'Oliv Ett': note(['tyst']) },
    added: [],
  },
  // Måndag första passet (kolumn B), skrivet efteråt men ska komma först.
  '2026-11-16|Måndag|B': { label: 'Måndag 16/11 · 8.30-9.45', people: { 'Rosa Ett': note(['star']) }, added: [] },
  // Tisdagens engelska (kolumn F): nivågrupper.
  '2026-11-17|Tisdag|F': { label: 'Tisdag 17/11 · 12.30-14.30', people: { 'Grund Ett': note([], 'Läste högt') }, added: [] },
  // Veckan före.
  '2026-11-09|Måndag|B': { label: 'Måndag 9/11 · 8.30-9.45', people: { 'Grund Två': note(['stod']) }, added: [] },
  // Ett pass utan innehåll räknas inte.
  '2026-11-18|Onsdag|H': { label: 'Onsdag 18/11 · 8.30-9.45', people: { 'Rosa Ett': note([]) }, added: [] },
});

const input = (over: Partial<ExportInput> = {}): ExportInput => ({
  weeks: [W47],
  classes: ['Grund', 'Oliv', 'Rosa'],
  tables: { [W46]: sheets() },
  notes: notes(),
  passNames: {},
  stamps: DEFAULT_STAMPS,
  schedules: { [W47]: week(), [W46]: week() },
  myName: ME,
  today: new Date(2026, 10, 20),
  ...over,
});

describe('exportText', () => {
  it('skriver ett stycke per pass och klass med schemats titel och innehåll', () => {
    const text = exportText(input({ classes: ['Rosa'] }));
    expect(text).toContain('Noteringar från Närvarorutor\nKlasser: Rosa\nExporterad 2026-11-20');
    expect(text).toContain('== Vecka 47 · 16/11–22/11 2026 ==');
    expect(text).toContain(
      'Måndag 16/11 · 10.00-11.30 · Rosa\nSchema: Tema Rosa · Kim · Rådhuset\nInnehåll: Historia: Historiebruk\n\n  Rosa Ett: Aktiv. Bra fråga',
    );
  });

  it('ordnar passen efter datum och arkets kolumner, inte efter när de skrevs', () => {
    const text = exportText(input({ classes: ['Rosa'] }));
    expect(text.indexOf('8.30-9.45 · Rosa')).toBeGreaterThan(-1);
    expect(text.indexOf('8.30-9.45 · Rosa')).toBeLessThan(text.indexOf('10.00-11.30 · Rosa'));
  });

  it('delar ett pass med flera klasser i ett stycke per klass, med klassens eget schemapass', () => {
    const text = exportText(input({ classes: ['Oliv', 'Rosa'] }));
    expect(text).toContain('Måndag 16/11 · 10.00-11.30 · Oliv\nSchema: Tema Oliv · Sam\n\n  Oliv Ett: Tyst idag');
    expect(text).toContain('Måndag 16/11 · 10.00-11.30 · Rosa\nSchema: Tema Rosa');
  });

  it('tar bara med de valda klasserna', () => {
    const text = exportText(input({ classes: ['Oliv'] }));
    expect(text).toContain('Oliv Ett');
    expect(text).not.toContain('Rosa Ett');
    expect(text).not.toContain('Grund Ett');
  });

  it('visar det egna passet i en tid med nivågrupper', () => {
    const text = exportText(input({ classes: ['Grund'] }));
    expect(text).toContain('Tisdag 17/11 · 12.30-14.30 · Grund\nSchema: Engelska 2 · Kim\n\n  Grund Ett: Läste högt');
    expect(text).not.toContain('Engelska 1');
  });

  it('visar alla parallella pass när inget är användarens', () => {
    const text = exportText(input({ classes: ['Grund'], myName: '' }));
    expect(text).toContain('Schema: Engelska 1 · Sam\nSchema: Engelska 2 · Kim\nSchema: Engelska Grund · Robin');
  });

  it('hoppar över schemats platshållare och skriver inga schemarader utan schema', () => {
    const text = exportText(input({ schedules: {} }));
    expect(text).not.toContain('Schema:');
    expect(text).toContain('Måndag 16/11 · 8.30-9.45 · Rosa\n\n  Rosa Ett: Utmärkte sig');
  });

  it('lägger passets eget namn i rubriken', () => {
    const text = exportText(input({ classes: ['Rosa'], passNames: { '2026-11-16|Måndag|B': { Rosa: 'Prov' } } }));
    expect(text).toContain('Måndag 16/11 · Prov · 8.30-9.45 · Rosa');
  });

  it('tar flera veckor i stigande ordning och hoppar över veckor utan noteringar', () => {
    const text = exportText(input({ weeks: [W47, 'w2026-40', W46] }));
    expect(text.indexOf('Vecka 46')).toBeLessThan(text.indexOf('Vecka 47'));
    expect(text).toContain('Måndag 9/11 · 8.30-9.45 · Grund');
    expect(text).not.toContain('Vecka 40');
  });

  it('håller isär två elever med samma namn i olika klasser', () => {
    const store: NotesStore = {
      '2026-11-16|Måndag|B': {
        label: '',
        people: { 'Delad Namnsson (Oliv)': note(['aktiv']), 'Delad Namnsson (Rosa)': note(['tyst']) },
        added: [],
      },
    };
    const text = exportText(input({ notes: store, classes: ['Rosa'] }));
    expect(text).toContain('Delad Namnsson (Rosa): Tyst idag');
    expect(text).not.toContain('(Oliv)');
  });

  it('tar med namn som inte finns i något ark under Okänd klass', () => {
    const store: NotesStore = {
      '2026-11-16|Måndag|B': { label: '', people: { 'Flyttad Elev': note([], 'Slutade') }, added: [] },
    };
    const text = exportText(input({ notes: store, classes: ['Rosa'] }));
    expect(text).toContain('Måndag 16/11 · 8.30-9.45 · Okänd klass\n\n  Flyttad Elev: Slutade');
  });

  it('behåller den sparade rubriken när kolumnen inte finns i arket', () => {
    const store: NotesStore = {
      '2026-11-16|Måndag|Z': { label: 'Måndag 16/11 · gammalt pass', people: { 'Rosa Ett': note(['aktiv']) }, added: [] },
    };
    const text = exportText(input({ notes: store, classes: ['Rosa'] }));
    expect(text).toContain('Måndag 16/11 · gammalt pass · Rosa\n\n  Rosa Ett: Aktiv');
  });

  it('ger tom text när inget finns att exportera', () => {
    expect(exportText(input({ weeks: ['w2026-40'] }))).toBe('');
    expect(exportText(input({ classes: [] , notes: { '2026-11-16|Måndag|B': notes()['2026-11-16|Måndag|B'] } }))).toBe('');
  });
});

describe('hjälparna', () => {
  it('exportWeeks räknar pass med innehåll, senaste veckan först', () => {
    expect(exportWeeks(notes())).toEqual([{ week: W47, sessions: 3 }, { week: W46, sessions: 1 }]);
  });

  it('exportClasses ger klasserna med ark de valda veckorna', () => {
    expect(exportClasses({ [W46]: { ...sheets(), '': sheets().Rosa } }, [W47])).toEqual(['Grund', 'Oliv', 'Rosa', '']);
    expect(exportClasses({ [W47]: sheets() }, [W46])).toEqual([]);
  });

  it('exportFileName och weekTitle', () => {
    expect(exportFileName([W47])).toBe('noteringar-v47.txt');
    expect(exportFileName([W47, W46])).toBe('noteringar-v46-v47.txt');
    expect(exportFileName([])).toBe('noteringar.txt');
    expect(weekTitle('w2026-53')).toBe('Vecka 53 · 28/12–3/1 2027');
  });
});
