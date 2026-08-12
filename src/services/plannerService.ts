import { fetchWithAuth } from './authService';
import type { PlannerActivity, PlannerArchiveSummary } from '@/types/schedule';

import { API_URL } from '@/config/api';
const PLANNER_API_URL = `${API_URL}/planner`;

type PlannerSyncResponse = {
  activities: PlannerActivity[];
  count: number;
};

/** Kastas när någon annan har schemat öppet, så anroparen kan gå i läsläge. */
export class ArchiveLockedError extends Error {
  holder: string;

  constructor(message: string, holder: string) {
    super(message);
    this.name = 'ArchiveLockedError';
    this.holder = holder;
  }
}

type ArchiveActivitiesResult = {
  archive: PlannerArchiveSummary;
  activities: PlannerActivity[];
};

const unwrap = (payload: any) => (
  payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
);

/** Backend svarar 409 när låset sitter hos någon annan. */
const assertNotLocked = async (response: Response) => {
  if (response.status !== 409) return;
  const payload = await response.json().catch(() => null);
  throw new ArchiveLockedError(
    payload?.error || 'Någon annan har schemat öppet.',
    payload?.data?.lockedBy || 'Någon annan',
  );
};

type PlannerSyncPayload = {
  activities?: unknown;
  count?: unknown;
  data?: {
    activities?: unknown;
    count?: unknown;
  };
};

const normalizePlannerSyncResponse = (payload: unknown): PlannerSyncResponse => {
  if (!payload || typeof payload !== 'object') {
    return { activities: [], count: 0 };
  }

  const typedPayload = payload as PlannerSyncPayload;
  const dataPayload = typedPayload.data && typeof typedPayload.data === 'object'
    ? (typedPayload.data as PlannerSyncPayload['data'])
    : undefined;

  const directActivities = Array.isArray(typedPayload.activities)
    ? (typedPayload.activities as PlannerActivity[])
    : undefined;
  const dataActivities = Array.isArray(dataPayload?.activities)
    ? (dataPayload?.activities as PlannerActivity[])
    : undefined;

  const activities = directActivities ?? dataActivities ?? [];
  const directCount = typeof typedPayload.count === 'number' ? typedPayload.count : undefined;
  const dataCount = typeof dataPayload?.count === 'number' ? dataPayload.count : undefined;
  const count = directCount ?? dataCount ?? activities.length;

  return { activities, count };
};

