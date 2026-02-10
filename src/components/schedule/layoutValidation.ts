import { buildDayLayout } from '@/utils/scheduleLayout';
import { checkOverlap } from '@/utils/scheduleTime';
import { layoutTortureFixtures } from '@/components/schedule/__fixtures__/layoutTorture';

const assertCondition = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const normalizeGroups = (groups: string[][]) =>
  groups
    .map(group => [...group].sort())
    .sort((a, b) => a.join('|').localeCompare(b.join('|')));

const buildDayGroups = <T extends { startTime: string; endTime: string }>(entries: T[]) => {
  const groups: T[][] = [];

  entries.forEach((entry) => {
    const overlappingGroups = groups.filter((group) =>
      group.some((existing) =>
        checkOverlap(entry.startTime, entry.endTime, existing.startTime, existing.endTime)
      )
    );

    if (overlappingGroups.length === 0) {
      groups.push([entry]);
      return;
    }

    const mergedGroup = overlappingGroups.flat();
    overlappingGroups.forEach((group) => {
      const index = groups.indexOf(group);
      if (index > -1) {
        groups.splice(index, 1);
      }
    });

    groups.push([...mergedGroup, entry]);
  });

  return groups;
};

export const runLayoutFixtureValidation = () => {
  if (process.env.NODE_ENV === 'production') return;

  layoutTortureFixtures.forEach(fixture => {
    const layout = buildDayLayout(fixture.entries);
    const groups = buildDayGroups(fixture.entries);

    const actualGroups = normalizeGroups(groups.map(group => group.map(entry => entry.instanceId)));
    const expectedGroups = normalizeGroups(fixture.expectedGroups);

    assertCondition(
      actualGroups.length === expectedGroups.length,
      `[layout fixtures] ${fixture.name}: expected ${expectedGroups.length} groups, got ${actualGroups.length}`
    );

    expectedGroups.forEach((expectedGroup, index) => {
      const actualGroup = actualGroups[index];
      assertCondition(
        actualGroup.join('|') === expectedGroup.join('|'),
        `[layout fixtures] ${fixture.name}: group mismatch. expected ${expectedGroup.join(', ')}, got ${actualGroup.join(', ')}`
      );
    });

    Object.entries(fixture.expectedLayout).forEach(([instanceId, expected]) => {
      const actual = layout.get(instanceId);
      assertCondition(
        !!actual,
        `[layout fixtures] ${fixture.name}: missing layout for ${instanceId}`
      );
      assertCondition(
        actual!.column === expected.column,
        `[layout fixtures] ${fixture.name}: ${instanceId} column expected ${expected.column}, got ${actual!.column}`
      );
      assertCondition(
        actual!.columns === expected.columns,
        `[layout fixtures] ${fixture.name}: ${instanceId} columns expected ${expected.columns}, got ${actual!.columns}`
      );
    });
  });
};
