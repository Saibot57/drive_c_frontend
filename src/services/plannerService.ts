import { fetchWithAuth } from './authService';
import type { PlannerActivity } from '@/types/schedule';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tobiaslundh1.pythonanywhere.com/api';
const PLANNER_API_URL = `${API_URL}/planner`;

type PlannerSyncResponse = {
  activities: PlannerActivity[];
  count: number;
};

type PlannerSyncPayload = {
  activities?: unknown;
  count?: unknown;
  data?: {
    activities?: unknown;
    count?: unknown;
  };
};

const normalizePlannerSyncResponse = (payload: unknown): PlannerSyncResponse => {
  if (!payload || typeof payload !== 'object') {
    return { activities: [], count: 0 };
  }

  const typedPayload = payload as PlannerSyncPayload;
  const dataPayload = typedPayload.data && typeof typedPayload.data === 'object'
    ? (typedPayload.data as PlannerSyncPayload['data'])
    : undefined;

  const directActivities = Array.isArray(typedPayload.activities)
    ? (typedPayload.activities as PlannerActivity[])
    : undefined;
  const dataActivities = Array.isArray(dataPayload?.activities)
    ? (dataPayload?.activities as PlannerActivity[])
    : undefined;

  const activities = directActivities ?? dataActivities ?? [];
  const directCount = typeof typedPayload.count === 'number' ? typedPayload.count : undefined;
  const dataCount = typeof dataPayload?.count === 'number' ? dataPayload.count : undefined;
  const count = directCount ?? dataCount ?? activities.length;

  return { activities, count };
};

export const plannerService = {
  async getPlannerActivities(): Promise<PlannerActivity[]> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/activities`);
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

  async syncActivities(activities: PlannerActivity[]): Promise<PlannerSyncResponse> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/activities`, {
      method: 'POST',
      body: JSON.stringify({ activities }),
    });
    if (!response.ok) {
      throw new Error('Failed to sync planner activities');
    }
    const payload = await response.json();
    return normalizePlannerSyncResponse(payload);
  },

  async deletePlannerActivity(id: string): Promise<void> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete planner activity');
    }
  },

  async savePlannerArchive(name: string, activities: PlannerActivity[]): Promise<PlannerActivity[]> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/activities`, {
      method: 'POST',
      body: JSON.stringify({ archiveName: name, activities }),
    });
    if (!response.ok) {
      throw new Error('Failed to save planner archive');
    }
    const payload = await response.json();
    if (Array.isArray(payload?.data?.activities)) {
      return payload.data.activities as PlannerActivity[];
    }
    if (Array.isArray(payload?.data)) {
      return payload.data as PlannerActivity[];
    }
    if (Array.isArray(payload)) {
      return payload as PlannerActivity[];
    }
    return [];
  },

  async getPlannerArchive(name: string): Promise<PlannerActivity[]> {
    const response = await fetchWithAuth(
      `${PLANNER_API_URL}/activities?archive_name=${encodeURIComponent(name)}`,
    );
    if (!response.ok) {
      throw new Error('Failed to fetch planner archive');
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

  async deletePlannerArchive(name: string): Promise<void> {
    const response = await fetchWithAuth(
      `${PLANNER_API_URL}/activities?archive_name=${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    );
    if (!response.ok) {
      throw new Error('Failed to delete planner archive');
    }
  },

  async getPlannerArchiveNames(): Promise<string[]> {
    const response = await fetchWithAuth(`${PLANNER_API_URL}/archives`);
    if (!response.ok) {
      throw new Error('Failed to fetch planner archives');
    }
    const payload = await response.json();
    if (Array.isArray(payload?.data)) {
      return payload.data as string[];
    }
    if (Array.isArray(payload)) {
      return payload as string[];
    }
    return [];
  },
};
