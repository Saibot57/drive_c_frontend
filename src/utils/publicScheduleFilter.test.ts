import { describe, expect, it } from 'vitest';
import { ScheduledEntry } from '@/types/schedule';
import {
  classifyPass,
  describeChoice,
  filterForParticipant,
  isMathOptionSelected,
  MathCourse,
  ParticipantChoice,
  sanitizeChoice,
  TEMA_OPTIONS,
  toggleMathOption,
} from '@/utils/publicScheduleFilter';
import { checkOverlap, timeToMinutes } from '@/utils/scheduleTime';

/**
 * Allmän kurs v. 40 så som den låg på den publika länken 23 sep 2026 — bara
 * dag, tid och titel. Stavningen är orörd, även "Ma  Grund" med två mellanslag.
 */
const V40: [string, string, string, string][] = [
  ['Måndag', '08:30', '09:45', "Tema Grund"],
  ['Måndag', '08:30', '09:45', "Tema Oliv"],
  ['Måndag', '08:30', '09:45', "Tema Rosa"],
  ['Måndag', '09:45', '10:00', "Paus"],
  ['Måndag', '10:00', '11:30', "Tema Grund"],
  ['Måndag', '10:00', '11:30', "Tema Oliv"],
  ['Måndag', '10:00', '11:30', "Tema Rosa"],
  ['Måndag', '11:30', '12:30', "Lunch"],
  ['Måndag', '12:30', '14:00', "Tema Grund"],
  ['Måndag', '12:30', '14:00', "Tema Oliv"],
  ['Måndag', '12:30', '14:00', "Tema Rosa"],
  ['Måndag', '14:00', '14:15', "Paus"],
  ['Tisdag', '10:15', '11:45', "Ma  Grund"],
  ['Tisdag', '10:15', '11:45', "Ma 1"],
  ['Tisdag', '10:15', '11:45', "Studieverkstad"],
  ['Tisdag', '11:45', '12:30', "Lunch"],
  ['Tisdag', '12:30', '14:30', "Tema Grund"],
  ['Tisdag', '12:30', '14:30', "Tema Oliv"],
  ['Tisdag', '12:30', '14:30', "Tema Rosa"],
  ['Tisdag', '14:30', '14:45', "Paus"],
  ['Tisdag', '14:45', '15:45', "Ma 1"],
  ['Tisdag', '14:45', '15:45', "Ma Grund"],
  ['Tisdag', '14:45', '15:45', "Studieverkstad"],
  ['Onsdag', '08:30', '09:45', "Tema Grund"],
  ['Onsdag', '08:30', '09:45', "Tema Oliv"],
  ['Onsdag', '08:30', '09:45', "Tema Rosa"],
  ['Onsdag', '09:45', '10:00', "Paus"],
  ['Onsdag', '10:00', '11:30', "Tema Grund"],
  ['Onsdag', '10:00', '11:30', "Tema Oliv"],
  ['Onsdag', '10:00', '11:30', "Tema Rosa"],
  ['Onsdag', '11:30', '12:30', "Lunch"],
  ['Onsdag', '12:30', '14:30', "Onsdagsklubben"],
  ['Onsdag', '14:30', '14:45', "Paus"],
  ['Onsdag', '14:45', '15:45', "Ma2 (tillval)"],
  ['Torsdag', '08:30', '09:45', "Tema Grund"],
  ['Torsdag', '08:30', '09:45', "Tema Oliv"],
  ['Torsdag', '08:30', '09:45', "Tema Rosa"],
  ['Torsdag', '09:45', '10:00', "Paus"],
  ['Torsdag', '10:00', '11:30', "Tema Grund"],
  ['Torsdag', '10:00', '11:30', "Tema Oliv"],
  ['Torsdag', '10:00', '11:30', "Tema Rosa"],
  ['Torsdag', '11:30', '12:30', "Lunch"],
  ['Torsdag', '12:30', '14:30', "Tema Grund"],
  ['Torsdag', '12:30', '14:30', "Tema Oliv"],
  ['Torsdag', '12:30', '14:30', "Tema Rosa"],
  ['Torsdag', '14:30', '14:45', "Paus"],
  ['Torsdag', '14:45', '15:45', "Studieverkstad"],
  ['Fredag', '08:30', '09:30', "Ma 1"],
  ['Fredag', '08:30', '09:30', "Ma Grund"],
  ['Fredag', '08:30', '09:30', "Studieverkstad"],
  ['Fredag', '09:30', '09:45', "Paus"],
  ['Fredag', '09:45', '11:45', "Tema Grund"],
  ['Fredag', '09:45', '11:45', "Tema Oliv"],
  ['Fredag', '09:45', '11:45', "Tema Rosa"],
  ['Fredag', '11:45', '12:30', "Lunch"],
  ['Fredag', '12:30', '14:30', "Tema Grund"],
  ['Fredag', '12:30', '14:30', "Tema Oliv"],
  ['Fredag', '12:30', '14:30', "Tema Rosa"],
  ['Fredag', '14:30', '14:45', "Paus"],
  ['Fredag', '14:45', '15:45', "Ma2 (tillval)"],
];

