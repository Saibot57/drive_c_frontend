/**
 * commandCenterService.ts — typed API client for /api/command-center.
 *
 * All requests are authenticated via fetchWithAuth (Bearer JWT).
 * The backend responds with { success, data, error }.
 */

import { fetchWithAuth } from '@/services/authService';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://tobiaslundh1.pythonanywhere.com/api';
const BASE    = `${API_URL}/command-center`;

// ─── Domain types (mirror backend models) ────────────────────────────────────

export interface CCNote {
  id:          string;
  user_id:     string;
  title:       string;
  content:     string | null;
  tags:        string[];
  template_id: string | null;
  created_at:  string;
  updated_at:  string;
}

export interface CCTodo {
  id:          string;
  user_id:     string;
  content:     string;
  type:        'week' | 'date';
  target_date: string | null;   // YYYY-MM-DD
  week_number: number | null;
  status:      'open' | 'done';
  created_at:  string;
  updated_at:  string;
}

export interface CCTemplate {
  id:         string;
  user_id:    string;
  name:       string;
  skeleton:   string | null;
  created_at: string;
}

type TodoSchedule =
  | { type: 'week'; week_number: number }
  | { type: 'date'; target_date: string };

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface ApiEnvelope<T> {
  success: boolean;
  data:    T;
  error:   string | null;
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

async function unwrapOrStatus<T>(
  res: Response,
): Promise<{ status: number; data: T | null; error: string | null }> {
  if (!res.ok) {
    try {
      const json: ApiEnvelope<T> = await res.json();
      return { status: res.status, data: null, error: json.error ?? `HTTP ${res.status}` };
    } catch {
      return { status: res.status, data: null, error: `HTTP ${res.status}` };
    }
  }
  const data = await unwrap<T>(res);
  return { status: res.status, data, error: null };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const commandCenterService = {

  // ── Notes ──────────────────────────────────────────────────────────────────

  async getNotes(): Promise<CCNote[]> {
    const res = await fetchWithAuth(`${BASE}/notes`);
    return unwrap<CCNote[]>(res);
  },

  async getNote(id: string): Promise<CCNote> {
    const res = await fetchWithAuth(`${BASE}/notes/${id}`);
    return unwrap<CCNote>(res);
  },

  async createNote(
    title: string,
    opts?: { templateId?: string; content?: string },
  ): Promise<CCNote> {
    const res = await fetchWithAuth(`${BASE}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        content:     opts?.content     ?? null,
        template_id: opts?.templateId  ?? null,
      }),
    });
    return unwrap<CCNote>(res);
  },

  async updateNote(
    id:   string,
    data: { title?: string; content?: string; tags?: string[] },
  ): Promise<CCNote> {
    const res = await fetchWithAuth(`${BASE}/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return unwrap<CCNote>(res);
  },

  async deleteNote(id: string): Promise<void> {
    const res = await fetchWithAuth(`${BASE}/notes/${id}`, { method: 'DELETE' });
    await unwrap<{ deleted_id: string }>(res);
  },

  // ── Todos ──────────────────────────────────────────────────────────────────

  async getTodos(): Promise<CCTodo[]> {
    const res = await fetchWithAuth(`${BASE}/todos`);
    return unwrap<CCTodo[]>(res);
  },

  async createTodo(content: string, scheduling: TodoSchedule): Promise<CCTodo> {
    const res = await fetchWithAuth(`${BASE}/todos`, {
      method: 'POST',
      body: JSON.stringify({ content, ...scheduling }),
    });
    return unwrap<CCTodo>(res);
  },

  async updateTodo(
    id:   string,
    data: { content?: string; status?: 'open' | 'done'; type?: 'week' | 'date'; target_date?: string; week_number?: number },
  ): Promise<CCTodo> {
    const res = await fetchWithAuth(`${BASE}/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return unwrap<CCTodo>(res);
  },

  async deleteTodo(id: string): Promise<void> {
    const res = await fetchWithAuth(`${BASE}/todos/${id}`, { method: 'DELETE' });
    await unwrap<{ deleted_id: string }>(res);
  },

  // ── Templates ──────────────────────────────────────────────────────────────

  async getTemplates(): Promise<CCTemplate[]> {
    const res = await fetchWithAuth(`${BASE}/templates`);
    return unwrap<CCTemplate[]>(res);
  },

  async createTemplate(name: string, skeleton: string): Promise<CCTemplate> {
    const res = await fetchWithAuth(`${BASE}/templates`, {
      method: 'POST',
      body: JSON.stringify({ name, skeleton }),
    });
    return unwrap<CCTemplate>(res);
  },

  async deleteTemplate(id: string): Promise<void> {
    const res = await fetchWithAuth(`${BASE}/templates/${id}`, { method: 'DELETE' });
    await unwrap<{ deleted_id: string }>(res);
  },

  // ── Generic rm (tries note → todo) ────────────────────────────────────────

  async deleteAny(id: string): Promise<'note' | 'todo'> {
    const noteRes    = await fetchWithAuth(`${BASE}/notes/${id}`, { method: 'DELETE' });
    const noteResult = await unwrapOrStatus<{ deleted_id: string }>(noteRes);

    if (noteResult.status !== 404) {
      if (noteResult.error) throw new Error(noteResult.error);
      return 'note';
    }

    const todoRes    = await fetchWithAuth(`${BASE}/todos/${id}`, { method: 'DELETE' });
    const todoResult = await unwrapOrStatus<{ deleted_id: string }>(todoRes);

    if (todoResult.status === 404) {
      throw new Error(`Ingen anteckning eller todo med id "${id}" hittades.`);
    }
    if (todoResult.error) throw new Error(todoResult.error);
    return 'todo';
  },
};