export const plannerService = {
  async getPlannerActivities(): Promise<PlannerActivity[]> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/activities`);
    if (!response.ok) {
      throw new Error('Kunde inte hämta planeringsaktiviteter.');
    }
    const payload = await response.json();
    if (Array.isArray(payload?.data)) {
      return payload.data as PlannerActivity[];
    }
    if (Array.isArray(payload)) {
      return payload as PlannerActivity[];
    }
    return [];
  },

  async syncActivities(activities: PlannerActivity[]): Promise<PlannerSyncResponse> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/activities`, {
      method: 'POST',
      body: JSON.stringify({ activities }),
    });
    if (!response.ok) {
      throw new Error('Kunde inte synka planeringsaktiviteter.');
    }
    const payload = await response.json();
    return normalizePlannerSyncResponse(payload);
  },

  async deletePlannerActivity(id: string): Promise<void> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Kunde inte ta bort planeringsaktivitet.');
    }
  },

  async savePlannerArchive(name: string, activities: PlannerActivity[]): Promise<PlannerActivity[]> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/activities`, {
      method: 'POST',
      body: JSON.stringify({ archiveName: name, activities }),
    });
    if (!response.ok) {
      throw new Error('Kunde inte spara planeringsarkiv.');
    }
    const payload = await response.json();
    if (Array.isArray(payload?.data?.activities)) {
      return payload.data.activities as PlannerActivity[];
    }
    if (Array.isArray(payload?.data)) {
      return payload.data as PlannerActivity[];
    }
    if (Array.isArray(payload)) {
      return payload as PlannerActivity[];
    }
    return [];
  },

  async getPlannerArchive(name: string): Promise<PlannerActivity[]> {
    const response = await fetchWithAuth(
      `${PLANNER_API_URL}/activities?archive_name=${encodeURIComponent(name)}`,
    );
    if (!response.ok) {
      throw new Error('Kunde inte hämta planeringsarkiv.');
    }
    const payload = await response.json();
    if (Array.isArray(payload?.data)) {
      return payload.data as PlannerActivity[];
    }
    if (Array.isArray(payload)) {
      return payload as PlannerActivity[];
    }
    return [];
  },

  async deletePlannerArchive(name: string): Promise<void> {
    const response = await fetchWithAuth(
      `${PLANNER_API_URL}/activities?archive_name=${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    );
    if (!response.ok) {
      throw new Error('Kunde inte ta bort planeringsarkiv.');
    }
  },

  /**
   * Namnen på de egna schemana. Används av workspace-importen, provenance och
   * Command Center, som läser arkiv via de namnbaserade endpointerna och därför
   * inte kan nå någon annans schema. Planeraren själv går på id.
   */
  async getPlannerArchiveNames(): Promise<string[]> {
    const archives = await plannerService.listArchives();
    return archives.filter(archive => archive.isOwner).map(archive => archive.name);
  },

  // --- Delade scheman ---
  //
  // Namnbaserat räckte så länge alla scheman var privata. Ett delat schema kan
  // heta samma sak som ett eget, så allt härifrån och ner går på id.

  async listArchives(): Promise<PlannerArchiveSummary[]> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/archives`);
    if (!response.ok) {
      throw new Error('Kunde inte hämta scheman.');
    }
    const archives = unwrap(await response.json());
    return Array.isArray(archives) ? (archives as PlannerArchiveSummary[]) : [];
  },

  async createArchive(name: string): Promise<PlannerArchiveSummary> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/archives`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Kunde inte skapa schemat.');
    }
    return unwrap(payload) as PlannerArchiveSummary;
  },

  async getArchiveActivities(archiveId: string): Promise<ArchiveActivitiesResult> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/archives/${archiveId}/activities`);
    if (!response.ok) {
      throw new Error('Kunde inte hämta schemat.');
    }
    const result = unwrap(await response.json());
    return {
      archive: result?.archive,
      activities: Array.isArray(result?.activities) ? result.activities : [],
    };
  },

  async saveArchiveActivities(
    archiveId: string,
    activities: PlannerActivity[],
  ): Promise<ArchiveActivitiesResult> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/archives/${archiveId}/activities`, {
      method: 'PUT',
      body: JSON.stringify({ activities }),
    });
    await assertNotLocked(response);
    if (!response.ok) {
      throw new Error('Kunde inte spara schemat.');
    }
    const result = unwrap(await response.json());
    return {
      archive: result?.archive,
      activities: Array.isArray(result?.activities) ? result.activities : [],
    };
  },

  async deleteArchive(archiveId: string): Promise<void> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/archives/${archiveId}`, {
      method: 'DELETE',
    });
    await assertNotLocked(response);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Kunde inte ta bort schemat.');
    }
  },

  /**
   * Tar låset. `acquired: false` betyder att någon annan har det — skicka
   * `force` för att ta över, men först efter att användaren fått veta vem.
   */
  async acquireArchiveLock(
    archiveId: string,
    options: { force?: boolean } = {},
  ): Promise<{ acquired: boolean; archive: PlannerArchiveSummary }> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/archives/${archiveId}/lock`, {
      method: 'POST',
      body: JSON.stringify({ force: Boolean(options.force) }),
    });
    if (!response.ok) {
      throw new Error('Kunde inte öppna schemat.');
    }
    return unwrap(await response.json());
  },

  async releaseArchiveLock(archiveId: string): Promise<void> {
    await fetchWithAuth(`${PLANNER_API_URL}/archives/${archiveId}/lock`, { method: 'DELETE' });
  },

  /**
   * Släpper låset när fliken stängs. Vanlig fetch hinner avbrytas vid unload,
   * så anropet måste märkas som keepalive för att komma iväg.
   */
  releaseArchiveLockOnUnload(archiveId: string): void {
    void fetchWithAuth(`${PLANNER_API_URL}/archives/${archiveId}/lock`, {
      method: 'DELETE',
      keepalive: true,
    }).catch(() => undefined);
  },

  async addArchiveShare(archiveId: string, username: string): Promise<PlannerArchiveSummary> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/archives/${archiveId}/shares`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      // Backend skickar en läsbar orsak (okänd användare, redan delad, för
      // många delningar) — visa den i stället för en generisk text.
      throw new Error(payload?.error || 'Kunde inte dela schemat.');
    }
    return unwrap(payload) as PlannerArchiveSummary;
  },

  async removeArchiveShare(archiveId: string, username: string): Promise<void> {
    const response = await fetchWithAuth(
      `${PLANNER_API_URL}/archives/${archiveId}/shares/${encodeURIComponent(username)}`,
      { method: 'DELETE' },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Kunde inte ta bort delningen.');
    }
  },
};
