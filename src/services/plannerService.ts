import { fetchWithAuth } from './authService';
import type {
  PlannerActivity,
  PlannerArchiveSummary,
  ScheduleKind,
  PlannerPublicLink,
  PublicLinkDisplayConfig,
} from '@/types/schedule';

import { API_URL } from '@/config/api';
import { HttpStatusError } from '@/utils/saveRetry';
import { withKeepalive } from '@/utils/keepalive';
const PLANNER_API_URL = `${API_URL}/planner`;

/** Kastas när någon annan har schemat öppet, så anroparen kan gå i läsläge. */
export class ArchiveLockedError extends Error {
  holder: string;

  constructor(message: string, holder: string) {
    super(message);
    this.name = 'ArchiveLockedError';
    this.holder = holder;
  }
}

/**
 * Schemat har sparats någon annanstans sedan det lästes in: en annan flik, en
 * annan dator eller en kollega som tagit över. Sparningen nekades och ingenting
 * skrevs. `version` är den version som nu är sparad.
 */
export class ArchiveConflictError extends Error {
  version: number | null;

  constructor(message: string, version: number | null) {
    super(message);
    this.name = 'ArchiveConflictError';
    this.version = version;
  }
}

/**
 * Schemat finns inte, eller du når det inte längre. Backend skiljer inte på
 * de två (404 i båda fallen), och för den som läser är det samma sak.
 */
export class ArchiveNotFoundError extends Error {
  constructor(message = 'Schemat finns inte.') {
    super(message);
    this.name = 'ArchiveNotFoundError';
  }
}

type ArchiveActivitiesResult = {
  archive: PlannerArchiveSummary;
  activities: PlannerActivity[];
};

const unwrap = (payload: any) => (
  payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
);

/**
 * Backend svarar 409 när låset sitter hos någon annan, och när en sparning
 * bygger på en version som inte längre är den sparade.
 */
const assertNotLocked = async (response: Response) => {
  if (response.status !== 409) return;
  const payload = await response.json().catch(() => null);
  if (payload?.data?.conflict === 'version') {
    const version = payload.data.version;
    throw new ArchiveConflictError(
      payload?.error || 'Schemat har ändrats någon annanstans.',
      typeof version === 'number' ? version : null,
    );
  }
  throw new ArchiveLockedError(
    payload?.error || 'Någon annan har schemat öppet.',
    payload?.data?.lockedBy || 'Någon annan',
  );
};

