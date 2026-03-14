/**
 * themeService.ts — typed API client for /api/theme.
 */

import { fetchWithAuth } from '@/services/authService';
import { API_URL } from '@/config/api';

const BASE = `${API_URL}/theme`;

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

async function unwrap<T>(res: Response): Promise<T> {
  let json: ApiEnvelope<T>;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server svarade med HTTP ${res.status} och ogiltigt JSON.`);
  }
  if (!json.success) {
    throw new Error(json.error ?? `API-fel (HTTP ${res.status}).`);
  }
  return json.data;
}

export interface ThemePresetDTO {
  id: string;
  name: string;
  tokens: Record<string, string>;
  created_at: string;
}

export const themeService = {
  async getTheme(): Promise<Record<string, string>> {
    const res = await fetchWithAuth(`${BASE}`);
    return unwrap<Record<string, string>>(res);
  },

  async saveTheme(tokens: Record<string, string>): Promise<void> {
    const res = await fetchWithAuth(`${BASE}`, {
      method: 'PUT',
      body: JSON.stringify({ tokens }),
    });
    await unwrap(res);
  },

  async resetTheme(): Promise<void> {
    const res = await fetchWithAuth(`${BASE}`, { method: 'DELETE' });
    await unwrap(res);
  },

  async getPresets(): Promise<ThemePresetDTO[]> {
    const res = await fetchWithAuth(`${BASE}/presets`);
    return unwrap<ThemePresetDTO[]>(res);
  },

  async createPreset(name: string, tokens: Record<string, string>): Promise<ThemePresetDTO> {
    const res = await fetchWithAuth(`${BASE}/presets`, {
      method: 'POST',
      body: JSON.stringify({ name, tokens }),
    });
    return unwrap<ThemePresetDTO>(res);
  },

  async deletePreset(id: string): Promise<void> {
    const res = await fetchWithAuth(`${BASE}/presets/${id}`, { method: 'DELETE' });
    await unwrap<{ deleted_id: string }>(res);
  },
};
