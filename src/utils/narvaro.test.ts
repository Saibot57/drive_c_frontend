// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  cleanClassName,
  combineSheets,
  groupsKey,
  isConfident,
  normalizeSessionKey,
  suggestClass,
  dateForDay,
  defaultDay,
  defaultPass,
  gridFromHtml,
  gridFromText,
  groupCount,
  groupView,
  historyKeys,
  isoWeek,
  moveToGroup,
  parseAttendance,
  parsePasted,
  passTime,
  randomGroups,
  roster,
  sanitizeGroups,
  sanitizeNotes,
  sanitizeStamps,
  sanitizeTable,
  sessionKey,
  sessionText,
  setPersonNote,
  toggleStamp,
  trimSessions,
  emptySession,
  DEFAULT_STAMPS,
} from '@/utils/narvaro';
import { exampleTable } from '@/utils/narvaroExample';

/** Som arket: A1:A2 sammanslagna, dagarna sammanslagna över sina pass. */
const cb = (v: number | boolean) => `<td data-sheets-value='{"1":4,"4":${v}}'></td>`;
const person = (name: string, marks: (number | boolean)[]) => `<tr><td>${name}</td>${marks.map(cb).join('')}</tr>`;
const SHEET_HTML = `<google-sheets-html-origin><table><tbody>
  <tr><td rowspan="2">Namn</td><td colspan="3">Måndag</td><td colspan="3">Tisdag</td></tr>
  <tr><td>8.30-9.45</td><td>10.00-11.30</td><td>Studieverkstad</td><td>8.30-9.45</td><td>Studieverkstad</td><td>Studieverkstad</td></tr>
  <tr><td colspan="7">TORA VEGA</td></tr>
  ${person('Test Person', [1, 0, 1, 0, 0, 1])}
  ${person('Annan Person', [false, true, true, true, false, false])}
  <tr><td colspan="7">ÖSTRA GREVIE</td></tr>
  ${person('Tredje Person', [1, 1, 1, 1, 1, 1])}
</tbody></table>`;

// Onsdag 4 november 2026, 10.15.
const WED = new Date(2026, 10, 4, 10, 15);

describe('inläsning', () => {
  it('läser HTML från arket med sammanslagna celler', () => {
    const table = parseAttendance(gridFromHtml(SHEET_HTML));
    expect(table).not.toBeNull();
    expect(table!.groups).toEqual(['TORA VEGA', 'ÖSTRA GREVIE']);
    expect(table!.days).toEqual(['Måndag', 'Tisdag']);
    expect(table!.cols.map(c => `${c.letter}:${c.day}:${c.pass}`)).toEqual([
      'B:Måndag:8.30-9.45', 'C:Måndag:10.00-11.30', 'D:Måndag:Studieverkstad',
      'E:Tisdag:8.30-9.45', 'F:Tisdag:Studieverkstad', 'G:Tisdag:Studieverkstad',
    ]);
    expect(table!.people[0]).toMatchObject({ name: 'Test Person', group: 'TORA VEGA' });
    expect(table!.people[0].marks.slice(1)).toEqual([true, false, true, false, false, true]);
    expect(table!.people[2].group).toBe('ÖSTRA GREVIE');
  });

  it('läser tabbseparerad text med SANT och FALSKT', () => {
    const text = [
      '\tMåndag\t\tTisdag',
      '\t8.30-9.45\t10.00-11.30\t8.30-9.45',
      'KLASS A',
      'Ett Namn\tSANT\tFALSKT\tSANT',
    ].join('\n');
    const table = parsePasted(text, '');
    expect(table!.cols.map(c => c.day)).toEqual(['Måndag', 'Måndag', 'Tisdag']);
    expect(table!.people[0].marks.slice(1)).toEqual([true, false, true]);
  });

  it('klarar citerade celler med radbrytning', () => {
    expect(gridFromText('a\t"två\nrader"\tc\nd')).toEqual([['a', 'två\nrader', 'c'], ['d']]);
    expect(gridFromText('"säger ""hej"""\tx')).toEqual([['säger "hej"', 'x']]);
  });

  it('hoppar över lösa kryssrutor utanför tabellen', () => {
    const text = [
      '\tMåndag\t',
      '\t8.30-9.45\t10.00-11.30\t\t',
      'TORA VEGA',
      'Ett Namn\tTRUE\tFALSE\tFALSE\tFALSE',
      'Två Namn\tFALSE\tTRUE',
    ].join('\n');
    const table = parsePasted(text, '')!;
    expect(table.cols.map(c => c.pass)).toEqual(['8.30-9.45', '10.00-11.30']);
  });

  it('namnger kolumnerna efter bokstaven när arket saknar passrad', () => {
    expect(parsePasted('Namn\tTRUE\tFALSE', '')!.cols.map(c => c.pass)).toEqual(['Kolumn B', 'Kolumn C']);
  });

  it('ger null när det inte finns några kryssrutor', () => {
    expect(parsePasted('hej\tdå\nfoo\tbar', '')).toBeNull();
    expect(parsePasted('', '<p>ingen tabell</p>')).toBeNull();
  });

  it('faller tillbaka på texten när HTML:en inte går att läsa', () => {
    expect(parsePasted('\tMåndag\nNamn\tTRUE', '<p>bild</p>')!.people).toHaveLength(1);
  });

  it('läser tiden i passnamnet', () => {
    expect(passTime('8.30-9.45')).toEqual([510, 585]);
    expect(passTime('12:30 – 14:30')).toEqual([750, 870]);
    expect(passTime('Studieverkstad')).toBeNull();
  });
});