const toEntries = (rows: [string, string, string, string][]): ScheduledEntry[] =>
  rows.map(([day, startTime, endTime, title], index) => ({
    id: `pass-${index}`,
    instanceId: `pass-${index}`,
    title,
    teacher: '',
    room: '',
    color: '#ffffff',
    duration: timeToMinutes(endTime) - timeToMinutes(startTime),
    day,
    startTime,
    endTime,
  }));

const week = toEntries(V40);

/** Alla mattesvar som går att ge i dialogen: en kurs, ingen, eller Matte 1 + Matte 2. */
const MATH_ANSWERS: MathCourse[][] = [['grund'], ['1'], ['2'], [], ['1', '2']];

const ALL_CHOICES: ParticipantChoice[] = TEMA_OPTIONS.flatMap(tema =>
  MATH_ANSWERS.map(math => ({ tema: tema.value, math }))
);

const titlesAt = (entries: ScheduledEntry[], day: string, startTime: string) =>
  entries
    .filter(entry => entry.day === day && entry.startTime === startTime)
    .map(entry => entry.title.replace(/\s+/g, ' '));

describe('classifyPass', () => {
  it('känner igen temaklasserna', () => {
    expect(classifyPass('Tema Oliv')).toEqual({ kind: 'tema', tema: 'oliv' });
    expect(classifyPass('tema  GRUND')).toEqual({ kind: 'tema', tema: 'grund' });
  });

  it('matchar mattekurserna tolerant', () => {
    expect(classifyPass('Ma  Grund')).toEqual({ kind: 'math', course: 'grund' });
    expect(classifyPass('Ma 1')).toEqual({ kind: 'math', course: '1' });
    expect(classifyPass('Ma2 (tillval)')).toEqual({ kind: 'math', course: '2' });
    expect(classifyPass('Matte 2')).toEqual({ kind: 'math', course: '2' });
  });

  it('räknar inte "Ma 10" eller "Mat" som en mattekurs', () => {
    expect(classifyPass('Ma 10').kind).toBe('common');
    expect(classifyPass('Mat och hälsa').kind).toBe('common');
  });

  it('behandlar okända pass som gemensamma', () => {
    expect(classifyPass('Onsdagsklubben').kind).toBe('common');
    expect(classifyPass('Lunch').kind).toBe('common');
    expect(classifyPass('Utflykt till museet').kind).toBe('common');
  });
});

