import { fetchWithAuth } from './authService';
import { API_URL } from '@/config/api';
import type { ThemeArea, ThemeWheel, ThemeWheelSummary } from '@/types/themeWheel';

const THEME_API_URL = `${API_URL}/theme`;

type ShareResult = {
  name: string;
  recipient: string;
};

/**
 * Backend svarar alltid {success, data, error}. Felmeddelandena därifrån är
 * skrivna för användaren, så de skickas vidare i stället för en generisk text.
 */
const readData = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || fallbackMessage);
  }
  return payload?.data as T;
};

/** Hjulet skickas utan id – servern äger det, och blocken kan sakna fält. */
const toPayload = (wheel: ThemeWheel) => ({
  name: wheel.name,
  startWeek: wheel.startWeek,
  startYear: wheel.startYear,
  weekCount: wheel.weekCount,
  holidayWeeks: wheel.holidayWeeks,
  blocks: wheel.blocks,
});

export const themeWheelService = {
  async listWheels(): Promise<ThemeWheelSummary[]> {
    const response = await fetchWithAuth(`${THEME_API_URL}/wheels`);
    const data = await readData<ThemeWheelSummary[]>(response, 'Kunde inte hämta hjulen.');
    return Array.isArray(data) ? data : [];
  },

  async getWheel(id: string): Promise<ThemeWheel> {
    const response = await fetchWithAuth(`${THEME_API_URL}/wheels/${encodeURIComponent(id)}`);
    return readData<ThemeWheel>(response, 'Kunde inte hämta hjulet.');
  },

  async createWheel(wheel: ThemeWheel): Promise<ThemeWheel> {
    const response = await fetchWithAuth(`${THEME_API_URL}/wheels`, {
      method: 'POST',
      body: JSON.stringify(toPayload(wheel)),
    });
    return readData<ThemeWheel>(response, 'Kunde inte skapa hjulet.');
  },

  async updateWheel(id: string, wheel: ThemeWheel): Promise<ThemeWheel> {
    const response = await fetchWithAuth(`${THEME_API_URL}/wheels/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(toPayload(wheel)),
    });
    return readData<ThemeWheel>(response, 'Kunde inte spara hjulet.');
  },

  async deleteWheel(id: string): Promise<void> {
    const response = await fetchWithAuth(`${THEME_API_URL}/wheels/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await readData(response, 'Kunde inte ta bort hjulet.');
  },

  async duplicateWheel(
    id: string,
    options: { name?: string; startWeek?: number; startYear?: number } = {}
  ): Promise<ThemeWheel> {
    const response = await fetchWithAuth(`${THEME_API_URL}/wheels/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
    return readData<ThemeWheel>(response, 'Kunde inte duplicera hjulet.');
  },

  async shareWheel(id: string, toUsername: string): Promise<ShareResult> {
    const response = await fetchWithAuth(`${THEME_API_URL}/wheels/${encodeURIComponent(id)}/share`, {
      method: 'POST',
      body: JSON.stringify({ toUsername }),
    });
    return readData<ShareResult>(response, 'Kunde inte dela hjulet.');
  },

  async listAreas(): Promise<ThemeArea[]> {
    const response = await fetchWithAuth(`${THEME_API_URL}/areas`);
    const data = await readData<ThemeArea[]>(response, 'Kunde inte hämta biblioteket.');
    return Array.isArray(data) ? data : [];
  },

  async syncAreas(areas: ThemeArea[]): Promise<ThemeArea[]> {
    const response = await fetchWithAuth(`${THEME_API_URL}/areas/sync`, {
      method: 'POST',
      body: JSON.stringify({ areas }),
    });
    const data = await readData<ThemeArea[]>(response, 'Kunde inte spara biblioteket.');
    return Array.isArray(data) ? data : [];
  },
};
