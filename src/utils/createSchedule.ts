import { v4 as uuidv4 } from 'uuid';
import type { PlannerActivity, PlannerArchiveSummary, ScheduleKind } from '@/types/schedule';
import { isBaseSchedule } from '@/utils/scheduleKind';

/**
 * Vad ett nytt schema utgår från. `main` är det gamla huvudschemat, som inte
 * längre syns i planeraren. Det finns kvar som källa för den som har poster
 * där, men förväljs och minns aldrig (docs/plans/basscheman.md, 5.2).
 */
export type NewScheduleSource =
  | { kind: 'empty' }
  | { kind: 'main' }
  | { kind: 'archive'; id: string };

/** Det som sparas i localStorage, så att basschemat är förvalt nästa gång. */
export const encodeScheduleSource = (source: NewScheduleSource): string => (
  source.kind === 'archive' ? `archive:${source.id}` : source.kind
);

export const decodeScheduleSource = (value: string | null | undefined): NewScheduleSource => {
  if (value === 'main') return { kind: 'main' };
  if (value?.startsWith('archive:') && value.length > 'archive:'.length) {
    return { kind: 'archive', id: value.slice('archive:'.length) };
  }
  return { kind: 'empty' };
};

/**
 * Förvalet i Nytt veckoschema, ur det som sparats i localStorage. Ett sparat
 * val gäller om det är Tomt schema eller ett basschema man fortfarande når.
 * Annars, och första gången, den första basen i listan. Finns ingen bas
 * börjar veckan tom. Huvudschemat förväljs aldrig.
 */
export const resolveWeekSource = (
  stored: string | null,
  archives: Pick<PlannerArchiveSummary, 'id' | 'kind'>[]
): NewScheduleSource => {
  const bases = archives.filter(isBaseSchedule);
  const source = stored === null ? null : decodeScheduleSource(stored);
  if (source?.kind === 'empty' && stored === 'empty') return source;
  if (source?.kind === 'archive' && bases.some(base => base.id === source.id)) return source;
  return bases.length > 0 ? { kind: 'archive', id: bases[0].id } : { kind: 'empty' };
};

export type CreateScheduleService = {
  createArchive: (name: string, kind: ScheduleKind) => Promise<PlannerArchiveSummary>;
  getArchiveActivities: (archiveId: string) => Promise<{ archive?: PlannerArchiveSummary; activities: PlannerActivity[] }>;
  getPlannerActivities: () => Promise<PlannerActivity[]>;
  saveArchiveActivities: (
    archiveId: string,
    activities: PlannerActivity[]
  ) => Promise<{ archive?: PlannerArchiveSummary; activities: PlannerActivity[] }>;
  releaseArchiveLock: (archiveId: string) => Promise<void>;
};

export type CreateScheduleResult = {
  archive: PlannerArchiveSummary;
  /** Posterna i det nya schemat, med egna id:n. */
  activities: PlannerActivity[];
  /** Schemat vars lås släpptes, eller null om inget var öppet. */
  releasedArchiveId: string | null;
};

/**
 * Den enda vägen till ett nytt schema: Nytt veckoschema, Nytt basschema och
 * Duplicera går alla hit.
 *
 * Källan läses före skapandet. Misslyckas läsningen finns inget halvfärdigt
 * schema kvar i listan.
 *
 * Låset på schemat som var öppet släpps efteråt. Låsen går inte ut av sig
 * själva i backend, så utan det här blev ett delat schema stående låst på en
 * själv efter varje ny vecka. Ett fel där stoppar inte skapandet — det nya
 * schemat finns redan och är det man arbetar i.
 */
export const createScheduleFrom = async ({
  name,
  kind,
  source,
  previousArchiveId,
  service,
}: {
  name: string;
  kind: ScheduleKind;
  source: NewScheduleSource;
  previousArchiveId: string | null;
  service: CreateScheduleService;
}): Promise<CreateScheduleResult> => {
  let sourceActivities: PlannerActivity[] = [];
  if (source.kind === 'archive') {
    sourceActivities = (await service.getArchiveActivities(source.id)).activities;
  } else if (source.kind === 'main') {
    sourceActivities = await service.getPlannerActivities();
  }

  const activities = sourceActivities.map(activity => ({ ...activity, id: uuidv4() }));
  const created = await service.createArchive(name, kind);

  let archive = created;
  if (activities.length > 0) {
    const result = await service.saveArchiveActivities(created.id, activities);
    archive = result.archive ?? created;
  }

  let releasedArchiveId: string | null = null;
  if (previousArchiveId && previousArchiveId !== created.id) {
    try {
      await service.releaseArchiveLock(previousArchiveId);
      releasedArchiveId = previousArchiveId;
    } catch (error) {
      console.error('Releasing previous lock failed', error);
    }
  }

  return { archive, activities, releasedArchiveId };
};