describe('datum och urval', () => {
  const table = parseAttendance(gridFromHtml(SHEET_HTML))!;

  it('räknar veckonummer och dagens datum i veckan', () => {
    expect(isoWeek(WED)).toBe(45);
    expect(dateForDay('Måndag', WED).getDate()).toBe(2);
    // Söndag räknas till samma vecka som måndagen före.
    expect(dateForDay('Måndag', new Date(2026, 10, 8)).getDate()).toBe(2);
  });

  it('väljer dagens veckodag om den finns, annars den första', () => {
    expect(defaultDay(table, new Date(2026, 10, 3))).toBe('Tisdag');
    expect(defaultDay(table, WED)).toBe('Måndag');
  });

  it('väljer passet som pågår, annars det senaste med kryss', () => {
    const tue = new Date(2026, 10, 3, 8, 25);
    expect(defaultPass(table, 'Tisdag', tue)).toBe('c4');
    expect(defaultPass(table, 'Måndag', WED)).toBe('c3');
  });

  it('räknar närvarande per pass, klass och tillagda', () => {
    const sel = { klass: 'all', day: 'Måndag', pass: 'c1', added: [] as string[] };
    expect(roster(table, sel).present.map(p => p.name)).toEqual(['Test Person', 'Tredje Person']);
    expect(roster(table, { ...sel, klass: 'TORA VEGA' }).absent.map(p => p.name)).toEqual(['Annan Person']);
    expect(roster(table, { ...sel, added: ['Annan Person'] }).present).toHaveLength(3);
    expect(roster(table, { ...sel, pass: 'day' }).present).toHaveLength(3);
  });

  it('ger olika nycklar för pass med samma namn', () => {
    expect(sessionKey(table, 'Tisdag', 'c5', WED)).not.toBe(sessionKey(table, 'Tisdag', 'c6', WED));
    expect(sessionKey(table, 'Måndag', 'day', WED)).toBe('2026-11-02|Måndag|dag');
    expect(sessionKey(table, 'Tisdag', 'c5', WED)).toBe('2026-11-03|Tisdag|F');
  });
});

