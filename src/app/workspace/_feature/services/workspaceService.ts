import { fetchWithAuth } from '@/services/authService';
import { API_URL } from '@/config/api';
import type {
  Surface,
  WorkspaceElement,
  SurfaceElement,
  ElementType,
} from '../types/workspace.types';

const BASE = `${API_URL}/workspace`;

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

export const workspaceService = {
  // ── Surfaces ──
  async getSurfaces(includeArchived = false): Promise<Surface[]> {
    const qs = includeArchived ? '?include_archived=true' : '';
    const res = await fetchWithAuth(`${BASE}/surfaces${qs}`);
    return unwrap<Surface[]>(res);
  },

  async createSurface(name: string): Promise<Surface> {
    const res = await fetchWithAuth(`${BASE}/surfaces`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return unwrap<Surface>(res);
  },

  async updateSurface(id: string, data: Partial<Pick<Surface, 'name' | 'sort_order' | 'is_archived'>>): Promise<Surface> {
    const res = await fetchWithAuth(`${BASE}/surfaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return unwrap<Surface>(res);
  },

  async deleteSurface(id: string): Promise<void> {
    const res = await fetchWithAuth(`${BASE}/surfaces/${id}`, { method: 'DELETE' });
    await unwrap<null>(res);
  },

  // ── Elements ──
  async getSurfaceElements(surfaceId: string): Promise<(SurfaceElement & { element: WorkspaceElement })[]> {
    const res = await fetchWithAuth(`${BASE}/surfaces/${surfaceId}/elements`);
    return unwrap(res);
  },

  async createElement(type: ElementType, title: string, content?: unknown): Promise<WorkspaceElement> {
    const res = await fetchWithAuth(`${BASE}/elements`, {
      method: 'POST',
      body: JSON.stringify({ type, title, content }),
    });
    return unwrap<WorkspaceElement>(res);
  },

  async updateElement(id: string, data: { title?: string; content?: unknown }): Promise<WorkspaceElement> {
    const res = await fetchWithAuth(`${BASE}/elements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return unwrap<WorkspaceElement>(res);
  },

  async deleteElement(id: string): Promise<void> {
    const res = await fetchWithAuth(`${BASE}/elements/${id}`, { method: 'DELETE' });
    await unwrap<null>(res);
  },

  // ── Placements ──
  async placeElement(
    surfaceId: string,
    data: { element_id: string; position_x: number; position_y: number; width?: number; height?: number; is_locked?: boolean },
  ): Promise<SurfaceElement & { element: WorkspaceElement }> {
    const res = await fetchWithAuth(`${BASE}/surfaces/${surfaceId}/place`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return unwrap(res);
  },

  async updatePlacement(
    placementId: string,
    data: Partial<Pick<SurfaceElement, 'position_x' | 'position_y' | 'width' | 'height' | 'is_locked' | 'is_on_canvas' | 'z_index'>>,
  ): Promise<SurfaceElement> {
    const res = await fetchWithAuth(`${BASE}/placements/${placementId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return unwrap<SurfaceElement>(res);
  },

  async deletePlacement(placementId: string): Promise<void> {
    const res = await fetchWithAuth(`${BASE}/placements/${placementId}`, { method: 'DELETE' });
    await unwrap<null>(res);
  },

  // ── Mirror & Copy ──
  async mirrorElement(
    elementId: string,
    surfaceId: string,
    pos?: { position_x: number; position_y: number },
  ): Promise<SurfaceElement & { element: WorkspaceElement }> {
    const res = await fetchWithAuth(`${BASE}/elements/${elementId}/mirror`, {
      method: 'POST',
      body: JSON.stringify({ surface_id: surfaceId, ...pos }),
    });
    return unwrap(res);
  },

  async copyElement(
    elementId: string,
    surfaceId: string,
    pos?: { position_x: number; position_y: number },
  ): Promise<SurfaceElement & { element: WorkspaceElement }> {
    const res = await fetchWithAuth(`${BASE}/elements/${elementId}/copy`, {
      method: 'POST',
      body: JSON.stringify({ surface_id: surfaceId, ...pos }),
    });
    return unwrap(res);
  },

  // ── Search ──
  async search(params: {
    q: string;
    deep?: boolean;
    surface_id?: string;
    type?: ElementType;
  }): Promise<(WorkspaceElement & { surfaces: { id: string; name: string }[] })[]> {
    const qs = new URLSearchParams({ q: params.q });
    if (params.deep) qs.set('deep', 'true');
    if (params.surface_id) qs.set('surface_id', params.surface_id);
    if (params.type) qs.set('type', params.type);
    const res = await fetchWithAuth(`${BASE}/search?${qs}`);
    return unwrap(res);
  },
};
