// src/services/scheduleService.ts
import { fetchWithAuth } from './authService';

// Vi importerar typerna från den plats de kommer att ha efter migreringen
import type { Activity, FamilyMember, Settings } from '@/components/familjeschema/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tobiaslundh1.pythonanywhere.com/api';
const SCHEDULE_API_URL = `${API_URL}/schedule`;

// Typ för JSON-import från LLM
type ActivityImportItem = Partial<Omit<Activity, 'id'>>;

export const createActivity = async (
  activity: Omit<Activity, 'id' | 'seriesId'>,
  token: string
): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/schedule/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(activity),
    });

    const data = await response.json();
    if (!response.ok) {
      // Använd felmeddelandet från servern om det finns, annars ett standardmeddelande
      throw new Error(data.error || 'Failed to create activity');
    }
    return data;
  } catch (error) {
    console.error('Error creating activity:', error);
    throw error;
  }
};

export const scheduleService = {

  // --- Aktiviteter ---
  async getActivities(year: number, week: number): Promise<Activity[]> {
    const url = `${SCHEDULE_API_URL}/activities?year=${year}&week=${week}`;
    const response = await fetchWithAuth(url);
    if (!response.ok) throw new Error('Failed to fetch activities');
    const data = await response.json();
    return data.data || [];
  },
  
  async updateActivity(id: string, activityData: Partial<Activity>): Promise<Activity> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(activityData),
    });
    if (!response.ok) throw new Error('Failed to update activity');
    const data = await response.json();
    return data.data;
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
    const data = await response.json();
    if (!response.ok) {
        // Kasta ett fel med detaljerad information från backend
        const error = new Error(data.message || 'Failed to import activities');
        (error as any).details = data.conflicts; // Lägg till konfliktdetaljer i felet
        throw error;
    }
    return data;
  },

  // --- Familjemedlemmar ---
  async getFamilyMembers(): Promise<FamilyMember[]> {
    const response = await fetchWithAuth(`${SCHEDULE_API_URL}/family-members`);
    if (!response.ok) throw new Error('Failed to fetch family members');
    const data = await response.json();
    return data.data || [];
  },

  // ... (funktioner för att skapa/uppdatera/ta bort familjemedlemmar kan läggas till här)

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