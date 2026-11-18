import { describe, expect, it } from 'vitest';
import { DEFAULT_STAMPS, NotesStore, parseAttendance } from '@/utils/narvaro';
import {
  ExportInput,
  exportClasses,
  exportFileName,
  exportHtml,
  exportRows,
  exportText,
  exportWeeks,
  subjectOf,
  titleClass,
  weekTitle,
} from '@/utils/narvaroExport';
import { ME, sheets, week } from '@/utils/__fixtures__/narvaroSchedule';

// Vecka 47 år 2026 börjar måndag 16 november.
const W47 = 'w2026-47';
const W46 = 'w2026-46';
const note = (tags: string[], text = '') => ({ tags, note: text });

/** Ett ark med två skolor som rubriker. */
const schools = () => parseAttendance([
  ['', 'Måndag'],
  ['', '8.30-9.45'],
  ['NORR'],
  ['Norr Ett', 'TRUE'],
  ['SYD'],
  ['Syd Ett', 'TRUE'],
])!;

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
  tables: { [W46]: sheets(), [W47]: sheets() },
  notes: notes(),
  groups: {},
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
      'Måndag 16/11 · 10.00-11.30 · Rosa\nSchema: Tema Rosa · Kim · Rådhuset\nInnehåll: Historia: Historiebruk\n\n  Rosa Ett: Aktiv. Bra fråga\n  Delad Namnsson (Rosa)\n',
    );
  });

  it('ordnar passen efter datum och arkets kolumner, inte efter när de skrevs', () => {
    const text = exportText(input({ classes: ['Rosa'] }));
    expect(text.indexOf('8.30-9.45 · Rosa')).toBeGreaterThan(-1);
    expect(text.indexOf('8.30-9.45 · Rosa')).toBeLessThan(text.indexOf('10.00-11.30 · Rosa'));
  });

  it('delar ett pass med flera klasser i ett stycke per klass, med klassens eget schemapass', () => {
    const text = exportText(input({ classes: ['Oliv', 'Rosa'] }));
    expect(text).toContain('Måndag 16/11 · 10.00-11.30 · Oliv\nSchema: Tema Oliv · Sam\n\n  Oliv Ett: Tyst idag\n  Delad Namnsson (Oliv)\n');
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
    expect(text).toContain('Tisdag 17/11 · 12.30-14.30 · Grund\nSchema: Engelska 2 · Kim\n\n  Grund Ett: Läste högt\n  Grund Två\n');
    expect(text).not.toContain('Engelska 1');
  });

  it('visar alla parallella pass när inget är användarens', () => {
    const text = exportText(input({ classes: ['Grund'], myName: '' }));
    expect(text).toContain('Schema: Engelska 1 · Sam\nSchema: Engelska 2 · Kim\nSchema: Engelska Grund · Robin');
  });

  it('hoppar över schemats platshållare och skriver inga schemarader utan schema', () => {
    const text = exportText(input({ schedules: {} }));
    expect(text).not.toContain('Schema:');
    expect(text).toContain('Måndag 16/11 · 8.30-9.45 · Rosa\n\n  Rosa Ett: Utmärkte sig\n  Delad Namnsson (Rosa)\n');
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

  it('skriver alla i en lista utan uppdelning på skola', () => {
    const tables = { [W47]: { Rosa: schools() } };
    const store: NotesStore = {
      '2026-11-16|Måndag|B': { label: '', people: { 'Norr Ett': note(['aktiv']), 'Syd Ett': note(['tyst']) }, added: [] },
    };
    const text = exportText(input({ tables, notes: store, classes: ['Rosa'], schedules: {} }));
    expect(text).toContain('· Rosa\n\n  Norr Ett: Aktiv\n  Syd Ett: Tyst idag\n');
    expect(text).not.toContain('NORR');
  });

  it('skriver grupperna var för sig med en tom rad mellan, och de utan grupp sist', () => {
    const store: NotesStore = {
      '2026-11-16|Måndag|B': {
        label: '',
        people: { 'Grund Ett': note(['aktiv']), 'Grund Två': note(['tyst']), 'Rosa Ett': note(['star']), 'Oliv Ett': note(['stod']) },
        added: [],
      },
    };
    const groups = {
      // Grund och Rosa delades in tillsammans; en tom grupp hoppas över.
      '2026-11-16|Måndag|B#Grund+Rosa': { groups: [['Rosa Ett', 'Grund Två', 'Delad Namnsson (Rosa)'], [], ['Grund Ett']] },
    };
    const text = exportText(input({ notes: store, groups, schedules: {} }));
    expect(text).toContain(
      'Måndag 16/11 · 8.30-9.45 · Grund, Rosa\n\n  Rosa Ett: Utmärkte sig\n  Grund Två: Tyst idag\n  Delad Namnsson (Rosa)\n\n  Grund Ett: Aktiv\n',
    );
    expect(text).toContain('Måndag 16/11 · 8.30-9.45 · Oliv\n\n  Oliv Ett: Behöver stöd\n  Delad Namnsson (Oliv)\n');
    // Bara Rosa vald: gruppernas ordning gäller, utan Grund.
    const rosa = exportText(input({ notes: store, groups, schedules: {}, classes: ['Rosa'] }));
    expect(rosa).toContain('· Rosa\n\n  Rosa Ett: Utmärkte sig\n  Delad Namnsson (Rosa)\n');
    expect(rosa).not.toContain('Grund Två');
  });

  it('lägger den som saknar grupp sist, efter en tom rad, och visar båda klassernas schemapass', () => {
    const store: NotesStore = {
      '2026-11-16|Måndag|C': { label: '', people: { 'Rosa Ett': note(['aktiv']), 'Oliv Ett': note(['tyst']) }, added: [] },
    };
    const groups = { '2026-11-16|Måndag|C#Oliv+Rosa': { groups: [['Oliv Ett']] } };
    const text = exportText(input({ notes: store, groups, myName: '' }));
    expect(text).toContain('· Oliv, Rosa\nSchema: Tema Oliv · Sam\nSchema: Tema Rosa · Kim · Rådhuset\nInnehåll: Historia: Historiebruk\n\n  Oliv Ett: Tyst idag\n\n  Delad Namnsson (Oliv)\n  Rosa Ett: Aktiv\n  Delad Namnsson (Rosa)\n');
  });

  it('tar med närvarande utan notering, men inte de som inte är kryssade', () => {
    const table = parseAttendance([
      ['', 'Måndag', ''],
      ['', '8.30-9.45', '10.00-11.30'],
      ['Med Notering', 'TRUE', 'TRUE'],
      ['Bara Närvarande', 'TRUE', 'FALSE'],
      ['Borta', 'FALSE', 'TRUE'],
      ['Tillagd', 'FALSE', 'FALSE'],
    ])!;
    const store: NotesStore = {
      '2026-11-16|Måndag|B': { label: '', people: { 'Med Notering': note(['aktiv']) }, added: ['Tillagd'] },
    };
    const text = exportText(input({ tables: { [W47]: { Rosa: table } }, notes: store, classes: ['Rosa'], schedules: {} }));
    expect(text).toContain('· Rosa\n\n  Med Notering: Aktiv\n  Bara Närvarande\n  Tillagd\n');
    expect(text).not.toContain('Borta');
  });

  it('säger när kryssen kommer ur en äldre veckas ark', () => {
    const text = exportText(input({ tables: { [W46]: sheets() }, classes: ['Rosa'], schedules: {} }));
    expect(text).toContain('Måndag 16/11 · 8.30-9.45 · Rosa\nNärvaro enligt arket från v. 46\n\n  Rosa Ett: Utmärkte sig');
    expect(exportText(input({ classes: ['Rosa'] }))).not.toContain('Närvaro enligt arket');
  });

  it('ger tom text när inget finns att exportera', () => {
    expect(exportText(input({ weeks: ['w2026-40'] }))).toBe('');
    expect(exportText(input({ classes: [] , notes: { '2026-11-16|Måndag|B': notes()['2026-11-16|Måndag|B'] } }))).toBe('');
  });
});

