import { ScheduledEntry } from '@/types/schedule';
import { checkOverlap, timeToMinutes } from '@/utils/scheduleTime';

export const buildDayGroups = (entries: ScheduledEntry[]) => {
  const groups: ScheduledEntry[][] = [];

  entries.forEach(entry => {
import { checkOverlap, timeToMinutes } from '@/utils/scheduleTime';

type EntryWithTime = {
  startTime: string;
  endTime: string;
};

export type DayLayoutEntry = {
  startMin: number;
  endMin: number;
  colIndex: number;
  colCount: number;
  groupId?: string;
};

export type DayLayoutConfig<T> = {
  getEntryId?: (entry: T, index: number) => string;
  groupIdPrefix?: string;
  includeGroupId?: boolean;
};

export const buildDayLayout = <T extends EntryWithTime>(
  entries: T[],
  config: DayLayoutConfig<T> = {}
): Map<string, DayLayoutEntry> => {
  const groups: T[][] = [];
  const getEntryId = config.getEntryId ?? ((entry: T, index: number) => {
    const fallback = `entry-${index}`;
    if (typeof (entry as { instanceId?: string }).instanceId === 'string') {
      return (entry as { instanceId: string }).instanceId;
    }
    if (typeof (entry as { id?: string }).id === 'string') {
      return (entry as { id: string }).id;
    }
    return fallback;
  });
  const entryIdMap = new Map<T, string>();

  entries.forEach((entry, index) => {
    entryIdMap.set(entry, getEntryId(entry, index));
    const overlappingGroups = groups.filter(group =>
      group.some(existing =>
        checkOverlap(entry.startTime, entry.endTime, existing.startTime, existing.endTime)
      )
    );

    if (overlappingGroups.length === 0) {
      groups.push([entry]);
      return;
    }

    const mergedGroup = overlappingGroups.flat();
    overlappingGroups.forEach(group => {
      const index = groups.indexOf(group);
      if (index > -1) {
        groups.splice(index, 1);
      const groupIndex = groups.indexOf(group);
      if (groupIndex > -1) {
        groups.splice(groupIndex, 1);
      }
    });
    groups.push([...mergedGroup, entry]);
  });

  return groups;
};

export const buildDayLayout = (entries: ScheduledEntry[]) => {
  const groups = buildDayGroups(entries);
  const layout = new Map<string, { column: number; columns: number }>();

  groups.forEach(group => {
  const layout = new Map<string, DayLayoutEntry>();

  groups.forEach((group, groupIndex) => {
    const sorted = [...group].sort((a, b) => {
      const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      if (startDiff !== 0) return startDiff;
      return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
    });

    const columns: ScheduledEntry[][] = [];
    const columns: T[][] = [];

    sorted.forEach(entry => {
      let placed = false;
      for (let i = 0; i < columns.length; i += 1) {
        const last = columns[i][columns[i].length - 1];
        if (!checkOverlap(last.startTime, last.endTime, entry.startTime, entry.endTime)) {
          columns[i].push(entry);
          layout.set(entry.instanceId, { column: i, columns: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([entry]);
        layout.set(entry.instanceId, { column: columns.length - 1, columns: 0 });
      }
    });

    const totalColumns = columns.length;
    columns.forEach((columnEntries, columnIndex) => {
      columnEntries.forEach(entry => {
        layout.set(entry.instanceId, { column: columnIndex, columns: totalColumns });
    const includeGroupId = config.includeGroupId !== false;
    const groupId = includeGroupId
      ? `${config.groupIdPrefix ?? 'group'}-${groupIndex + 1}`
      : undefined;

    columns.forEach((columnEntries, columnIndex) => {
      columnEntries.forEach(entry => {
        const entryId = entryIdMap.get(entry);
        if (!entryId) return;
        layout.set(entryId, {
          startMin: timeToMinutes(entry.startTime),
          endMin: timeToMinutes(entry.endTime),
          colIndex: columnIndex,
          colCount: totalColumns,
          groupId,
        });
      });
    });
  });

  return layout;
};
