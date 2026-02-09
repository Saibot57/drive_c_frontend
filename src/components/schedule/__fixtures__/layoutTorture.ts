import { ScheduledEntry } from '@/types/schedule';

type LayoutExpectation = {
  column: number;
  columns: number;
};

export type LayoutFixture = {
  name: string;
  entries: ScheduledEntry[];
  expectedLayout: Record<string, LayoutExpectation>;
  expectedGroups: string[][];
};

const baseEntry = {
  day: 'Måndag',
  teacher: '',
  room: '',
  color: '#93c5fd',
  duration: 60,
  title: ''
};

const makeEntry = (overrides: Partial<ScheduledEntry>): ScheduledEntry => ({
  id: overrides.instanceId ?? 'fixture',
  instanceId: overrides.instanceId ?? 'fixture',
  title: overrides.title ?? baseEntry.title,
  teacher: overrides.teacher ?? baseEntry.teacher,
  room: overrides.room ?? baseEntry.room,
  color: overrides.color ?? baseEntry.color,
  duration: overrides.duration ?? baseEntry.duration,
  day: overrides.day ?? baseEntry.day,
  startTime: overrides.startTime ?? '08:00',
  endTime: overrides.endTime ?? '09:00',
  notes: overrides.notes
});

export const layoutTortureFixtures: LayoutFixture[] = [
  {
    name: 'Adjacent events (end == start)',
    entries: [
      makeEntry({ instanceId: 'adjacent-1', title: 'Math', startTime: '09:00', endTime: '10:00' }),
      makeEntry({ instanceId: 'adjacent-2', title: 'Physics', startTime: '10:00', endTime: '11:00' })
    ],
    expectedLayout: {
      'adjacent-1': { column: 0, columns: 1 },
      'adjacent-2': { column: 0, columns: 1 }
    },
    expectedGroups: [['adjacent-1'], ['adjacent-2']]
  },
  {
    name: 'Nested overlaps',
    entries: [
      makeEntry({ instanceId: 'nested-long', title: 'Long block', startTime: '09:00', endTime: '12:00' }),
      makeEntry({ instanceId: 'nested-short-1', title: 'Short block A', startTime: '09:30', endTime: '10:00' }),
      makeEntry({ instanceId: 'nested-short-2', title: 'Short block B', startTime: '10:00', endTime: '11:00' })
    ],
    expectedLayout: {
      'nested-long': { column: 0, columns: 2 },
      'nested-short-1': { column: 1, columns: 2 },
      'nested-short-2': { column: 1, columns: 2 }
    },
    expectedGroups: [['nested-long', 'nested-short-1', 'nested-short-2']]
  },
  {
    name: 'Many overlaps (7 entries)',
    entries: [
      makeEntry({ instanceId: 'overlap-1', title: 'Overlap 1', startTime: '10:00', endTime: '11:00' }),
      makeEntry({ instanceId: 'overlap-2', title: 'Overlap 2', startTime: '10:01', endTime: '11:01' }),
      makeEntry({ instanceId: 'overlap-3', title: 'Overlap 3', startTime: '10:02', endTime: '11:02' }),
      makeEntry({ instanceId: 'overlap-4', title: 'Overlap 4', startTime: '10:03', endTime: '11:03' }),
      makeEntry({ instanceId: 'overlap-5', title: 'Overlap 5', startTime: '10:04', endTime: '11:04' }),
      makeEntry({ instanceId: 'overlap-6', title: 'Overlap 6', startTime: '10:05', endTime: '11:05' }),
      makeEntry({ instanceId: 'overlap-7', title: 'Overlap 7', startTime: '10:06', endTime: '11:06' })
    ],
    expectedLayout: {
      'overlap-1': { column: 0, columns: 7 },
      'overlap-2': { column: 1, columns: 7 },
      'overlap-3': { column: 2, columns: 7 },
      'overlap-4': { column: 3, columns: 7 },
      'overlap-5': { column: 4, columns: 7 },
      'overlap-6': { column: 5, columns: 7 },
      'overlap-7': { column: 6, columns: 7 }
    },
    expectedGroups: [[
      'overlap-1',
      'overlap-2',
      'overlap-3',
      'overlap-4',
      'overlap-5',
      'overlap-6',
      'overlap-7'
    ]]
  },
  {
    name: 'Very short events',
    entries: [
      makeEntry({ instanceId: 'short-1', title: '5-min', startTime: '13:00', endTime: '13:05' }),
      makeEntry({ instanceId: 'short-2', title: '2-min overlap', startTime: '13:02', endTime: '13:04' }),
      makeEntry({ instanceId: 'short-3', title: 'Adjacent short', startTime: '13:05', endTime: '13:06' })
    ],
    expectedLayout: {
      'short-1': { column: 0, columns: 2 },
      'short-2': { column: 1, columns: 2 },
      'short-3': { column: 0, columns: 1 }
    },
    expectedGroups: [['short-1', 'short-2'], ['short-3']]
  },
  {
    name: 'Long titles',
    entries: [
      makeEntry({
        instanceId: 'long-title-1',
        title: 'Very long event title that should not affect layout calculation in any column decisions',
        startTime: '15:00',
        endTime: '16:00'
      }),
      makeEntry({
        instanceId: 'long-title-2',
        title: 'Another intentionally verbose schedule entry title to test truncation behavior',
        startTime: '15:30',
        endTime: '16:30'
      })
    ],
    expectedLayout: {
      'long-title-1': { column: 0, columns: 2 },
      'long-title-2': { column: 1, columns: 2 }
    },
    expectedGroups: [['long-title-1', 'long-title-2']]
  },
  {
    name: 'Events outside visible time window',
    entries: [
      makeEntry({ instanceId: 'outside-early', title: 'Early', startTime: '06:00', endTime: '07:00' }),
      makeEntry({ instanceId: 'outside-late', title: 'Late', startTime: '19:00', endTime: '20:00' })
    ],
    expectedLayout: {
      'outside-early': { column: 0, columns: 1 },
      'outside-late': { column: 0, columns: 1 }
    },
    expectedGroups: [['outside-early'], ['outside-late']]
  }
];