describe('exportHtml', () => {
  it('gör veckan till rubrik 1 och passet till rubrik 2, med kursivt schema och namn i fetstil', () => {
    const html = exportHtml(input({ classes: ['Rosa'] }));
    expect(html).toContain('<p><b>Noteringar från Närvarorutor</b><br>Klasser: Rosa<br>Exporterad 2026-11-20</p>');
    expect(html).toContain('<h1>Vecka 47 · 16/11–22/11 2026</h1>');
    expect(html).toContain(
      '<h2>Måndag 16/11 · 10.00-11.30 · Rosa</h2><p><i>Schema: Tema Rosa · Kim · Rådhuset<br>Innehåll: Historia: Historiebruk</i></p>'
      + '<p><b>Rosa Ett</b>: Aktiv. Bra fråga<br><b>Delad Namnsson (Rosa)</b></p>',
    );
  });

  it('skriver varje grupp som ett eget stycke och hoppar över schemat när det saknas', () => {
    const store: NotesStore = {
      '2026-11-16|Måndag|B': { label: '', people: { 'Grund Ett': note(['aktiv']) }, added: [] },
    };
    const groups = { '2026-11-16|Måndag|B#Grund': { groups: [['Grund Två'], ['Grund Ett']] } };
    const html = exportHtml(input({ notes: store, groups, classes: ['Grund'], schedules: {} }));
    expect(html).toContain('· Grund</h2><p><b>Grund Två</b></p><p><b>Grund Ett</b>: Aktiv</p>');
  });

  it('skyddar tecken som annars blir taggar', () => {
    const store: NotesStore = {
      '2026-11-16|Måndag|B': { label: '', people: { 'Rosa Ett': note([], 'a < b & "c" <script>') }, added: [] },
    };
    const html = exportHtml(input({ notes: store, classes: ['Rosa'] }));
    expect(html).toContain('<b>Rosa Ett</b>: a &lt; b &amp; &quot;c&quot; &lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('är tom när inget finns att exportera', () => {
    expect(exportHtml(input({ weeks: ['w2026-40'] }))).toBe('');
  });
});

describe('exportRows', () => {
  /** Raderna som objekt efter kolumnernas namn. */
  const rowsOf = (over: Partial<ExportInput> = {}) => {
    const { columns, rows } = exportRows(input(over));
    return rows.map(r => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? null])));
  };

  it('har en kolumn per stämpel och noteringen sist', () => {
    const { columns } = exportRows(input());
    expect(columns.slice(0, 3)).toEqual(['Vecka', 'Datum', 'Dag']);
    expect(columns.slice(-5)).toEqual(['Aktiv', 'Utmärkte sig', 'Tyst idag', 'Behöver stöd', 'Notering']);
  });

  it('ger en rad per närvarande med schemats uppgifter och stämplarna var för sig', () => {
    const rows = rowsOf({ classes: ['Rosa'] });
    const c = rows.filter(r => r['Pass i arket'] === '10.00-11.30');
    expect(c.map(r => r.Elev)).toEqual(['Rosa Ett', 'Delad Namnsson']);
    expect(c[0]).toMatchObject({
      Vecka: 47,
      Datum: { date: '2026-11-16' },
      Dag: 'Måndag',
      Start: { time: 10 * 60 + 15 },
      Slut: { time: 11 * 60 + 30 },
      Klass: 'Rosa',
      Ämne: 'Historia',
      Schemapass: 'Tema Rosa',
      Lärare: 'Kim',
      Sal: 'Rådhuset',
      Innehåll: 'Historia: Historiebruk',
      Närvarande: 'Kryssad',
      Grupp: null,
      'Arkets vecka': null,
      Aktiv: 1,
      'Utmärkte sig': null,
      Notering: 'Bra fråga',
    });
    // Närvarande utan notering kommer med, utan klassen efter namnet.
    expect(c[1]).toMatchObject({ Klass: 'Rosa', Närvarande: 'Kryssad', Aktiv: null, Notering: '' });
  });

  it('ordnar raderna efter datum och arkets kolumner', () => {
    const rows = rowsOf({ classes: ['Rosa'] });
    expect(rows.map(r => r['Pass i arket'])).toEqual(['8.30-9.45', '8.30-9.45', '10.00-11.30', '10.00-11.30']);
  });

  it('tar ämnet ur titeln utan klassen när innehållet saknar kolon', () => {
    const oliv = rowsOf({ classes: ['Oliv'] }).find(r => r.Elev === 'Oliv Ett');
    expect(oliv).toMatchObject({ Ämne: 'Tema', Schemapass: 'Tema Oliv', Lärare: 'Sam', Innehåll: '' });
  });

  it('väljer det egna passet bland nivågrupperna, och Grund är ingen klass i "Ma Grund"', () => {
    expect(rowsOf({ classes: ['Grund'] }).find(r => r.Dag === 'Tisdag')).toMatchObject({ Ämne: 'Engelska 2', Schemapass: 'Engelska 2' });
    const store: NotesStore = {
      '2026-11-17|Tisdag|E': { label: '', people: { 'Grund Ett': note(['aktiv']) }, added: [] },
    };
    expect(rowsOf({ notes: store, classes: ['Grund'], myName: 'Sam' })[0]).toMatchObject({ Ämne: 'Ma Grund', Schemapass: 'Ma Grund', Start: { time: 615 } });
    // Inget av passen är användarens: alla, och platshållaren "." ger titeln.
    expect(rowsOf({ notes: store, classes: ['Grund'], myName: '' })[0]).toMatchObject({
      Ämne: 'Ma 1 / Ma Grund / Studieverkstad',
      Schemapass: 'Ma 1 / Ma Grund / Studieverkstad',
      Lärare: 'Robin, Kim, Sam, Alex',
    });
  });

  it('skiljer på kryssad, tillagd och bara notering', () => {
    const table = parseAttendance([
      ['', 'Måndag', ''],
      ['', '8.30-9.45', '10.00-11.30'],
      ['Med Notering', 'TRUE', 'TRUE'],
      ['Bara Närvarande', 'TRUE', 'FALSE'],
      ['Borta', 'FALSE', 'TRUE'],
      ['Inte Här', 'FALSE', 'FALSE'],
      ['Tillagd', 'FALSE', 'FALSE'],
    ])!;
    const store: NotesStore = {
      '2026-11-16|Måndag|B': { label: '', people: { 'Med Notering': note(['aktiv']), Borta: note([], 'Kom sent') }, added: ['Tillagd'] },
    };
    const rows = rowsOf({ tables: { [W47]: { Rosa: table } }, notes: store, classes: ['Rosa'], schedules: {} });
    expect(rows.map(r => [r.Elev, r.Närvarande])).toEqual([
      ['Med Notering', 'Kryssad'],
      ['Bara Närvarande', 'Kryssad'],
      ['Tillagd', 'Tillagd'],
      ['Borta', ''],
    ]);
    // Utan schema: arkets tid, inga schemauppgifter.
    expect(rows[0]).toMatchObject({ Start: { time: 510 }, Slut: { time: 585 }, Ämne: '', Schemapass: '' });
  });

  it('anger arkets vecka när kryssen kommer ur en äldre veckas ark', () => {
    const rows = rowsOf({ tables: { [W46]: sheets() }, classes: ['Rosa'] });
    expect(rows.every(r => r['Arkets vecka'] === 46)).toBe(true);
  });

  it('ger gruppens nummer, och inget för den som inte är med i någon grupp', () => {
    const store: NotesStore = {
      '2026-11-16|Måndag|B': { label: '', people: { 'Grund Ett': note(['aktiv']), 'Rosa Ett': note(['star']) }, added: [] },
    };
    const groups = { '2026-11-16|Måndag|B#Grund+Rosa': { groups: [['Rosa Ett', 'Grund Två'], [], ['Grund Ett']] } };
    const rows = rowsOf({ notes: store, groups, classes: ['Grund', 'Rosa'] });
    expect(rows.map(r => [r.Elev, r.Klass, r.Grupp])).toEqual([
      ['Rosa Ett', 'Rosa', 1],
      ['Grund Två', 'Grund', 1],
      ['Grund Ett', 'Grund', 3],
      ['Delad Namnsson', 'Rosa', null],
    ]);
  });

  it('ger varje rad elevens egen klass pass när klasser delats in i grupper tillsammans', () => {
    const store: NotesStore = {
      '2026-11-16|Måndag|C': { label: '', people: { 'Rosa Ett': note(['aktiv']), 'Oliv Ett': note(['tyst']) }, added: [] },
    };
    const groups = { '2026-11-16|Måndag|C#Oliv+Rosa': { groups: [['Oliv Ett'], ['Rosa Ett']] } };
    const rows = rowsOf({ notes: store, groups, classes: ['Oliv', 'Rosa'] });
    expect(rows.find(r => r.Elev === 'Oliv Ett')).toMatchObject({ Klass: 'Oliv', Schemapass: 'Tema Oliv', Ämne: 'Tema', Lärare: 'Sam', Grupp: 1 });
    expect(rows.find(r => r.Elev === 'Rosa Ett')).toMatchObject({ Klass: 'Rosa', Schemapass: 'Tema Rosa', Ämne: 'Historia', Lärare: 'Kim', Grupp: 2 });
  });

  it('tar med namn utan ark som Okänd klass, och inte pass utan noteringar', () => {
    const store: NotesStore = {
      '2026-11-16|Måndag|B': { label: '', people: { 'Flyttad Elev': note([], 'Slutade') }, added: [] },
      '2026-11-18|Onsdag|H': { label: '', people: { 'Rosa Ett': note([]) }, added: [] },
    };
    const rows = rowsOf({ notes: store, classes: ['Rosa'] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ Elev: 'Flyttad Elev', Klass: 'Okänd klass', Schemapass: '', Närvarande: '', Notering: 'Slutade' });
  });

  it('ger ett heldagspass schemats tider', () => {
    const store: NotesStore = {
      '2026-11-19|Torsdag|dag': { label: '', people: { 'Rosa Ett': note(['aktiv']) }, added: [] },
    };
    const row = rowsOf({ notes: store, classes: ['Rosa'], schedules: { [W47]: week({ studiebesok: true }) } })[0];
    expect(row).toMatchObject({
      'Pass i arket': 'Hela dagen',
      Start: { time: 510 },
      Slut: { time: 930 },
      Schemapass: 'Studiebesök i Malmö',
      Ämne: 'Studiebesök i Malmö',
    });
  });

  it('är tom när inget finns att exportera', () => {
    expect(exportRows(input({ weeks: ['w2026-40'] })).rows).toEqual([]);
  });
});

