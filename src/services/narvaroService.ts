import { fetchWithAuth } from './authService';
import { API_URL } from '@/config/api';

/**
 * Närvarorutornas krypterade dokument (`/api/narvaro`). Servern ser bara
 * nyckeln (`keyinfo`, `settings` eller en vecka som `w2026-45`), versionen
 * och chiffertexten. Krypteringen görs i `utils/narvaroCrypto.ts`.
 */

const NARVARO_API_URL = `${API_URL}/narvaro`;

export type NarvaroDocument = { key: string; version: number; payload: string; updatedAt: string | null };

/** Dokumentet har sparats från en annan enhet sedan det lästes. */
export class NarvaroConflictError extends Error {
  constructor(public key: string, public currentVersion: number | null) {
    super('Ändrat på en annan enhet.');
    this.name = 'NarvaroConflictError';
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

const docUrl = (key: string) => `${NARVARO_API_URL}/${encodeURIComponent(key)}`;

const isDocument = (d: unknown): d is NarvaroDocument =>
  typeof d === 'object' && d !== null
  && typeof (d as NarvaroDocument).key === 'string'
  && typeof (d as NarvaroDocument).version === 'number'
  && typeof (d as NarvaroDocument).payload === 'string';

export const narvaroService = {
  /** Alla dokument. Servern gallrar veckor äldre än ett läsår först. */
  async list(): Promise<NarvaroDocument[]> {
    const data = await readData<unknown>(await fetchWithAuth(NARVARO_API_URL), 'Kunde inte hämta närvaron.');
    return Array.isArray(data) ? data.filter(isDocument) : [];
  },

  /** Version 0 skapar dokumentet. */
  async put(key: string, payload: string, version: number, { keepalive = false } = {}): Promise<NarvaroDocument> {
    const response = await fetchWithAuth(docUrl(key), {
      method: 'PUT',
      body: JSON.stringify({ version, payload }),
      keepalive,
    });
    if (response.status === 409) {
      const body = await response.json().catch(() => null);
      const current = body?.data?.version;
      throw new NarvaroConflictError(key, typeof current === 'number' ? current : null);
    }
    const doc = await readData<unknown>(response, 'Kunde inte spara.');
    if (!isDocument(doc)) throw new Error('Kunde inte spara.');
    return doc;
  },

  /** Tar bort allt, för den som glömt lösenfrasen. */
  async deleteAll(): Promise<void> {
    const response = await fetchWithAuth(NARVARO_API_URL, {
      method: 'DELETE',
      body: JSON.stringify({ confirm: true }),
    });
    await readData(response, 'Kunde inte ta bort.');
  },
};
