import { fetchWithAuth } from './authService';
import { API_URL } from '@/config/api';
import { LAB_SEED } from '@/config/lessonLabSeed';
import type { LabPlan, LabPlanSummary, LabState } from '@/types/lessonLab';
import { parseLabState } from '@/utils/lessonLab';

/**
 * Arbetslags sparade upplägg (`/api/arbetslag`). Servern kontrollerar bara
 * form och storlek, så allt som läses in tvättas här med `parseLabState`.
 */

const ARBETSLAG_API_URL = `${API_URL}/arbetslag`;

/** Svaret på en sparning som utgick från en gammal version. */
export class PlanConflictError extends Error {
  constructor(public currentVersion: number | null) {
    super('Upplägget har ändrats någon annanstans.');
    this.name = 'PlanConflictError';
  }
}

/** Backend svarar {success, data, error}; felen är skrivna för användaren. */
const readData = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || fallbackMessage);
  }
  return payload?.data as T;
};

const planUrl = (id: string) => `${ARBETSLAG_API_URL}/${encodeURIComponent(id)}`;

/** Ett läge som inte går igenom tvätten ersätts av tavlan hellre än att sidan faller. */
const toPlan = (raw: LabPlanSummary & { state: unknown }): LabPlan => {
  const state = parseLabState(raw.state);
  if (!state) console.warn(`Arbetslag: upplägget ${raw.id} gick inte att läsa, visar tavlan`);
  return { ...raw, state: state ?? LAB_SEED };
};

export type SavePlanBody = { version: number; name?: string; state?: LabState };

export const arbetslagService = {
  async listPlans(): Promise<LabPlanSummary[]> {
    const response = await fetchWithAuth(ARBETSLAG_API_URL);
    const data = await readData<LabPlanSummary[]>(response, 'Kunde inte hämta uppläggen.');
    return Array.isArray(data) ? data : [];
  },

  async getPlan(id: string): Promise<LabPlan> {
    const response = await fetchWithAuth(planUrl(id));
    return toPlan(await readData(response, 'Kunde inte hämta upplägget.'));
  },

  /** Med eget id: skickas samma skapande två gånger svarar servern med det som redan finns. */
  async createPlan(plan: { id: string; name: string; state: LabState }): Promise<LabPlan> {
    const response = await fetchWithAuth(ARBETSLAG_API_URL, {
      method: 'POST',
      body: JSON.stringify(plan),
    });
    return toPlan(await readData(response, 'Kunde inte skapa upplägget.'));
  },

  async savePlan(id: string, body: SavePlanBody): Promise<LabPlan> {
    const response = await fetchWithAuth(planUrl(id), {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (response.status === 409) {
      const payload = await response.json().catch(() => null);
      const version = payload?.data?.version;
      throw new PlanConflictError(typeof version === 'number' ? version : null);
    }
    return toPlan(await readData(response, 'Kunde inte spara upplägget.'));
  },

  async deletePlan(id: string): Promise<void> {
    const response = await fetchWithAuth(planUrl(id), { method: 'DELETE' });
    await readData(response, 'Kunde inte ta bort upplägget.');
  },

  /** Ger en kollega tillgång. Svarar med upplägget utan läget. */
  async addShare(id: string, username: string): Promise<LabPlanSummary> {
    const response = await fetchWithAuth(`${planUrl(id)}/shares`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    return readData<LabPlanSummary>(response, 'Kunde inte dela upplägget.');
  },

  /** Tar bort någons tillgång, eller lämnar delningen med sitt eget namn. */
  async removeShare(id: string, username: string): Promise<void> {
    const response = await fetchWithAuth(`${planUrl(id)}/shares/${encodeURIComponent(username)}`, { method: 'DELETE' });
    await readData(response, 'Kunde inte ta bort delningen.');
  },
};