describe('klasser', () => {
  const rosa = parseAttendance(gridFromHtml(SHEET_HTML))!;
  const grund = parsePasted([
    '\tMåndag\t\t\tTisdag',
    '\t8.30-9.45\t10.00-11.45\tStudieverkstad\t8.30-9.45',
    'TORA VEGA',
    'Ny Elev\tTRUE\tFALSE\tFALSE\tTRUE',
    'Test Person\tFALSE\tTRUE\tFALSE\tFALSE',
  ].join('\n'), '')!;

  it('visar flera klasser som en tabell, med pass ihopparade efter kolumn', () => {
    const both = combineSheets({ Rosa: rosa, Grund: grund }, ['Rosa', 'Grund']);
    expect(both.cols.map(c => `${c.letter}:${c.pass}`)).toEqual([
      'B:8.30-9.45', 'C:10.00-11.30', 'D:Studieverkstad', 'E:8.30-9.45', 'F:Studieverkstad', 'G:Studieverkstad',
    ]);
    expect(both.people.map(p => `${p.name}/${p.klass}`)).toEqual([
      'Test Person (Rosa)/Rosa', 'Annan Person/Rosa', 'Tredje Person/Rosa', 'Ny Elev/Grund', 'Test Person (Grund)/Grund',
    ]);
    const sel = { klass: 'all', day: 'Måndag', pass: 'c1', added: [] as string[] };
    expect(roster(both, sel).present.map(p => p.name)).toEqual(['Test Person (Rosa)', 'Tredje Person', 'Ny Elev']);
  });

  it('visar bara de valda klasserna', () => {
    const one = combineSheets({ Rosa: rosa, Grund: grund }, ['Grund']);
    expect(one.people.map(p => p.klass)).toEqual(['Grund', 'Grund']);
    expect(one.cols).toHaveLength(4);
  });

  it('föreslår klassen vars namn känns igen', () => {
    expect(suggestClass(rosa, { Rosa: rosa, Grund: grund })).toEqual({ klass: 'Rosa', matched: 3, total: 3 });
    expect(isConfident(suggestClass(rosa, { Grund: grund }))).toBe(false);
    expect(suggestClass(rosa, { '': rosa })).toBeNull();
  });

  it('håller grupper isär per kombination av klasser', () => {
    expect(groupsKey('2026-11-02|Måndag|B', ['Rosa', 'Grund'])).toBe(groupsKey('2026-11-02|Måndag|B', ['Grund', 'Rosa']));
    expect(groupsKey('2026-11-02|Måndag|B', ['Rosa'])).not.toBe(groupsKey('2026-11-02|Måndag|B', ['Rosa', 'Grund']));
  });

  it('rensar klassnamn från tecknen som skiljer nycklarna åt', () => {
    expect(cleanClassName('  Rosa + Grund#1 ')).toBe('Rosa Grund 1');
  });
});

describe('anteckningar', () => {
  const table = parseAttendance(gridFromHtml(SHEET_HTML))!;

  it('sätter och tar bort stämplar', () => {
    let s = toggleStamp(emptySession('x'), 'Test Person', 'aktiv');
    expect(s.people['Test Person'].tags).toEqual(['aktiv']);
    s = toggleStamp(s, 'Test Person', 'aktiv');
    expect(s.people['Test Person']).toBeUndefined();
  });

  it('skriver passet som text per klass', () => {
    let s = toggleStamp(emptySession('Måndag 2/11 · 8.30-9.45'), 'Test Person', 'aktiv');
    s = setPersonNote(s, 'Tredje Person', { tags: ['stod'], note: 'frågade om uppsatsen' });
    expect(sessionText(s, table, DEFAULT_STAMPS)).toBe([
      'Måndag 2/11 · 8.30-9.45', '', 'TORA VEGA', 'Test Person: Aktiv', '', 'ÖSTRA GREVIE',
      'Tredje Person: Behöver stöd. frågade om uppsatsen',
    ].join('\n'));
  });

  it('listar tidigare pass med noteringar, senaste först', () => {
    const withNote = setPersonNote(emptySession('a'), 'X', { tags: [], note: 'hej' });
    const store = { '2026-11-02|a': withNote, '2026-11-03|b': withNote, '2026-11-04|c': emptySession('c'), now: withNote };
    expect(historyKeys(store, 'now')).toEqual(['2026-11-03|b', '2026-11-02|a']);
  });
});

