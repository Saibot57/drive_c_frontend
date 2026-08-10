import { ScheduledEntry, TeacherAvailability } from '@/types/schedule';

export type PlanningFixture = {
  name: string;
  entries: ScheduledEntry[];
  /** Sökrutans innehåll. Tolkas mot lärarmängden: listan nedan plus schemat. */
  query: string;
  /** Debug-menyns lärarlista. Namn ur schemat läggs till automatiskt. */
  teachers: string[];
  availability?: TeacherAvailability;
  minGapMinutes?: number;
  /** Ramens gränser i minuter. Utelämnade = standard. */
  planningStartMinutes?: number | null;
  planningEndMinutes?: number | null;
  day?: string;
  expectedBlocks: [string, string][];
  expectedDayOff?: boolean;
  /** Sätt när sökningen inte ska tolkas som planering alls. */
  expectedPlanning?: boolean;
};

let counter = 0;

const entry = (
  teacher: string,
  startTime: string,
  endTime: string,
  day = 'Måndag'
): ScheduledEntry => {
  counter += 1;
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  return {
    id: `planning-${counter}`,
    instanceId: `planning-${counter}`,
    title: 'Lektion',
    teacher,
    room: '',
    color: '#ffffff',
    duration: (endHour * 60 + endMinute) - (startHour * 60 + startMinute),
    day,
    startTime,
    endTime
  };
};

/** Poster med egen titel, för lunchen som klipps oavsett lärare. */
const named = (
  title: string,
  teacher: string,
  startTime: string,
  endTime: string,
  day = 'Måndag'
): ScheduledEntry => ({
  ...entry(teacher, startTime, endTime, day),
  title
});

