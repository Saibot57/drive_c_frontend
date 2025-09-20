// src/services/scheduleService.ts
import { fetchWithAuth } from './authService';

import type { Activity, FamilyMember, Settings, CreateActivityPayload } from '@/components/familjeschema/types';
import type { ActivityImportItem } from '@/types/schedule';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tobiaslundh1.pythonanywhere.com/api';
const SCHEDULE_API_URL =
  process.env.NEXT_PUBLIC_SCHEDULE_API_URL || `${API_URL}/schedule`;

export const scheduleService = {
  async parseScheduleWithAI(
    text: string,
    week: number,
    year: number,
  ): Promise<ActivityImportItem[]> {
    try {
      const response = await fetchWithAuth(`${SCHEDULE_API_URL}/ai-parse-schedule`, {
        method: 'POST',
        body: JSON.stringify({ text, week, year }),
        signal: AbortSignal.timeout(30000),
      });

      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 502) {
          throw new Error(
            payload?.error || 'AI-tjänsten är inte tillgänglig just nu. Försök igen senare.',
          );
        }
        if (response.status === 422) {
          throw new Error(payload?.error || 'AI returnerade ogiltiga aktiviteter.');
        }
        throw new Error(payload?.error || 'AI-tolkning misslyckades.');
      }

      if (!payload?.success || !Array.isArray(payload?.data?.activities)) {
        throw new Error('AI gav inga giltiga aktiviteter.');
      }

      return payload.data.activities as ActivityImportItem[];
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('AI-tolkningen tog för lång tid. Försök med kortare text.');
      }
      throw error;
    }
  },

  // --- Aktiviteter ---
  async getActivities(year: number, week: number): Promise<Activity[]> {
    const url = `${SCHEDULE_API_URL}/activities?year=${year}&week=${week}`;
    const response = await fetchWithAuth(url);
    if (!response.ok) throw new Error('Failed to fetch activities');
    const data = await response.json();
    return data.data || [];
  },

  async createActivity(activityData: CreateActivityPayload): Promise<Activity[]> {
    const body: Record<string, unknown> = { ...activityData };
    if (activityData.recurringEndDate) {
      body.recurringEndDate = activityData.recurringEndDate;
    }
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/activities`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Failed to create activity');
    const data = await response.json();
    return Array.isArray(data.data) ? data.data : data.data ? [data.data] : [];
  },

  async updateActivity(id: string, activityData: CreateActivityPayload): Promise<Activity> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(activityData),
    });
    if (!response.ok) throw new Error('Failed to update activity');
    const data = await response.json();
    return data.data;
  },

  async updateActivitySeries(seriesId: string, activityData: Partial<Activity>): Promise<Activity[]> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/activities/series/${seriesId}`, {
      method: 'PUT',
      body: JSON.stringify(activityData),
    });
    if (!response.ok) throw new Error('Failed to update activity series');
    const data = await response.json();
    return data.data || [];
  },

  async deleteActivity(id: string): Promise<void> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/activities/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete activity');
  },

  async deleteActivitySeries(seriesId: string): Promise<void> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/activities/series/${seriesId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete activity series');
  },

  // --- LLM/JSON Import ---
  async addActivitiesFromJson(activities: ActivityImportItem[]): Promise<any> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/add-activities`, {
      method: 'POST',
      body: JSON.stringify({ activities }),
    });
    const payload = await response.json();
    if (!response.ok || !payload?.success) {
      const error = new Error(payload?.error || 'Import misslyckades.');
      if (payload?.conflicts) {
        (error as any).details = payload.conflicts;
      }
      throw error;
    }
    return payload.data;
  },

  // --- Familjemedlemmar ---
  async getFamilyMembers(): Promise<FamilyMember[]> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/family-members`);
    if (!response.ok) throw new Error('Failed to fetch family members');
    const data = await response.json();
    return data.data || [];
  },

  async createFamilyMember(member: { name: string; color: string; icon: string }): Promise<FamilyMember> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/family-members`, {
      method: 'POST',
      body: JSON.stringify(member),
    });
    if (!response.ok) throw new Error('Failed to create family member');
    const data = await response.json();
    return data.data;
  },

  async updateFamilyMember(
    id: string,
    updates: Partial<{ name: string; color: string; icon: string }>
  ): Promise<FamilyMember> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/family-members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update family member');
    const data = await response.json();
    return data.data;
  },

  async deleteFamilyMember(id: string): Promise<void> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/family-members/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      let msg = 'Kunde inte ta bort medlem.';
      try {
        const data = await response.json();
        if (data?.error) msg = data.error;
      } catch {
        // keep default msg
      }
      throw new Error(msg);
    }
  },

  async reorderFamilyMembers(memberIds: string[]): Promise<FamilyMember[]> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/family-members/reorder`, {
      method: 'POST',
      body: JSON.stringify({ order: memberIds }),
    });
    if (!response.ok) throw new Error('Failed to reorder family members');
    const data = await response.json();
    return data.data || [];
  },

  // --- Inställningar ---
  async getSettings(): Promise<Settings> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/settings`);
    if (!response.ok) throw new Error('Failed to fetch settings');
    const data = await response.json();
    return data.data;
  },

  async updateSettings(settings: Settings): Promise<Settings> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings)
    });
    if (!response.ok) throw new Error('Failed to update settings');
    const data = await response.json();
    return data.data;
  }
};
