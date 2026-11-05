import { beforeEach, describe, expect, it, vi } from 'vitest';

// En vanlig funktion i stället för vi.fn: spionen kopplar egna hanterare på
// ett avvisat löfte, och vitest räknar då nätverksfelet som ohanterat.
let respond: () => Promise<Response> = () => Promise.reject(new Error('inget svar satt'));
const calls: string[] = [];
vi.mock('./authService', () => ({
  fetchWithAuth: (url: string) => {
    calls.push(url);
    return respond();
  },
}));

import { TrafficNotAvailableError, trafficService } from './trafficService';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('trafficService.get', () => {
  beforeEach(() => { calls.length = 0; });

  it('ger statistiken vid lyckat svar', async () => {
    respond = async () => json(200, { success: true, data: { totals: { publicViews: 3 } }, error: null });
    await expect(trafficService.get(7)).resolves.toMatchObject({ totals: { publicViews: 3 } });
    expect(calls[0]).toMatch(/\/trafik\?dagar=7$/);
  });

  it('översätter nätverksfel till en begriplig text', async () => {
    respond = () => Promise.reject(new TypeError('Failed to fetch'));
    await expect(trafficService.get(7)).rejects.toThrow('Servern svarade inte. Är backend uppdaterad och omladdad?');
  });

  it('säger att statistiken inte finns vid 404', async () => {
    respond = async () => json(404, { success: false, data: null, error: 'Resource not found' });
    await expect(trafficService.get(7)).rejects.toBeInstanceOf(TrafficNotAvailableError);
  });

  it('visar backendens felmeddelande', async () => {
    respond = async () => json(503, { success: false, data: null, error: 'Loggen kunde inte läsas.' });
    await expect(trafficService.get(7)).rejects.toThrow('Loggen kunde inte läsas.');
  });
});