describe('ämne och klass ur schemat', () => {
  it('titleClass är ordet efter Tema', () => {
    expect(titleClass('Tema Rosa')).toBe('Rosa');
    expect(titleClass('  tema   Oliv ')).toBe('Oliv');
    expect(titleClass('Tema')).toBe('');
    expect(titleClass('Engelska Grund')).toBe('');
  });

  it('subjectOf tar texten före kolonet, annars titeln utan klassen', () => {
    expect(subjectOf('Tema Rosa', 'Historia: Historiebruk')).toBe('Historia');
    expect(subjectOf('Tema Rosa', 'Film: Lost in Translation + filmsamtal')).toBe('Film');
    expect(subjectOf('Tema Rosa', 'Historia:')).toBe('Historia');
    expect(subjectOf('Tema Rosa', 'Medea')).toBe('Tema');
    expect(subjectOf('Tema Rosa', 'https://exempel.se/x')).toBe('Tema');
    expect(subjectOf('Tema Rosa', 'En mening som är längre än trettio tecken: x')).toBe('Tema');
    expect(subjectOf('Engelska Grund', '')).toBe('Engelska Grund');
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
    expect(exportFileName([W47], 'xlsx')).toBe('noteringar-v47.xlsx');
    expect(exportFileName([])).toBe('noteringar.txt');
    expect(weekTitle('w2026-53')).toBe('Vecka 53 · 28/12–3/1 2027');
  });
});
