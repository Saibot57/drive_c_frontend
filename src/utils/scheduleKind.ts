import type { PlannerArchiveSummary, ScheduleKind } from '@/types/schedule';

/**
 * Basschema eller veckoschema. Ett schema utan sort kommer från en backend som
 * är äldre än basschemana och räknas som veckoschema — det var alla scheman
 * innan sorten fanns. Ingen annan kod jämför `kind` direkt.
 */
export const isBaseSchedule = (archive: Pick<PlannerArchiveSummary, 'kind'>): boolean => (
  archive.kind === 'base'
);

export const scheduleKindOf = (archive: Pick<PlannerArchiveSummary, 'kind'>): ScheduleKind => (
  isBaseSchedule(archive) ? 'base' : 'week'
);

/** Delar listan i basscheman och veckoscheman. Ordningen inom varje del behålls. */
export const partitionSchedules = <T extends Pick<PlannerArchiveSummary, 'kind'>>(archives: T[]) => ({
  bases: archives.filter(isBaseSchedule),
  weeks: archives.filter(archive => !isBaseSchedule(archive)),
});

/**
 * Det som ska stå i en väljare som bara visar en sort: de som klarar filtret,
 * och det redan valda schemat om det finns men är av den andra sorten. Det
 * senare är vanligt direkt efter att sorten infördes, när alla scheman var
 * veckoscheman, och utan det skulle valet se borttaget ut fast det finns.
 *
 * Om ett schema finns avgörs av hela listan, aldrig av den filtrerade.
 */
export const optionsWithCurrent = <T extends { id: string }>(
  archives: T[],
  keep: (archive: T) => boolean,
  currentId: string | null | undefined
): { options: T[]; outside: T | null } => {
  const options = archives.filter(keep);
  const current = currentId ? archives.find(archive => archive.id === currentId) ?? null : null;
  const outside = current && !keep(current) ? current : null;
  return { options, outside };
};

/** Ordet för sorten i löptext, t.ex. "v.44 (veckoschema)". */
export const scheduleKindLabel = (kind: ScheduleKind): string => (
  kind === 'base' ? 'basschema' : 'veckoschema'
);
