import type { PlannerArchiveSummary } from '@/types/schedule';

/**
 * Mapparna i högerpanelen (docs/plans/schemamappar.md).
 *
 * En mapp är `folder` på schemat, inte en egen sak. Ägaren bestämmer och alla
 * som har schemat ser samma mapp. Två ägares "HT26" blir därför en mapp hos
 * den som fått båda, och en mapp utan scheman finns inte.
 */

export type FolderGroup = {
  name: string;
  archives: PlannerArchiveSummary[];
};

export type GroupedWeekArchives = {
  folders: FolderGroup[];
  loose: PlannerArchiveSummary[];
};

/** Mappen schemat ligger i, eller null. Backend trimmar, men lita inte på det. */
export const folderNameOf = (archive: Pick<PlannerArchiveSummary, 'folder'>): string | null => {
  const name = typeof archive.folder === 'string' ? archive.folder.trim() : '';
  return name || null;
};

/**
 * Sant när backend känner till mappar. En äldre backend skickar ingen nyckel
 * `folder` alls, medan en ny skickar null för ett schema utan mapp.
 */
export const foldersSupported = (archives: PlannerArchiveSummary[]): boolean => (
  archives.some(archive => archive.folder !== undefined)
);

/** Svensk ordning, med siffror i nummerordning: "v.9" före "v.10". */
export const compareFolderNames = (a: string, b: string): number => (
  a.localeCompare(b, 'sv', { numeric: true })
);

/**
 * Delar veckoschemana i mappar och lösa scheman. Ordningen inom en mapp är
 * den från `weekArchives` (egna före delade, veckonummer).
 */
export const groupWeekArchives = (weekArchives: PlannerArchiveSummary[]): GroupedWeekArchives => {
  const byName = new Map<string, PlannerArchiveSummary[]>();
  const loose: PlannerArchiveSummary[] = [];
  weekArchives.forEach(archive => {
    const name = folderNameOf(archive);
    if (!name) {
      loose.push(archive);
      return;
    }
    const group = byName.get(name);
    if (group) group.push(archive);
    else byName.set(name, [archive]);
  });
  const folders = Array.from(byName, ([name, archives]) => ({ name, archives }))
    .sort((a, b) => compareFolderNames(a.name, b.name));
  return { folders, loose };
};

/**
 * Korten i den ordning panelen visar dem: basscheman, mapparna, lösa scheman.
 * Scheman i hopfällda mappar är inte med. Tangentnavigeringen och
 * `ArchiveCard.index` räknar på platsen här, så panelen måste rita i samma
 * ordning.
 */
export const panelOrder = (
  baseArchives: PlannerArchiveSummary[],
  groups: GroupedWeekArchives,
  expanded: ReadonlySet<string>
): PlannerArchiveSummary[] => [
  ...baseArchives,
  ...groups.folders.flatMap(group => (expanded.has(group.name) ? group.archives : [])),
  ...groups.loose,
];

/** Alla mappnamn som syns, i panelens ordning. */
export const folderNames = (groups: GroupedWeekArchives): string[] => (
  groups.folders.map(group => group.name)
);

/** De egna schemana i en mapp. Bara dem kan man flytta eller byta namn på. */
export const ownArchivesIn = (group: FolderGroup): PlannerArchiveSummary[] => (
  group.archives.filter(archive => archive.isOwner)
);

/**
 * Mappen ett nytt veckoschema förväljs till. Duplicera tar originalets mapp,
 * även när originalet är en kollegas: kopian hamnar då i den egna mappen med
 * samma namn, som i panelen är samma mapp. Nytt veckoschema tar mappen där det
 * öppna veckoschemat ligger.
 */
export const defaultFolderForNewSchedule = ({
  duplicateOf,
  activeWeekArchive,
}: {
  duplicateOf: PlannerArchiveSummary | null;
  activeWeekArchive: PlannerArchiveSummary | null;
}): string | null => {
  if (duplicateOf) return folderNameOf(duplicateOf);
  return activeWeekArchive ? folderNameOf(activeWeekArchive) : null;
};

/** Läser listan med utfällda mappar defensivt. Allt som inte är en sträng hoppas över. */
export const sanitizeExpandedFolders = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const names = raw
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean);
  return Array.from(new Set(names));
};

/** Ett eget namnbyte tar med sig det utfällda läget till det nya namnet. */
export const renameExpandedFolder = (expanded: string[], from: string, to: string): string[] => {
  if (!expanded.includes(from)) return expanded;
  return sanitizeExpandedFolders(expanded.map(name => (name === from ? to : name)));
};

/** Notisen efter en flytt. */
export const moveNotice = (archives: Pick<PlannerArchiveSummary, 'name'>[], folder: string | null): string => {
  const what = archives.length === 1 ? `"${archives[0].name}"` : `${archives.length} scheman`;
  return folder ? `Flyttade ${what} till ${folder}.` : `Flyttade ${what} ut ur mappen.`;
};