export const planningFixtures: PlanningFixture[] = [
  {
    name: 'Luckor mellan egna lektioner, ramen slutar med sista posten',
    teachers: ['Tobias Lundh'],
    query: 'Tobias planering',
    entries: [
      entry('Tobias', '08:00', '09:30'),
      entry('Tobias', '11:00', '12:00'),
      entry('Hanna', '14:00', '15:00')
    ],
    // Ramen är 08:00–15:00. 15:00–17:00 är ingen planeringstid.
    expectedBlocks: [['09:30', '11:00'], ['12:00', '15:00']]
  },
  {
    name: 'Lucka under tröskeln räknas inte',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [
      entry('Tobias', '08:00', '09:00'),
      entry('Tobias', '09:30', '10:00'),
      entry('Tobias', '10:00', '15:00')
    ],
    expectedBlocks: []
  },
  {
    name: 'Lucka precis på tröskeln räknas',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    minGapMinutes: 45,
    entries: [
      entry('Tobias', '08:00', '09:00'),
      entry('Tobias', '09:45', '15:00')
    ],
    expectedBlocks: [['09:00', '09:45']]
  },
  {
    name: 'Heldagsspärr ger ledig dag utan block',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    availability: { 'Tobias Lundh': { 'Måndag': ['all'] } },
    entries: [entry('Hanna', '08:00', '16:00')],
    expectedBlocks: [],
    expectedDayOff: true
  },
  {
    name: 'Ledig dag gäller även när ingen har lektion',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    availability: { 'Tobias Lundh': { 'Måndag': ['fm', 'em'] } },
    entries: [],
    expectedBlocks: [],
    expectedDayOff: true
  },
  {
    name: 'Förmiddagsspärr klipper bort tiden före 12',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    availability: { 'Tobias Lundh': { 'Måndag': ['fm'] } },
    entries: [entry('Hanna', '08:00', '16:00')],
    expectedBlocks: [['12:00', '16:00']]
  },
  {
    name: 'Eftermiddagsspärr klipper bort tiden från 12',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    availability: { 'Tobias Lundh': { 'Måndag': ['em'] } },
    entries: [entry('Hanna', '08:00', '16:00')],
    expectedBlocks: [['08:00', '12:00']]
  },
  {
    name: 'Två lärare ger bara gemensam fri tid',
    teachers: ['Tobias Lundh', 'Hanna Berg'],
    query: 'Tobias Hanna planering',
    entries: [
      entry('Tobias', '08:00', '10:00'),
      entry('Hanna', '11:00', '13:00'),
      entry('Sara', '15:00', '16:00')
    ],
    expectedBlocks: [['10:00', '11:00'], ['13:00', '16:00']]
  },
  {
    name: 'Ledig dag för en av två tömmer hela dagen',
    teachers: ['Tobias Lundh', 'Hanna Berg'],
    query: 'Tobias Hanna planering',
    availability: { 'Tobias Lundh': { 'Måndag': ['all'] } },
    entries: [entry('Hanna', '08:00', '10:00')],
    expectedBlocks: [],
    expectedDayOff: true
  },
  {
    name: 'Lärare utan egna poster är fri hela ramen, som börjar 08:00',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [entry('Hanna', '09:00', '14:00')],
    // Ramen börjar vid rutnätet, inte vid dagens första lektion.
    expectedBlocks: [['08:00', '14:00']]
  },
  {
    name: 'Komma i lärarfältet räknas som två lärare',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [
      entry('Hanna, Tobias', '08:00', '10:00'),
      entry('Hanna', '10:00', '14:00')
    ],
    expectedBlocks: [['10:00', '14:00']]
  },
  {
    name: 'Ordet planering utan namn är en vanlig sökning',
    teachers: ['Tobias Lundh'],
    query: 'planering',
    entries: [entry('Tobias', '08:00', '10:00')],
    expectedBlocks: [],
    expectedPlanning: false
  },
  {
    name: 'Namn som bara finns i schemat är också sökbart',
    teachers: ['Tobias Lundh'],
    query: 'Tobias Kalle planering',
    entries: [
      entry('Tobias', '08:00', '10:00'),
      entry('Kalle', '10:00', '14:00')
    ],
    // Kalle står inte i debug-menyn men i schemat, och ingår därför i
    // lärarmängden. Snittet av Tobias och Kalle är tomt.
    expectedBlocks: []
  },
  {
    name: 'Ord som inte är någon lärare ignoreras',
    teachers: ['Tobias Lundh'],
    query: 'Tobias Kalle planering',
    entries: [
      entry('Tobias', '08:00', '10:00'),
      entry('Hanna', '10:00', '14:00')
    ],
    expectedBlocks: [['10:00', '14:00']]
  },
  {
    name: 'Poster utanför rutnätet klipps till 08–17',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [entry('Hanna', '07:00', '18:00')],
    expectedBlocks: [['08:00', '17:00']]
  },
  {
    name: 'Lunch utan lärare klipps ändå och delar dagen',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [
      entry('Hanna', '08:00', '16:00'),
      named('Lunch', '', '11:30', '12:15')
    ],
    expectedBlocks: [['08:00', '11:30'], ['12:15', '16:00']]
  },
  {
    name: 'Lunchrast matchar också',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [
      entry('Hanna', '08:00', '16:00'),
      named('Lunchrast', '', '11:00', '11:45')
    ],
    expectedBlocks: [['08:00', '11:00'], ['11:45', '16:00']]
  },
  {
    name: 'Lunch med lärare på posten klipps oavsett vem det är',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [
      entry('Hanna', '08:00', '16:00'),
      named('lunch', 'Hanna', '12:00', '13:00')
    ],
    expectedBlocks: [['08:00', '12:00'], ['13:00', '16:00']]
  },
  {
    name: 'Lunch kan krympa en lucka under tröskeln',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [
      entry('Tobias', '08:00', '11:00'),
      named('Lunch', '', '11:00', '11:30'),
      entry('Tobias', '12:00', '15:00')
    ],
    // 11:30–12:00 är bara 30 min och faller på 45-minuterströskeln.
    expectedBlocks: []
  },
  {
    name: 'En dag med bara lunch ger morgonen fram till lunchen',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [named('Lunch', '', '11:30', '12:15')],
    // Ramen är 08:00 till lunchens slut, och lunchen klipps ur den.
    expectedBlocks: [['08:00', '11:30']]
  },

  // --- "alla" under lärare ---
  {
    name: '"alla" under lärare äter allas planeringstid',
    teachers: ['Tobias Lundh', 'Hanna Berg'],
    query: 'tobias planering',
    entries: [
      entry('Hanna', '08:00', '15:00'),
      named('ATP', 'alla', '13:00', '14:00')
    ],
    expectedBlocks: [['08:00', '13:00'], ['14:00', '15:00']]
  },
  {
    name: '"ALLA" med versaler räknas också',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [
      entry('Hanna', '08:00', '15:00'),
      named('Konferens', 'ALLA', '08:00', '10:00')
    ],
    expectedBlocks: [['10:00', '15:00']]
  },
  {
    name: '"alla" bland andra namn i fältet räknas',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [
      entry('Hanna', '08:00', '15:00'),
      named('ATP', 'Hanna, alla', '13:00', '14:00')
    ],
    expectedBlocks: [['08:00', '13:00'], ['14:00', '15:00']]
  },
  {
    name: 'Ett namn som bara innehåller alla är ingen "alla"-post',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [
      entry('Hanna', '08:00', '15:00'),
      named('Möte', 'Allan', '13:00', '14:00')
    ],
    expectedBlocks: [['08:00', '15:00']]
  },
  {
    name: '"alla planering" ger tiden då hela kollegiet är fritt',
    teachers: ['Tobias Lundh', 'Hanna Berg'],
    query: 'alla planering',
    entries: [
      entry('Tobias', '08:00', '10:00'),
      entry('Hanna', '10:00', '11:00'),
      entry('Sara', '14:00', '16:00')
    ],
    // Sara ligger i mängden via schemat, så hennes pass räknas också.
    expectedBlocks: [['11:00', '14:00']]
  },
  {
    name: '"alla planering" plockar upp lärare som bara finns i schemat',
    teachers: [],
    query: 'alla planering',
    entries: [
      entry('Sara', '08:00', '09:00'),
      entry('Hanna', '10:00', '15:00')
    ],
    expectedBlocks: [['09:00', '10:00']]
  },

  // --- Arbetsdagens gränser ---
  {
    name: 'Morgonen före egna första lektionen är planeringstid',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [entry('Tobias', '10:00', '14:00')],
    expectedBlocks: [['08:00', '10:00']]
  },
  {
    name: '"till" förlänger förbi sista lektionen',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    planningEndMinutes: 16 * 60 + 30,
    entries: [entry('Tobias', '08:00', '15:00')],
    expectedBlocks: [['15:00', '16:30']]
  },
  {
    name: '"till" kapar också',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    planningEndMinutes: 15 * 60,
    entries: [
      entry('Tobias', '08:00', '11:00'),
      entry('Hanna', '11:00', '16:00')
    ],
    // Utan gränsen hade blocket gått till 16:00.
    expectedBlocks: [['11:00', '15:00']]
  },
  {
    name: '"från" flyttar början',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    planningStartMinutes: 8 * 60 + 30,
    entries: [entry('Hanna', '08:00', '15:00')],
    expectedBlocks: [['08:30', '15:00']]
  },
  {
    name: 'Tom dag får planeringstid när "till" är satt',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    planningEndMinutes: 16 * 60 + 30,
    entries: [],
    expectedBlocks: [['08:00', '16:30']]
  },
  {
    name: 'Tom dag utan "till" ger fortfarande ingenting',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [],
    // Början är känd, men det finns inget slut att räkna mot.
    expectedBlocks: []
  },
  {
    name: 'Gränser utanför rutnätet klamras till 08–17',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    planningStartMinutes: 6 * 60,
    planningEndMinutes: 18 * 60 + 30,
    entries: [entry('Tobias', '08:00', '15:00')],
    expectedBlocks: [['15:00', '17:00']]
  },
  {
    name: '"från" efter "till" ger ingen planeringstid',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    planningStartMinutes: 15 * 60,
    planningEndMinutes: 12 * 60,
    entries: [entry('Hanna', '08:00', '16:00')],
    expectedBlocks: []
  }
];

export type PlanningTimeParseFixture = {
  input: unknown;
  /** Minuter från midnatt, eller null när standarden ska gälla. */
  expected: number | null;
};

export const planningTimeParseFixtures: PlanningTimeParseFixture[] = [
  { input: '16:00', expected: 16 * 60 },
  { input: '16', expected: 16 * 60 },
  { input: '16.30', expected: 16 * 60 + 30 },
  { input: '8:05', expected: 8 * 60 + 5 },
  { input: '  16:00  ', expected: 16 * 60 },
  { input: '', expected: null },
  { input: '   ', expected: null },
  { input: 'abc', expected: null },
  { input: '16:00:00', expected: null },
  { input: '25:00', expected: null },
  { input: '16:75', expected: null },
  { input: null, expected: null },
  { input: undefined, expected: null },
  // Utanför rutnätet dras in till kanten.
  { input: '18:30', expected: 17 * 60 },
  { input: '06:00', expected: 8 * 60 }
];
