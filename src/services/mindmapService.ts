import { fetchWithAuth } from './authService';
import { readData } from './http';
import { API_URL } from '@/config/api';
import type { MindmapDoc, MindmapMap, MindmapSummary } from '@/types/mindmapDoc';
import { sanitizeMap, sanitizeSummary } from '@/utils/mindmapDoc';

/**
 * Mindmap-sidans kartor (`/api/mindmap`). Servern kontrollerar bara att
 * dokumentet har en rot och ryms, så allt som läses in tvättas här.
 */

const MINDMAP_API_URL = `${API_URL}/mindmap`;

/** Svaret på en sparning som utgick från en gammal version. */
export class MindmapConflictError extends Error {
  constructor(public currentVersion: number | null, public updatedAt: string | null) {
    super('Kartan har ändrats någon annanstans.');
    this.name = 'MindmapConflictError';
  }
}

const mapUrl = (id: string) => `${MINDMAP_API_URL}/${encodeURIComponent(id)}`;

const toMap = (raw: unknown, fallbackMessage: string): MindmapMap => {
  const map = sanitizeMap(raw);
  if (!map) throw new Error(fallbackMessage);
  return map;
};

export type SaveMindmapBody = { version: number; name?: string; doc?: MindmapDoc };

export const mindmapService = {
  async list(): Promise<MindmapSummary[]> {
    const response = await fetchWithAuth(MINDMAP_API_URL);
    const data = await readData<unknown[]>(response, 'Kunde inte hämta kartorna.');
    return Array.isArray(data) ? data.map(sanitizeSummary).filter((x): x is MindmapSummary => x !== null) : [];
  },

  async get(id: string): Promise<MindmapMap> {
    const response = await fetchWithAuth(mapUrl(id));
    return toMap(await readData(response, 'Kunde inte hämta kartan.'), 'Kartan gick inte att läsa.');
  },

  /** Med eget id: skickas samma skapande två gånger svarar servern med det som redan finns. */
  async create(map: { id: string; name: string; doc: MindmapDoc }): Promise<MindmapMap> {
    const response = await fetchWithAuth(MINDMAP_API_URL, {
      method: 'POST',
      body: JSON.stringify(map),
    });
    return toMap(await readData(response, 'Kunde inte skapa kartan.'), 'Kartan gick inte att läsa.');
  },

  async update(id: string, body: SaveMindmapBody, { keepalive = false } = {}): Promise<MindmapMap> {
    const response = await fetchWithAuth(mapUrl(id), {
      method: 'PUT',
      body: JSON.stringify(body),
      keepalive,
    });
    if (response.status === 409) {
      const payload = await response.json().catch(() => null);
      const version = payload?.data?.version;
      const updatedAt = payload?.data?.updatedAt;
      throw new MindmapConflictError(
        typeof version === 'number' ? version : null,
        typeof updatedAt === 'string' ? updatedAt : null,
      );
    }
    return toMap(await readData(response, 'Kunde inte spara kartan.'), 'Kartan gick inte att läsa.');
  },

  async remove(id: string): Promise<void> {
    const response = await fetchWithAuth(mapUrl(id), { method: 'DELETE' });
    await readData(response, 'Kunde inte ta bort kartan.');
  },
};