export const plannerService = {
  /**
   * Det gamla huvudschemat. Planeraren skriver inte längre dit, men läser det
   * när någon vill göra ett schema av det som ligger där, och workspace
   * jämför element som en gång hämtats därifrån (docs/plans/basscheman.md, 5).
   */
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

  /**
   * Namnen på de egna schemana. Används bara av workspace-härkomsten, för
   * schemadagar hämtade innan de fick schemats id. Den namnbaserade vägen når
   * inte någon annans schema; allt nytt går på id.
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
      throw new Error(`Kunde inte hämta scheman (HTTP ${response.status}).`);
    }
    const archives = unwrap(await response.json());
    return Array.isArray(archives) ? (archives as PlannerArchiveSummary[]) : [];
  },

  async createArchive(
    name: string,
    kind: ScheduleKind = 'week',
    folder: string | null = null
  ): Promise<PlannerArchiveSummary> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/archives`, {
      method: 'POST',
      // Utan mapp skickas ingen nyckel, så att en äldre backend inte får något nytt.
      body: JSON.stringify(folder ? { name, kind, folder } : { name, kind }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Kunde inte skapa schemat.');
    }
    return unwrap(payload) as PlannerArchiveSummary;
  },

  /**
   * Gör om ett schema till basschema eller veckoschema. Bara ägaren får, och
   * inte medan någon annan har schemat öppet (ArchiveLockedError).
   */
  async setArchiveKind(archiveId: string, kind: ScheduleKind): Promise<PlannerArchiveSummary> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/archives/${archiveId}`, {
      method: 'PATCH',
      body: JSON.stringify({ kind }),
    });
    await assertNotLocked(response);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Kunde inte byta sort på schemat.');
    }
    return unwrap(payload) as PlannerArchiveSummary;
  },

  /**
   * Byter namn på ett schema. Bara ägaren får. Väntar inte på låset: namnet
   * rör inte posterna, så den som har schemat öppet sparar vidare. 409 här
   * betyder att namnet är upptaget, inte att schemat är låst.
   */
  async renameArchive(archiveId: string, name: string): Promise<PlannerArchiveSummary> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/archives/${archiveId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Kunde inte byta namn på schemat.');
    }
    return unwrap(payload) as PlannerArchiveSummary;
  },

  async getArchiveActivities(archiveId: string): Promise<ArchiveActivitiesResult> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/archives/${archiveId}/activities`);
    if (response.status === 404) {
      throw new ArchiveNotFoundError();
    }
    if (!response.ok) {
      throw new Error(`Kunde inte hämta schemat (HTTP ${response.status}).`);
    }
    const result = unwrap(await response.json());
    return {
      archive: result?.archive,
      activities: Array.isArray(result?.activities) ? result.activities : [],
    };
  },

  /**
   * Ersätter schemats poster. `baseVersion` är versionen vyn lästes in eller
   * senast sparades som. Kastar ArchiveConflictError om schemat hunnit ändras
   * och ArchiveLockedError om någon annan har låset.
   *
   * `keepalive` när sidan lämnas (se utils/keepalive.ts). `releaseLock` när
   * fliken stängs eller planeraren lämnas: servern sparar och släpper låset i
   * samma steg, så att ett släpp som landar före sparningen inte låter
   * sparningen ta tillbaka låset. En äldre backend ignorerar flaggan.
   */
  async saveArchiveActivities(
    archiveId: string,
    activities: PlannerActivity[],
    baseVersion: number | null,
    options: { keepalive?: boolean; releaseLock?: boolean } = {},
  ): Promise<ArchiveActivitiesResult> {
    const body = JSON.stringify(
      options.releaseLock ? { activities, baseVersion, releaseLock: true } : { activities, baseVersion }
    );
    const response = await withKeepalive(body, Boolean(options.keepalive), keepalive => (
      fetchWithAuth(`${PLANNER_API_URL}/archives/${archiveId}/activities`, { method: 'PUT', body, keepalive })
    ));
    await assertNotLocked(response);
    if (!response.ok) {
      // Ett 400 säger vilken post som inte gick att spara, till exempel en för
      // lång titel. Övriga fel kan bära serverns interna text och visas inte.
      // Statusen följer med, så att autosparet bara försöker igen när felet
      // kan gå över.
      const payload = response.status === 400 ? await response.json().catch(() => null) : null;
      throw new HttpStatusError(
        payload?.error ? `Kunde inte spara schemat. ${payload.error}` : 'Kunde inte spara schemat.',
        response.status,
      );
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

  // --- Mappar ---
  //
  // En mapp är `folder` på schemat. Bara ägaren flyttar, och alla som har
  // schemat ser samma mapp. Båda anropen svarar med de ändrade schemana.

  /** Lägger egna scheman i en mapp, eller tar ut dem med null. */
  async moveArchivesToFolder(archiveIds: string[], folder: string | null): Promise<PlannerArchiveSummary[]> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/folders/placements`, {
      method: 'PUT',
      body: JSON.stringify({ archiveIds, folder }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || 'Kunde inte flytta schemat.');
    }
    const archives = unwrap(payload);
    return Array.isArray(archives) ? (archives as PlannerArchiveSummary[]) : [];
  },

  /** Byter namn på mappen för de egna schemana. Andras mappar rörs inte. */
  async renameFolder(from: string, to: string): Promise<PlannerArchiveSummary[]> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/folders/rename`, {
      method: 'POST',
      body: JSON.stringify({ from, to }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || 'Kunde inte byta namn på mappen.');
    }
    const archives = unwrap(payload);
    return Array.isArray(archives) ? (archives as PlannerArchiveSummary[]) : [];
  },

  // --- Publika länkar ---
  //
  // Läsningen av en publik länk ligger inte här utan i publicScheduleService:
  // den får inte gå via fetchWithAuth, som väntar på en ny inloggning vid 401.

  async listPublicLinks(): Promise<PlannerPublicLink[]> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/public-links`);
    if (!response.ok) {
      throw new Error('Kunde inte hämta publika länkar.');
    }
    const links = unwrap(await response.json());
    return Array.isArray(links) ? (links as PlannerPublicLink[]) : [];
  },

  async createPublicLink(changes: PublicLinkChanges): Promise<PlannerPublicLink> {
    return sendPublicLink(`${PLANNER_API_URL}/public-links`, 'POST', changes, 'Kunde inte skapa länken.');
  },

  async updatePublicLink(linkId: string, changes: PublicLinkChanges): Promise<PlannerPublicLink> {
    return sendPublicLink(
      `${PLANNER_API_URL}/public-links/${linkId}`, 'PATCH', changes, 'Kunde inte spara länken.'
    );
  },

  async rotatePublicLink(linkId: string): Promise<PlannerPublicLink> {
    return sendPublicLink(
      `${PLANNER_API_URL}/public-links/${linkId}/rotate`, 'POST', {}, 'Kunde inte byta länk.'
    );
  },

  async deletePublicLink(linkId: string): Promise<void> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/public-links/${linkId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Kunde inte ta bort länken.');
    }
  },
};

export type PublicLinkChanges = {
  label?: string | null;
  archiveId?: string | null;
  enabled?: boolean;
  displayConfig?: PublicLinkDisplayConfig;
};

const sendPublicLink = async (
  url: string,
  method: 'POST' | 'PATCH',
  changes: PublicLinkChanges,
  fallbackError: string
): Promise<PlannerPublicLink> => {
  const response = await fetchWithAuth(url, { method, body: JSON.stringify(changes) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || fallbackError);
  }
  return unwrap(payload) as PlannerPublicLink;
};