describe('filterForParticipant på v. 40', () => {
  it.each(ALL_CHOICES)('ger aldrig två pass samtidigt ($tema, [$math])', choice => {
    const mine = filterForParticipant(week, choice);
    for (const a of mine) {
      for (const b of mine) {
        if (a === b || a.day !== b.day) continue;
        expect(
          checkOverlap(a.startTime, a.endTime, b.startTime, b.endTime),
          `${a.day} ${a.startTime} ${a.title} krockar med ${b.title}`
        ).toBe(false);
      }
    }
  });

  it.each(ALL_CHOICES)('lämnar ingen lucka där gruppen har pass ($tema, [$math])', choice => {
    const mine = filterForParticipant(week, choice);
    // Ma 2 är ett tillval: den som inte läser det ska inte ha något då.
    const required = week.filter(entry => {
      const kind = classifyPass(entry.title);
      return !(kind.kind === 'math' && kind.course === '2');
    });
    for (const slot of required) {
      const covered = mine.some(entry => entry.day === slot.day
        && checkOverlap(entry.startTime, entry.endTime, slot.startTime, slot.endTime));
      expect(covered, `${slot.day} ${slot.startTime} (${slot.title}) saknas`).toBe(true);
    }
  });

  it('visar bara den egna temaklassen', () => {
    const mine = filterForParticipant(week, { tema: 'oliv', math: ['1'] });
    expect(titlesAt(mine, 'Måndag', '08:30')).toEqual(['Tema Oliv']);
    expect(titlesAt(mine, 'Fredag', '12:30')).toEqual(['Tema Oliv']);
  });

  it('Matte Grund: Ma Grund i matteblocket, studieverkstad bara när den ligger ensam', () => {
    const mine = filterForParticipant(week, { tema: 'rosa', math: ['grund'] });
    expect(titlesAt(mine, 'Tisdag', '10:15')).toEqual(['Ma Grund']);
    expect(titlesAt(mine, 'Tisdag', '14:45')).toEqual(['Ma Grund']);
    expect(titlesAt(mine, 'Fredag', '08:30')).toEqual(['Ma Grund']);
    expect(titlesAt(mine, 'Torsdag', '14:45')).toEqual(['Studieverkstad']);
    expect(titlesAt(mine, 'Onsdag', '14:45')).toEqual([]);
  });

  it('Matte 1: Ma 1 i matteblocket', () => {
    const mine = filterForParticipant(week, { tema: 'grund', math: ['1'] });
    expect(titlesAt(mine, 'Tisdag', '10:15')).toEqual(['Ma 1']);
    expect(titlesAt(mine, 'Fredag', '08:30')).toEqual(['Ma 1']);
    expect(titlesAt(mine, 'Fredag', '14:45')).toEqual([]);
  });

  it('Matte 2: studieverkstad i matteblocket och egna Ma 2-pass', () => {
    const mine = filterForParticipant(week, { tema: 'grund', math: ['2'] });
    expect(titlesAt(mine, 'Tisdag', '10:15')).toEqual(['Studieverkstad']);
    expect(titlesAt(mine, 'Tisdag', '14:45')).toEqual(['Studieverkstad']);
    expect(titlesAt(mine, 'Fredag', '08:30')).toEqual(['Studieverkstad']);
    expect(titlesAt(mine, 'Onsdag', '14:45')).toEqual(['Ma2 (tillval)']);
    expect(titlesAt(mine, 'Fredag', '14:45')).toEqual(['Ma2 (tillval)']);
  });

  it('Matte 1 + Matte 2: Ma 1 i matteblocket och Ma 2-passen, ingen studieverkstad då', () => {
    const mine = filterForParticipant(week, { tema: 'rosa', math: ['1', '2'] });
    expect(titlesAt(mine, 'Tisdag', '10:15')).toEqual(['Ma 1']);
    expect(titlesAt(mine, 'Tisdag', '14:45')).toEqual(['Ma 1']);
    expect(titlesAt(mine, 'Fredag', '08:30')).toEqual(['Ma 1']);
    expect(titlesAt(mine, 'Onsdag', '14:45')).toEqual(['Ma2 (tillval)']);
    expect(titlesAt(mine, 'Fredag', '14:45')).toEqual(['Ma2 (tillval)']);
    expect(titlesAt(mine, 'Torsdag', '14:45')).toEqual(['Studieverkstad']);
  });

  it('Läser ingen matte: studieverkstad, inga Ma-pass', () => {
    const mine = filterForParticipant(week, { tema: 'oliv', math: [] });
    expect(titlesAt(mine, 'Tisdag', '10:15')).toEqual(['Studieverkstad']);
    expect(titlesAt(mine, 'Torsdag', '14:45')).toEqual(['Studieverkstad']);
    expect(mine.some(entry => classifyPass(entry.title).kind === 'math')).toBe(false);
  });

  it.each(ALL_CHOICES)('behåller det gemensamma ($tema, [$math])', choice => {
    const titles = filterForParticipant(week, choice).map(entry => entry.title);
    expect(titles.filter(title => title === 'Lunch')).toHaveLength(5);
    expect(titles.filter(title => title === 'Paus')).toHaveLength(9);
    expect(titles).toContain('Onsdagsklubben');
  });

  it('visar ett okänt pass för alla', () => {
    const withTrip = [...week, ...toEntries([['Torsdag', '16:00', '17:00', 'Utflykt']])];
    for (const choice of ALL_CHOICES) {
      expect(filterForParticipant(withTrip, choice).some(entry => entry.title === 'Utflykt')).toBe(true);
    }
  });
});

