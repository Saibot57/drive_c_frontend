import { describe, expect, it } from 'vitest';
import {
  excludeMatchFixtures,
  excludeParseFixtures
} from '@/components/schedule/__fixtures__/exportExclusions';
import { layoutTortureFixtures } from '@/components/schedule/__fixtures__/layoutTorture';
import {
  planningFixtures,
  planningTimeParseFixtures
} from '@/components/schedule/__fixtures__/planningTime';
import { DEFAULT_PLANNING_MIN_GAP_MINUTES } from '@/config/plannerConstants';
import { matchesExcludeList, parseExcludeList } from '@/utils/exportExclusions';
import {
  computePlanningForDay,
  parsePlanningQuery,
  sanitizePlanningTime
} from '@/utils/planningTime';
import { buildDayGroups, buildDayLayout } from '@/utils/scheduleLayout';
import { collectTeacherNames } from '@/utils/scheduleStats';
import { minutesToTime } from '@/utils/scheduleTime';

/**
 * Fixturerna kördes tidigare som påståenden när schemasidan laddades i dev.
 * Här körs de av vitest i stället, så de faller i CI och inte bara i någons
 * webbläsarkonsol.
 */

const normalizeGroups = (groups: string[][]) =>
  groups
    .map(group => [...group].sort())
    .sort((a, b) => a.join('|').localeCompare(b.join('|')));

describe('layoutfixturer', () => {
  it.each(layoutTortureFixtures.map(fixture => [fixture.name, fixture] as const))('%s', (_name, fixture) => {
    const layout = buildDayLayout(fixture.entries);
    const groups = buildDayGroups(fixture.entries);

    expect(normalizeGroups(groups.map(group => group.map(entry => entry.instanceId))))
      .toEqual(normalizeGroups(fixture.expectedGroups));

    Object.entries(fixture.expectedLayout).forEach(([instanceId, expected]) => {
      const actual = layout.get(instanceId);
      expect(actual, `layout saknas för ${instanceId}`).toBeDefined();
      expect({ id: instanceId, column: actual!.column, columns: actual!.columns })
        .toEqual({ id: instanceId, ...expected });
    });
  });
});

describe('uteslutningslistan', () => {
  // Listan tar bort innehåll ur en utskrift, så den ska vara exakt.
  it.each(excludeParseFixtures.map(fixture => [fixture.name, fixture] as const))('tolkning: %s', (_name, fixture) => {
    expect(parseExcludeList(fixture.input)).toEqual(fixture.expected);
  });

  it.each(excludeMatchFixtures.map(fixture => [fixture.name, fixture] as const))('matchning: %s', (_name, fixture) => {
    expect(matchesExcludeList(fixture.title, fixture.patterns)).toBe(fixture.expected);
  });
});

describe('sanitizePlanningTime', () => {
  it.each(planningTimeParseFixtures.map(fixture => [JSON.stringify(fixture.input), fixture] as const))(
    '%s',
    (_name, fixture) => {
      expect(sanitizePlanningTime(fixture.input)).toBe(fixture.expected);
    }
  );
});

describe('planeringsfixturer', () => {
  it.each(planningFixtures.map(fixture => [fixture.name, fixture] as const))('%s', (_name, fixture) => {
    const day = fixture.day ?? 'Måndag';
    // Samma mängd som planeraren räknar fram: debug-menyns lista plus namnen i
    // schemat. Det är den "alla" expanderar till.
    const allTeachers = collectTeacherNames(fixture.entries, fixture.teachers);
    const query = parsePlanningQuery(fixture.query, allTeachers);

    expect(query.isPlanning).toBe(fixture.expectedPlanning ?? true);

    const result = computePlanningForDay({
      schedule: fixture.entries,
      query,
      availability: fixture.availability ?? {},
      minGapMinutes: fixture.minGapMinutes ?? DEFAULT_PLANNING_MIN_GAP_MINUTES,
      planningStartMinutes: fixture.planningStartMinutes ?? null,
      planningEndMinutes: fixture.planningEndMinutes ?? null
    }, day);

    expect(result.isDayOff).toBe(fixture.expectedDayOff ?? false);
    expect(result.blocks.map(block => [minutesToTime(block.start), minutesToTime(block.end)]))
      .toEqual(fixture.expectedBlocks);
    expect(result.totalMinutes)
      .toBe(result.blocks.reduce((sum, block) => sum + (block.end - block.start), 0));
  });
});
