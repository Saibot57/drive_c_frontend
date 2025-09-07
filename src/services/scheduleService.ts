// src/services/scheduleService.ts
import { fetchWithAuth } from './authService';

// Vi importerar typerna från den plats de kommer att ha efter migreringen
import type { Activity, FamilyMember, Settings } from '@/components/familjeschema/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tobiaslundh1.pythonanywhere.com/api';
const SCHEDULE_API_URL = `${API_URL}/schedule`;

// Typ för JSON-import från LLM
type ActivityImportItem = Partial<Omit<Activity, 'id'>>;

export const scheduleService = {
  
  // --- Aktiviteter ---
  async getActivities(): Promise<Activity[]> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/activities`);
    if (!response.success) throw new Error(response.error || 'Failed to fetch activities');
    return response.data?.data || [];
  },

  async createActivity(activityData: Partial<Activity>): Promise<Activity> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/activities`, {
      method: 'POST',
      body: JSON.stringify(activityData),
    });
    if (!response.success) {
      console.error('Failed to create activity:', response);
      throw new Error(response.error || 'Failed to create activity');
    }
    return response.data.data;
  },

  async updateActivity(id: string, activityData: Partial<Activity>): Promise<Activity> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(activityData),
    });
    if (!response.success) throw new Error(response.error || 'Failed to update activity');
    return response.data.data;
  },

  async deleteActivity(id: string): Promise<void> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/activities/${id}`, {
      method: 'DELETE',
    });
    if (!response.success) throw new Error(response.error || 'Failed to delete activity');
  },

  async deleteActivitySeries(seriesId: string): Promise<void> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/activities/series/${seriesId}`, {
      method: 'DELETE',
    });
    if (!response.success) throw new Error(response.error || 'Failed to delete activity series');
  },

  // --- LLM/JSON Import ---
  async addActivitiesFromJson(activities: ActivityImportItem[]): Promise<any> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/add-activities`, {
      method: 'POST',
      body: JSON.stringify({ activities }),
    });
    if (!response.success) {
        const error = new Error(response.error || 'Failed to import activities');
        (error as any).details = response.data?.conflicts;
        throw error;
    }
    return response.data;
  },

  // --- Familjemedlemmar ---
  async getFamilyMembers(): Promise<FamilyMember[]> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/family-members`);
    if (!response.success) throw new Error(response.error || 'Failed to fetch family members');
    return response.data?.data || [];
  },

  // ... (funktioner för att skapa/uppdatera/ta bort familjemedlemmar kan läggas till här)

  // --- Inställningar ---
  async getSettings(): Promise<Settings> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/settings`);
    if (!response.success) throw new Error(response.error || 'Failed to fetch settings');
    return response.data.data;
  },

  async updateSettings(settings: Settings): Promise<Settings> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings)
    });
    if (!response.success) throw new Error(response.error || 'Failed to update settings');
    return response.data.data;
  }
};