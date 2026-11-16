import { describe, expect, it } from 'vitest';
import type { PlannerArchiveSummary, ScheduledEntry } from '@/types/schedule';
import { AttendanceColumn, combineSheets, dayColumns, emptySession } from '@/utils/narvaro';
import {
  archiveForWeek,
  effectiveScheduleName,
  entriesForChoice,
  entriesForClasses,
  entriesForColumn,
  entriesForDay,
  entryClasses,
  isClassDivided,
  isMine,
  isPlaceholderNote,
  myClassesNow,
  sanitizeScheduleName,
  scheduleLineParts,
  sessionClasses,
  sortForDisplay,
  targetForEntry,
} from '@/utils/narvaroSchedule';
import { CLASSES, ME, sheet, sheets, week } from '@/utils/__fixtures__/narvaroSchedule';

const table = sheet(['Elev Ett']);
const colByLetter = (letter: string): AttendanceColumn => {
  const col = table.cols.find(c => c.letter === letter);
  if (!col) throw new Error(`Ingen kolumn ${letter}`);
  return col;
};
const matched = (letter: string, entries = week()) => {
  const col = colByLetter(letter);
  return entriesForColumn(col, dayColumns(table, col.day), entries.filter(e => e.day === col.day));
};
const times = (entries: ScheduledEntry[]) => Array.from(new Set(entries.map(e => `${e.startTime}–${e.endTime}`)));
const titles = (entries: ScheduledEntry[]) => entries.map(e => e.title);
const has = (entries: ScheduledEntry[], title: string, start: string) =>
  entries.some(e => e.title === title && e.startTime === start);

const archive = (id: string, name: string, extra: Partial<PlannerArchiveSummary> = {}): PlannerArchiveSummary => ({
  id, name, ownerId: 'u1', ownerUsername: null, isOwner: true, sharedWith: [], lock: null, updatedAt: '2026-11-01', kind: 'week', ...extra,
});

describe('archiveForWeek', () => {
  it('väljer veckans schema på namnet', () => {
    const list = [archive('a45', 'v. 45'), archive('a47', 'v. 47'), archive('b47', 'v. 47 bas', { kind: 'base' })];
    expect(archiveForWeek('w2026-47', list)).toBe('a47');
    expect(archiveForWeek('w2026-46', list)).toBeNull();
  });
  it('egna före delade', () => {
    const list = [archive('delad', 'v. 47', { isOwner: false, updatedAt: '2026-11-15' }), archive('egen', 'v.47')];
    expect(archiveForWeek('w2026-47', list)).toBe('egen');
  });
  it('en nyckel som inte är en vecka ger null', () => {
    expect(archiveForWeek('settings', [archive('a', 'v. 47')])).toBeNull();
  });
});

describe('entriesForColumn (tabellen i avsnitt 5)', () => {
  it('Mån B 8.30-9.45 får 08:30–10:00', () => {
    expect(times(matched('B'))).toEqual(['08:30–10:00']);
    expect(titles(matched('B'))).toEqual(['Tema Grund', 'Tema Oliv', 'Tema Rosa']);
  });
  it('Mån C 10.00-11.30 får 10:15–11:30 men inte pausen 10:00–10:15', () => {
    expect(has(matched('C'), 'Paus', '10:00')).toBe(false);
    expect(times(matched('C'))).toEqual(['10:15–11:30']);
  });
  it('Tor K 8.30-10.00 får 08:30–09:45 men inte 10:00–11:30', () => {
    expect(times(matched('K'))).toEqual(['08:30–09:45']);
  });
  it('Tor L 10.15-11.45 får 10:00–11:30 men inte lunchen', () => {
    expect(times(matched('L'))).toEqual(['10:00–11:30']);
    expect(has(matched('L'), 'Lunch', '11:30')).toBe(false);
  });
  it('Fre Q 12.30-14.30 får 12:30–14:00 men inte Ma2 14:15', () => {
    expect(times(matched('Q'))).toEqual(['12:30–14:00']);
    expect(has(matched('Q'), 'Ma2', '14:15')).toBe(false);
  });
  it('Tis E, första Studieverkstad, får 10:15 med Ma 1 och Ma Grund', () => {
    const got = matched('E');
    expect(times(got)).toEqual(['10:15–11:45']);
    expect(titles(got).sort()).toEqual(['Ma 1', 'Ma Grund', 'Studieverkstad']);
  });
  it('Tis G, andra Studieverkstad, får 14:45', () => {
    expect(times(matched('G'))).toEqual(['14:45–15:45']);
  });
  it('Tor N och Fre O, Studieverkstad, får dagens pass med namnet', () => {
    expect(times(matched('N'))).toEqual(['14:45–15:45']);
    expect(times(matched('O'))).toEqual(['08:30–09:30']);
  });
  it('en kolumn utan tid utan n:te pass med namnet får inga pass', () => {
    expect(matched('N', week({ studiebesok: true }))).toEqual([]);
  });
  it('namnet jämförs utan versaler och extra blanksteg', () => {
    const entries = week().map(e => (e.title === 'Studieverkstad' ? { ...e, title: '  studie verkstad ' } : e));
    expect(matched('E', entries)).toEqual([]);
    const spaced = week().map(e => (e.title === 'Studieverkstad' ? { ...e, title: ' STUDIEVERKSTAD  ' } : e));
    expect(times(matched('E', spaced))).toEqual(['10:15–11:45']);
  });
  it('v. 47: varje torsdagskolumn med tid får studiebesöket', () => {
    ['K', 'L', 'M'].forEach(letter => {
      expect(titles(matched(letter, week({ studiebesok: true })))).toEqual(['Studiebesök i Malmö']);
    });
  });
});