describe('toggleMathOption', () => {
  it('låter Matte 1 och Matte 2 väljas tillsammans, i vilken ordning som helst', () => {
    expect(toggleMathOption(['1'], '2')).toEqual(['1', '2']);
    expect(toggleMathOption(['2'], '1')).toEqual(['1', '2']);
  });

  it('låter Ma Grund och Ma 1 byta av varandra, eftersom de går samtidigt', () => {
    expect(toggleMathOption(['grund'], '1')).toEqual(['1']);
    expect(toggleMathOption(['1'], 'grund')).toEqual(['grund']);
  });

  it('spärrar Ma Grund + Ma 2: den senast valda ersätter den andra', () => {
    expect(toggleMathOption(['2'], 'grund')).toEqual(['grund']);
    expect(toggleMathOption(['grund'], '2')).toEqual(['2']);
    expect(toggleMathOption(['1', '2'], 'grund')).toEqual(['grund']);
  });

  it('låter "Läser ingen matte" ersätta allt, och en kurs ersätta den', () => {
    expect(toggleMathOption(['1', '2'], 'ingen')).toEqual([]);
    expect(toggleMathOption([], '1')).toEqual(['1']);
  });

  it('väljer bort en vald kurs, och lämnar frågan obesvarad om ingen är kvar', () => {
    expect(toggleMathOption(['1', '2'], '2')).toEqual(['1']);
    expect(toggleMathOption(['1'], '1')).toBeNull();
  });

  it('skiljer på obesvarad och "läser ingen matte"', () => {
    expect(isMathOptionSelected(null, 'ingen')).toBe(false);
    expect(isMathOptionSelected([], 'ingen')).toBe(true);
    expect(isMathOptionSelected(['1', '2'], '2')).toBe(true);
  });
});

describe('sanitizeChoice', () => {
  it('godtar ett giltigt val', () => {
    expect(sanitizeChoice({ tema: 'rosa', math: [] })).toEqual({ tema: 'rosa', math: [] });
    expect(sanitizeChoice({ tema: 'oliv', math: ['2', '1'] })).toEqual({ tema: 'oliv', math: ['1', '2'] });
  });

  it('läser val sparade innan flervalet fanns', () => {
    expect(sanitizeChoice({ tema: 'oliv', math: '1' })).toEqual({ tema: 'oliv', math: ['1'] });
    expect(sanitizeChoice({ tema: 'oliv', math: 'ingen' })).toEqual({ tema: 'oliv', math: [] });
  });

  it('avvisar skräp ur lagringen', () => {
    expect(sanitizeChoice(null)).toBeNull();
    expect(sanitizeChoice('oliv')).toBeNull();
    expect(sanitizeChoice({ tema: 'blå', math: ['1'] })).toBeNull();
    expect(sanitizeChoice({ tema: 'oliv' })).toBeNull();
    expect(sanitizeChoice({ tema: 'oliv', math: ['3'] })).toBeNull();
  });

  it('avvisar kombinationer som inte går att välja', () => {
    expect(sanitizeChoice({ tema: 'oliv', math: ['grund', '1'] })).toBeNull();
    expect(sanitizeChoice({ tema: 'oliv', math: ['grund', '2'] })).toBeNull();
  });
});

describe('describeChoice', () => {
  it('skriver valet som det står i dialogen', () => {
    expect(describeChoice({ tema: 'oliv', math: ['1'] })).toBe('Tema Oliv · Matte 1');
    expect(describeChoice({ tema: 'oliv', math: ['1', '2'] })).toBe('Tema Oliv · Matte 1 + Matte 2');
    expect(describeChoice({ tema: 'grund', math: [] })).toBe('Tema Grund · Läser ingen matte');
  });
});
