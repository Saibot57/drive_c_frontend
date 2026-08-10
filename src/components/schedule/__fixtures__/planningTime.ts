import { ScheduledEntry, TeacherAvailability } from '@/types/schedule';

export type PlanningFixture = {
  name: string;
  entries: ScheduledEntry[];
  /** Sökrutans innehåll, tolkat mot lärarlistan nedan. */
  query: string;
  teachers: string[];
  availability?: TeacherAvailability;
  minGapMinutes?: number;
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
    name: 'Lärare utan egna poster är fri hela ramen',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [entry('Hanna', '09:00', '14:00')],
    expectedBlocks: [['09:00', '14:00']]
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
    name: 'Okänt namn ihop med känt namn ignoreras',
    teachers: ['Tobias Lundh'],
    query: 'Tobias Kalle planering',
    entries: [
      entry('Tobias', '08:00', '10:00'),
      entry('Kalle', '10:00', '14:00')
    ],
    expectedBlocks: [['10:00', '14:00']]
  },
  {
    name: 'Poster utanför rutnätet klipps till 08–17',
    teachers: ['Tobias Lundh'],
    query: 'tobias planering',
    entries: [entry('Hanna', '07:00', '18:00')],
    expectedBlocks: [['08:00', '17:00']]
  }
];
