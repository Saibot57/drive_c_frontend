import type { Activity } from '../types';
import { calculateOverlapGroups } from './scheduleUtils';

export type ActivityColumnLayout = Map<
  string,
  {
    colIndex: number;
    colCount: number;
  }
>;

export const buildActivityColumnLayout = (activities: Activity[]): ActivityColumnLayout => {
  const overlapGroups = calculateOverlapGroups(activities);
  const colCount = Math.max(overlapGroups.length, 1);
  const layout: ActivityColumnLayout = new Map();

  overlapGroups.forEach((group, colIndex) => {
    group.forEach(activity => {
      layout.set(activity.id, { colIndex, colCount });
    });
  });

  return layout;
};