describe('grupper', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  it('räknar antal grupper', () => {
    expect(groupCount('count', 4, 7)).toBe(4);
    expect(groupCount('count', 10, 3)).toBe(3);
    expect(groupCount('size', 3, 7)).toBe(2);
    expect(groupCount('size', 3, 0)).toBe(1);
  });

  it('delar alla i jämna grupper', () => {
    const groups = randomGroups(names, 3);
    expect(groups.map(g => g.length).sort()).toEqual([2, 2, 3]);
    expect(groups.flat().sort()).toEqual(names);
  });

  it('sprider de med stämpeln över grupperna', () => {
    const spread = new Set(['A', 'B', 'C']);
    for (let i = 0; i < 20; i++) {
      randomGroups(names, 3, spread).forEach(g => expect(g.filter(n => spread.has(n))).toHaveLength(1));
    }
  });

  it('visar bara närvarande och lägger de utan grupp i poolen', () => {
    expect(groupView([['A', 'B'], ['C', 'X']], ['A', 'B', 'C', 'D'])).toEqual({ groups: [['A', 'B'], ['C']], pool: ['D'] });
  });

  it('flyttar ett namn mellan grupper och till poolen', () => {
    const start = [['A', 'B'], ['C']];
    expect(moveToGroup(start, 'A', 1)).toEqual([['B'], ['C', 'A']]);
    expect(moveToGroup(start, 'A', 'pool')).toEqual([['B'], ['C']]);
    expect(start).toEqual([['A', 'B'], ['C']]);
  });

  it('rensar de äldsta passen', () => {
    expect(Object.keys(trimSessions({ '2026-01-03': 1, '2026-01-01': 1, '2026-01-02': 1 }, 2))).toEqual(['2026-01-03', '2026-01-02']);
  });
});

describe('lagring', () => {
  it('för över äldre passnycklar med passets namn', () => {
    expect(normalizeSessionKey('2026-11-04|Onsdag|G|Studieverkstad')).toBe('2026-11-04|Onsdag|G');
    expect(normalizeSessionKey('2026-11-04|Onsdag|dag|')).toBe('2026-11-04|Onsdag|dag');
    const merged = sanitizeNotes({
      '2026-11-04|Onsdag|G|Studieverkstad': { label: 'a', people: { A: { tags: ['x'], note: '' } } },
      '2026-11-04|Onsdag|G': { label: 'b', people: { B: { tags: [], note: 'hej' } } },
    });
    expect(Object.keys(merged)).toEqual(['2026-11-04|Onsdag|G']);
    expect(Object.keys(merged['2026-11-04|Onsdag|G'].people).sort()).toEqual(['A', 'B']);
  });

  it('läser gamla eller trasiga data utan att krascha', () => {
    expect(sanitizeTable(null)).toBeNull();
    expect(sanitizeTable({ people: [{ name: 'A', marks: [null, true, 'x'] }], cols: [{ index: 1, day: 'Måndag' }] }))
      .toMatchObject({ people: [{ name: 'A', group: '', marks: [null, true, null] }], days: ['Måndag'] });
    expect(sanitizeNotes({ k: { people: { A: { tags: ['a', 3] } } }, bad: 4 }))
      .toEqual({ k: { label: '', people: { A: { tags: ['a'], note: '' } }, added: [] } });
    expect(sanitizeStamps('x')).toEqual(DEFAULT_STAMPS);
    expect(sanitizeStamps([{ id: 'a', label: 'Egen', color: 'röd', custom: true }]))
      .toEqual([{ id: 'a', label: 'Egen', color: 'grey', custom: true }]);
    expect(sanitizeGroups({ 'k#Rosa': { groups: [['A', 1]] }, x: 2, gammal: { groups: [['A']] } }))
      .toEqual({ 'k#Rosa': { groups: [['A']] } });
  });

  it('exemplet går att läsa och sparas oförändrat', () => {
    const ex = exampleTable();
    expect(ex.people).toHaveLength(22);
    expect(ex.groups).toEqual(['KLASS A', 'KLASS B']);
    expect(sanitizeTable(JSON.parse(JSON.stringify(ex)))).toEqual(ex);
  });
});
