import { fetchWithAuth } from './authService';

export interface PlannerActivity {
  id: string;
  title: string;
  room?: string;
  teacher?: string;
  notes?: string | null;
  day?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  color?: string;
  category?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tobiaslundh1.pythonanywhere.com/api';
const PLANNER_API_URL = `${API_URL}/planner`;

export const plannerService = {
  async getPlannerActivities(): Promise<PlannerActivity[]> {
    const response = await fetchWithAuth(PLANNER_API_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch planner activities');
    }
    const payload = await response.json();
    if (Array.isArray(payload?.data)) {
      return payload.data as PlannerActivity[];
    }
    if (Array.isArray(payload)) {
      return payload as PlannerActivity[];
    }
    return [];
  },

  async syncActivities(activities: PlannerActivity[]): Promise<PlannerActivity[]> {
    const response = await fetchWithAuth(PLANNER_API_URL, {
      method: 'POST',
      body: JSON.stringify({ activities }),
    });
    if (!response.ok) {
      throw new Error('Failed to sync planner activities');
    }
    const payload = await response.json();
    if (Array.isArray(payload?.data)) {
      return payload.data as PlannerActivity[];
    }
    if (Array.isArray(payload)) {
      return payload as PlannerActivity[];
    }
    return [];
  },

  async deletePlannerActivity(id: string): Promise<void> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete planner activity');
    }
  },
};