describe('entriesForDay', () => {
  const dayFor = (day: string, entries = week()) =>
    entriesForDay(dayColumns(table, day), entries.filter(e => e.day === day));
  it('v. 47: hela torsdagen får studiebesöket', () => {
    expect(titles(dayFor('Torsdag', week({ studiebesok: true })))).toEqual(['Studiebesök i Malmö']);
  });
  it('en vanlig dag har inget heldagspass', () => {
    expect(dayFor('Måndag')).toEqual([]);
  });
  it('en dag utan kolumner med tid får inga pass', () => {
    const untimed = table.cols.filter(c => c.day === 'Tisdag' && !c.time);
    expect(entriesForDay(untimed, [{ ...week()[0], day: 'Tisdag', startTime: '08:00', endTime: '17:00' }])).toEqual([]);
  });
});

describe('entriesForChoice', () => {
  it('ger kolumnens pass eller hela dagens', () => {
    expect(times(entriesForChoice(table, 'Måndag', colByLetter('C').id, week()))).toEqual(['10:15–11:30']);
    expect(titles(entriesForChoice(table, 'Torsdag', 'day', week({ studiebesok: true })))).toEqual(['Studiebesök i Malmö']);
    expect(entriesForChoice(table, 'Måndag', 'finns-inte', week())).toEqual([]);
  });
});

describe('klasserna', () => {
  it('entryClasses tar hela ord utan hänsyn till versaler', () => {
    expect(entryClasses('Tema Rosa', CLASSES)).toEqual(['Rosa']);
    expect(entryClasses('TEMA OLIV/ROSA', CLASSES)).toEqual(['Oliv', 'Rosa']);
    expect(entryClasses('Grundkurs', CLASSES)).toEqual([]);
    expect(entryClasses('Ma 1', CLASSES)).toEqual([]);
  });
  it('å, ä och ö räknas som bokstäver', () => {
    expect(entryClasses('Tema Grön', ['Grön'])).toEqual(['Grön']);
    expect(entryClasses('Tema Grönt', ['Grön'])).toEqual([]);
    expect(entryClasses('Tema Rosa B', ['Rosa B'])).toEqual(['Rosa B']);
  });
  it('Tema ×3 är uppdelat på klass', () => {
    expect(isClassDivided(matched('B'), CLASSES)).toBe(true);
    expect(titles(entriesForClasses(matched('B'), CLASSES, ['Oliv']))).toEqual(['Tema Oliv']);
    expect(titles(entriesForClasses(matched('B'), CLASSES, ['Oliv', 'Rosa']))).toEqual(['Tema Oliv', 'Tema Rosa']);
  });
  it('Engelska ×3 är inte uppdelat, trots Engelska Grund', () => {
    expect(isClassDivided(matched('F'), CLASSES)).toBe(false);
    expect(titles(entriesForClasses(matched('F'), CLASSES, ['Oliv'])).sort()).toEqual(['Engelska 1', 'Engelska 2', 'Engelska Grund']);
  });
  it('ett ensamt pass utan klass är inte uppdelat och visas för alla', () => {
    expect(isClassDivided(matched('J'), CLASSES)).toBe(false);
    expect(titles(entriesForClasses(matched('J'), CLASSES, ['Grund']))).toEqual(['Onsdagsklubben']);
  });
  it('inga pass är inte uppdelat', () => {
    expect(isClassDivided([], CLASSES)).toBe(false);
  });
  it('uppdelat men ingen vald klass har pass: tomt', () => {
    expect(entriesForClasses(matched('B'), CLASSES, ['Annan'])).toEqual([]);
  });
});

