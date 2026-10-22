import type { PlannerArchiveSummary } from '@/types/schedule';
import { isBaseSchedule } from '@/utils/scheduleKind';
import { weekNumberFromName } from '@/utils/termPlanner';

/** Samma gräns som backend (kolumnen `name` i planner_archive). */
export const MAX_ARCHIVE_NAME_LENGTH = 150;

export type ArchiveRenameCheck = {
  /** Namnet som det skickas: trimmat. */
  name: string;
  /** Samma namn som nu. Då finns inget att spara. */
  unchanged: boolean;
  /** Varför namnet inte duger, att visa under fältet, eller null. */
  problem: string | null;
  /**
   * Veckan terminsplaneringen föreslår schemat för i dag, när det nya namnet
   * inte längre säger samma vecka. Annars null.
   */
  lostWeek: number | null;
};

const comparable = (name: string) => name.trim().toLocaleLowerCase('sv');

/**
 * Kontrollerar ett nytt namn på ett schema. `ownArchives` är ägarens alla
 * scheman, bas och vecka, eftersom namnet är unikt bland dem alla.
 *
 * Krocken räknas utan skillnad på stora och små bokstäver, som databasen gör:
 * "V.35" går inte när ett annat schema heter "v.35", men schemat självt kan
 * byta bara skiftläget.
 */
export const checkArchiveRename = (
  draft: string,
  archive: Pick<PlannerArchiveSummary, 'id' | 'name' | 'kind'>,
  ownArchives: Pick<PlannerArchiveSummary, 'id' | 'name'>[]
): ArchiveRenameCheck => {
  const name = draft.trim();
  const unchanged = name === archive.name;

  let problem: string | null = null;
  if (name.length > MAX_ARCHIVE_NAME_LENGTH) {
    problem = `Namnet är för långt (högst ${MAX_ARCHIVE_NAME_LENGTH} tecken).`;
  } else if (name && ownArchives.some(other => other.id !== archive.id && comparable(other.name) === comparable(name))) {
    problem = 'Du har redan ett schema med det namnet.';
  }

  const week = isBaseSchedule(archive) ? null : weekNumberFromName(archive.name);
  const lostWeek = week !== null && name !== '' && !unchanged && weekNumberFromName(name) !== week ? week : null;

  return { name, unchanged, problem, lostWeek };
};
