import { checkOverlap, timeToMinutes } from '@/utils/scheduleTime';

type EntryWithTime = {
  startTime: string;
  endTime: string;
  instanceId: string;
};

export type DayLayoutEntry = {
  column: number;
  columns: number;
};

export const buildDayLayout = <T extends EntryWithTime>(entries: T[]) => {
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

  const layout = new Map<string, DayLayoutEntry>();

  groups.forEach((group) => {
    const sorted = [...group].sort((a, b) => {
      const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      if (startDiff !== 0) return startDiff;
      return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
    });

    const columns: T[][] = [];

    sorted.forEach((entry) => {
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
      columnEntries.forEach((entry) => {
        layout.set(entry.instanceId, { column: columnIndex, columns: totalColumns });
      });
    });
  });

  return layout;
};