describe('isMine', () => {
  const base = week()[0];
  const t = (teacher: string) => ({ ...base, teacher });
  it('namnet med blanksteg efter', () => expect(isMine(t('Kim  '), ME)).toBe(true));
  it('ett av flera namn', () => expect(isMine(t('Robin, Kim'), 'kim')).toBe(true));
  it('"Alla"', () => expect(isMine(t('Alla'), ME)).toBe(true));
  it('tomt lärarfält', () => expect(isMine(t(''), ME)).toBe(false));
  it('ett annat namn, eller ett namn som bara börjar likadant', () => {
    expect(isMine(t('Robin'), ME)).toBe(false);
    expect(isMine(t('Kimberly'), ME)).toBe(false);
  });
  it('tomt eget namn är aldrig någons', () => {
    expect(isMine(t('Kim'), '')).toBe(false);
    expect(isMine(t('Alla'), '  ')).toBe(false);
  });
  it('sortForDisplay sätter de egna först', () => {
    expect(titles(sortForDisplay(matched('F'), ME))).toEqual(['Engelska 2', 'Engelska 1', 'Engelska Grund']);
  });
});

describe('targetForEntry', () => {
  const s = sheets();
  const entries = week();
  const find = (day: string, title: string, start: string, list = entries) => {
    const hit = list.find(e => e.day === day && e.title === title && e.startTime === start);
    if (!hit) throw new Error(`Inget pass ${title}`);
    return hit;
  };
  it('temapass: klassen, dagen och kolumnen', () => {
    expect(targetForEntry(find('Måndag', 'Tema Rosa', '10:15'), s, CLASSES, entries))
      .toEqual({ day: 'Måndag', pass: colByLetter('C').id, classes: ['Rosa'] });
  });
  it('Engelska: alla klasser som har dagen', () => {
    expect(targetForEntry(find('Tisdag', 'Engelska Grund', '12:30'), s, CLASSES, entries))
      .toEqual({ day: 'Tisdag', pass: colByLetter('F').id, classes: CLASSES });
  });
  it('Ma 1 hamnar i den första Studieverkstad-kolumnen', () => {
    expect(targetForEntry(find('Tisdag', 'Ma 1', '10:15'), s, CLASSES, entries)?.pass).toBe(colByLetter('E').id);
    expect(targetForEntry(find('Tisdag', 'Ma 1', '14:45'), s, CLASSES, entries)?.pass).toBe(colByLetter('G').id);
  });
  it('Lunch, Paus och APT går inte att klicka på', () => {
    expect(targetForEntry(find('Måndag', 'Lunch', '11:30'), s, CLASSES, entries)).toBeNull();
    expect(targetForEntry(find('Måndag', 'Paus', '10:00'), s, CLASSES, entries)).toBeNull();
    expect(targetForEntry(find('Måndag', 'APT', '14:15'), s, CLASSES, entries)).toBeNull();
  });
  it('studiebesöket över hela dagen blir hela dagen för alla klasser', () => {
    const v47 = week({ studiebesok: true });
    expect(targetForEntry(find('Torsdag', 'Studiebesök i Malmö', '08:30', v47), s, CLASSES, v47))
      .toEqual({ day: 'Torsdag', pass: 'day', classes: CLASSES });
  });
  it('åt andra hållen: kolumnens pass innehåller passet som klicket valde', () => {
    const entry = find('Fredag', 'Tema Oliv', '12:30');
    const target = targetForEntry(entry, s, CLASSES, entries)!;
    const shown = entriesForClasses(entriesForChoice(combineSheets(s, target.classes), target.day, target.pass, entries), CLASSES, target.classes);
    expect(shown.map(e => e.instanceId)).toEqual([entry.instanceId]);
  });
  it('bara klasser med dagen', () => {
    const partial = { ...s, Grund: { ...s.Grund, cols: s.Grund.cols.filter(c => c.day !== 'Tisdag') } };
    expect(targetForEntry(find('Tisdag', 'Engelska 1', '12:30'), partial, CLASSES, entries)?.classes).toEqual(['Oliv', 'Rosa']);
  });
});

