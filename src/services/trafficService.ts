import { fetchWithAuth } from './authService';
import { API_URL } from '@/config/api';
import type { TrafficSummary } from '@/types/traffic';

/**
 * Trafikstatistiken (`/api/trafik`). Backend räknar ihop sin access-logg och
 * skickar bara summor. Konton som inte står i backendens TRAFFIC_VIEWERS får
 * 404, som om routen inte fanns.
 */

/** Kontot får inte se statistiken, eller så har backend inte routen än. */
export class TrafficNotAvailableError extends Error {
  constructor() {
    super('Trafikstatistiken finns inte för det här kontot.');
    this.name = 'TrafficNotAvailableError';
  }
}

export const trafficService = {
  async get(days: number): Promise<TrafficSummary> {
    const response = await fetchWithAuth(`${API_URL}/trafik?dagar=${days}`);
    if (response.status === 404) throw new TrafficNotAvailableError();
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success === false || !payload?.data?.totals) {
      throw new Error(payload?.error || 'Kunde inte hämta statistiken.');
    }
    return payload.data as TrafficSummary;
  },
};
