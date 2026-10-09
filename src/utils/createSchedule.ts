import { v4 as uuidv4 } from 'uuid';
import type { PlannerActivity, PlannerArchiveSummary } from '@/types/schedule';

/**
 * Vad ett nytt schema utgår från. Huvudschemat är det man står i när inget
 * sparat schema är öppet; det finns bara som val just då.
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
 * Ett sparat val gäller bara om det fortfarande går att välja: schemat finns
 * kvar, och huvudschemat bara när inget schema är öppet. Annars Tomt schema.
 */
export const resolveScheduleSource = (
  source: NewScheduleSource,
  archives: Pick<PlannerArchiveSummary, 'id'>[],
  activeArchiveId: string | null
): NewScheduleSource => {
  if (source.kind === 'archive') {
    return archives.some(archive => archive.id === source.id) ? source : { kind: 'empty' };
  }
  if (source.kind === 'main') {
    return activeArchiveId === null ? source : { kind: 'empty' };
  }
  return source;
};

export type CreateScheduleService = {
  createArchive: (name: string) => Promise<PlannerArchiveSummary>;
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
 * Den enda vägen till ett nytt schema: Nytt schema, Duplicera och Utgå från
 * går alla hit.
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
  source,
  previousArchiveId,
  service,
}: {
  name: string;
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
  const created = await service.createArchive(name);

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
