import { planningFixtures } from '@/components/schedule/__fixtures__/planningTime';
import { DEFAULT_PLANNING_MIN_GAP_MINUTES } from '@/components/schedule/constants';
import { computePlanningForDay, parsePlanningQuery } from '@/utils/planningTime';
import { minutesToTime } from '@/utils/scheduleTime';

const assertCondition = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

/**
 * Projektet har ingen testkörare, så luckräkningen kontrolleras mot fixtures
 * vid uppstart i dev – samma mönster som layoutvalideringen.
 */
export const runPlanningFixtureValidation = () => {
  if (process.env.NODE_ENV === 'production') return;

  planningFixtures.forEach(fixture => {
    const day = fixture.day ?? 'Måndag';
    const query = parsePlanningQuery(fixture.query, fixture.teachers);
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
