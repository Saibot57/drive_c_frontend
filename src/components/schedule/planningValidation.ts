import {
  excludeMatchFixtures,
  excludeParseFixtures
} from '@/components/schedule/__fixtures__/exportExclusions';
import { planningFixtures } from '@/components/schedule/__fixtures__/planningTime';
import { DEFAULT_PLANNING_MIN_GAP_MINUTES } from '@/components/schedule/constants';
import { matchesExcludeList, parseExcludeList } from '@/utils/exportExclusions';
import { computePlanningForDay, parsePlanningQuery } from '@/utils/planningTime';
import { collectTeacherNames } from '@/utils/scheduleStats';
import { minutesToTime } from '@/utils/scheduleTime';

const assertCondition = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

/** Uteslutningslistan tar bort innehåll ur en utskrift, så den ska vara exakt. */
const runExcludeFixtures = () => {
  excludeParseFixtures.forEach(fixture => {
    const actual = parseExcludeList(fixture.input);
    assertCondition(
      actual.join('|') === fixture.expected.join('|'),
      `[exclude fixtures] ${fixture.name}: förväntade [${fixture.expected.join(', ')}], fick [${actual.join(', ')}]`
    );
  });

  excludeMatchFixtures.forEach(fixture => {
    const actual = matchesExcludeList(fixture.title, fixture.patterns);
    assertCondition(
      actual === fixture.expected,
      `[exclude fixtures] ${fixture.name}: förväntade ${fixture.expected}, fick ${actual}`
    );
  });
};

/**
 * Projektet har ingen testkörare, så luckräkningen kontrolleras mot fixtures
 * vid uppstart i dev – samma mönster som layoutvalideringen.
 */
export const runPlanningFixtureValidation = () => {
  if (process.env.NODE_ENV === 'production') return;

  runExcludeFixtures();

  planningFixtures.forEach(fixture => {
    const day = fixture.day ?? 'Måndag';
    // Samma mängd som planeraren räknar fram: debug-menyns lista plus namnen i
    // schemat. Det är den "alla" expanderar till.
    const allTeachers = collectTeacherNames(fixture.entries, fixture.teachers);
    const query = parsePlanningQuery(fixture.query, allTeachers);
    const expectPlanning = fixture.expectedPlanning ?? true;

    assertCondition(
      query.isPlanning === expectPlanning,
      `[planning fixtures] ${fixture.name}: förväntade isPlanning=${expectPlanning}, fick ${query.isPlanning}`
    );

    const result = computePlanningForDay({
      schedule: fixture.entries,
      query,
      availability: fixture.availability ?? {},
      minGapMinutes: fixture.minGapMinutes ?? DEFAULT_PLANNING_MIN_GAP_MINUTES
    }, day);

    assertCondition(
      result.isDayOff === (fixture.expectedDayOff ?? false),
      `[planning fixtures] ${fixture.name}: förväntade isDayOff=${fixture.expectedDayOff ?? false}, fick ${result.isDayOff}`
    );

    const actual = result.blocks.map(block => `${minutesToTime(block.start)}–${minutesToTime(block.end)}`);
    const expected = fixture.expectedBlocks.map(([start, end]) => `${start}–${end}`);

    assertCondition(
      actual.join(', ') === expected.join(', '),
      `[planning fixtures] ${fixture.name}: förväntade [${expected.join(', ')}], fick [${actual.join(', ')}]`
    );

    const expectedMinutes = result.blocks.reduce((sum, block) => sum + (block.end - block.start), 0);
    assertCondition(
      result.totalMinutes === expectedMinutes,
      `[planning fixtures] ${fixture.name}: summan ${result.totalMinutes} stämmer inte med blocken`
    );
  });
};