describe('texten', () => {
  it('isPlaceholderNote', () => {
    expect(isPlaceholderNote(undefined)).toBe(true);
    expect(isPlaceholderNote('')).toBe(true);
    expect(isPlaceholderNote('.')).toBe(true);
    expect(isPlaceholderNote(' - . ')).toBe(true);
    expect(isPlaceholderNote('Historia: Historiebruk')).toBe(false);
    expect(isPlaceholderNote('1')).toBe(false);
  });
  it('scheduleLineParts med sal ur reglerna och utan platshållare', () => {
    const rosa = matched('C').find(e => e.title === 'Tema Rosa')!;
    expect(scheduleLineParts(rosa)).toEqual({ title: 'Tema Rosa', teachers: ['Kim'], room: 'Rådhuset', notes: 'Historia: Historiebruk' });
    const sv = matched('E').find(e => e.title === 'Studieverkstad')!;
    expect(scheduleLineParts(sv, (title, room) => room || (title === 'Studieverkstad' ? 'Biblioteket' : '')))
      .toEqual({ title: 'Studieverkstad', teachers: ['Alex'], room: 'Biblioteket', notes: '' });
  });
});

describe('sessionClasses', () => {
  const s = sheets();
  it('klasserna vars ark har namnen', () => {
    expect(sessionClasses({ ...emptySession(''), people: { 'Oliv Ett': { tags: ['a'], note: '' } } }, s)).toEqual(['Oliv']);
    expect(sessionClasses({ ...emptySession(''), added: ['Grund Två', 'Rosa Ett'] }, s)).toEqual(['Grund', 'Rosa']);
    expect(sessionClasses(emptySession(''), s)).toEqual([]);
  });
  it('två likadana namn i olika klasser hålls isär', () => {
    const people = { 'Delad Namnsson (Rosa)': { tags: [], note: 'x' } };
    expect(sessionClasses({ ...emptySession(''), people }, s)).toEqual(['Rosa']);
    const oliv = { 'Delad Namnsson (Oliv)': { tags: [], note: 'x' } };
    expect(sessionClasses({ ...emptySession(''), people: oliv }, s)).toEqual(['Oliv']);
  });
});

describe('myClassesNow', () => {
  const all = combineSheets(sheets(), CLASSES);
  it('måndag 10.20 i v. 47 väljer Rosa', () => {
    expect(myClassesNow(all, week(), CLASSES, ME, new Date(2026, 10, 16, 10, 20))).toEqual(['Rosa']);
  });
  it('mellan passen och efter skolan: inget', () => {
    expect(myClassesNow(all, week(), CLASSES, ME, new Date(2026, 10, 16, 12, 0))).toEqual([]);
    expect(myClassesNow(all, week(), CLASSES, ME, new Date(2026, 10, 16, 18, 0))).toEqual([]);
  });
  it('Engelska Grund tas inte för klassen Grund', () => {
    const swapped = week().map(e => (e.title === 'Engelska Grund' ? { ...e, teacher: 'Kim' } : e.title.startsWith('Engelska') ? { ...e, teacher: 'Sam' } : e));
    expect(myClassesNow(all, swapped, CLASSES, ME, new Date(2026, 10, 17, 13, 0))).toEqual([]);
  });
  it('"Alla" räknas inte, och utan namn händer inget', () => {
    expect(myClassesNow(all, week({ studiebesok: true }), CLASSES, ME, new Date(2026, 10, 19, 9, 0))).toEqual([]);
    expect(myClassesNow(all, week(), CLASSES, '', new Date(2026, 10, 16, 10, 20))).toEqual([]);
  });
  it('ett pass där användaren inte står: inget', () => {
    expect(myClassesNow(all, week(), CLASSES, 'Alex', new Date(2026, 10, 16, 10, 20))).toEqual([]);
  });
});

describe('namnet i schemat', () => {
  it('sanitizeScheduleName', () => {
    expect(sanitizeScheduleName('  Kim ')).toBe('Kim');
    expect(sanitizeScheduleName(42)).toBe('');
    expect(sanitizeScheduleName(null)).toBe('');
    expect(sanitizeScheduleName('x'.repeat(80))).toHaveLength(60);
  });
  it('effectiveScheduleName: det sparade, annars användarnamnet bland lärarna', () => {
    expect(effectiveScheduleName('Robin', 'kim', ['Kim', 'Robin'])).toBe('Robin');
    expect(effectiveScheduleName('', 'kim', ['Kim', 'Robin'])).toBe('Kim');
    expect(effectiveScheduleName('', 'Admin', ['Kim', 'Robin'])).toBe('');
    expect(effectiveScheduleName('', null, ['Kim'])).toBe('');
  });
});
