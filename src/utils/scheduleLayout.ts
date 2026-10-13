import { checkOverlap, timeToMinutes } from '@/utils/scheduleTime';

type EntryWithTime = {
  startTime: string;
  endTime: string;
  instanceId: string;
  title: string;
  color: string;
  laneOrder?: number | null;
};

export type DayLayoutEntry = {
  column: number;
  columns: number;
};

export const buildDayGroups = <T extends EntryWithTime>(entries: T[]) => {
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

/** Poster utan egen ordning hamnar efter dem som har en. */
const laneRank = (entry: EntryWithTime) => (
  typeof entry.laneOrder === 'number' ? entry.laneOrder : Number.MAX_SAFE_INTEGER
);

/**
 * Ordningen inom en krockgrupp, och därmed vänster till höger bland poster som
 * börjar samtidigt. Användarens `laneOrder` kommer direkt efter starttiden: den
 * får bestämma bland samtidiga poster men aldrig flytta en senare post före en
 * tidigare. Packningen nedan blir då lika smal oavsett ordning bland de
 * samtidiga, så användaren kan inte råka göra korten smalare.
 */
export const compareLaneEntries = (a: EntryWithTime, b: EntryWithTime) => {
  const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  if (startDiff !== 0) return startDiff;
  const laneDiff = laneRank(a) - laneRank(b);
  if (laneDiff !== 0) return laneDiff;
  const endDiff = timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
  if (endDiff !== 0) return endDiff;
  const titleDiff = a.title.localeCompare(b.title, 'sv');
  if (titleDiff !== 0) return titleDiff;
  const colorDiff = a.color.localeCompare(b.color);
  if (colorDiff !== 0) return colorDiff;
  return a.instanceId.localeCompare(b.instanceId);
};

export const buildDayLayout = <T extends EntryWithTime>(entries: T[]) => {
  const groups = buildDayGroups(entries);

  const layout = new Map<string, DayLayoutEntry>();

  groups.forEach((group) => {
    const sorted = [...group].sort(compareLaneEntries);

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

type LaneEntry = EntryWithTime & { day: string };

/** Posterna som börjar samtidigt som `entry` samma dag, i den ordning de ritas. */
export const getLanePeers = <T extends LaneEntry>(entries: T[], entry: LaneEntry): T[] => (
  entries
    .filter(other => other.day === entry.day && other.startTime === entry.startTime)
    .sort(compareLaneEntries)
);

/**
 * Flyttar en post till plats `targetIndex` bland de poster som börjar samtidigt
 * och ger alla dem en `laneOrder` efter den nya ordningen. Alla får ett värde
 * så att ordningen inte hänger på hur de övriga råkar sorteras. Står posten
 * redan där kommer samma lista tillbaka, så att inget ångrasteg startar.
 */
export const moveInLane = <T extends LaneEntry>(entries: T[], instanceId: string, targetIndex: number): T[] => {
  const entry = entries.find(e => e.instanceId === instanceId);
  if (!entry) return entries;

  const peers = getLanePeers(entries, entry);
  const fromIndex = peers.findIndex(e => e.instanceId === instanceId);
  const toIndex = Math.max(0, Math.min(targetIndex, peers.length - 1));
  if (fromIndex === toIndex) return entries;

  const reordered = [...peers];
  reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, entry);

  const nextOrder = new Map(reordered.map((peer, index) => [peer.instanceId, index]));

  return entries.map(e => (
    nextOrder.has(e.instanceId) ? { ...e, laneOrder: nextOrder.get(e.instanceId) } : e
  ));
};

/** Ett steg åt vänster (-1) eller höger (1) bland de samtidiga posterna. */
export const stepInLane = <T extends LaneEntry>(entries: T[], instanceId: string, step: -1 | 1): T[] => {
  const entry = entries.find(e => e.instanceId === instanceId);
  if (!entry) return entries;
  const peers = getLanePeers(entries, entry);
  const index = peers.findIndex(e => e.instanceId === instanceId);
  const target = index + step;
  if (target < 0 || target >= peers.length) return entries;
  return moveInLane(entries, instanceId, target);
};

/**
 * Vilken plats bland de samtidiga posterna en dragning släpps på, utifrån var
 * i dagskolumnen den släpps (`fraction`, 0 vänsterkant och 1 högerkant).
 *
 * De samtidiga posterna behöver inte ligga i spalt 0, 1, 2 — en tidigare post
 * kan hålla en spalt till vänster — så platsen blir den post vars spalt ligger
 * närmast den spalt som pekaren är över. `column` och `columns` är den spalten,
 * för förhandsvisningen.
 */
export const resolveLaneDrop = <T extends LaneEntry>(entries: T[], instanceId: string, fraction: number) => {
  const entry = entries.find(e => e.instanceId === instanceId);
  if (!entry) return null;

  const peers = getLanePeers(entries, entry);
  if (peers.length < 2) return null;

  const layout = buildDayLayout(entries.filter(e => e.day === entry.day));
  const columns = layout.get(instanceId)?.columns ?? peers.length;
  const pointerColumn = Math.max(0, Math.min(columns - 1, Math.floor(fraction * columns)));

  let index = 0;
  let distance = Infinity;
  peers.forEach((peer, peerIndex) => {
    const peerDistance = Math.abs((layout.get(peer.instanceId)?.column ?? peerIndex) - pointerColumn);
    if (peerDistance < distance) {
      index = peerIndex;
      distance = peerDistance;
    }
  });

  return { index, column: layout.get(peers[index].instanceId)?.column ?? index, columns };
};
