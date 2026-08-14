/**
 * monthCalendarService.ts — klient mot /api/calendar.
 *
 * Eget kontrakt, medvetet skilt från `calendarService.ts`. Den senare pratar
 * med de gamla `/api/events` och `/api/notes/<date>` som hör till Skrivbord,
 * och de två delar varken tabell eller typer.
 */
import { fetchWithAuth } from '@/services/authService';
import { API_URL } from '@/config/api';
import type { DateKey } from '@/utils/calendarDates';

const BASE = `${API_URL}/calendar`;

// ─── Typer (speglar backendmodellerna) ───────────────────────────────────────

/** Palettnycklar, inte hex. Alpha läggs på vid rendering. */
export type HighlightColor = 'yellow' | 'pink' | 'mint' | 'blue' | 'purple';

export interface Highlight {
  /** 0-baserat bandindex. Alltid 0–6 i lagrad data, oavsett synligt antal. */
  band: number;
  color: HighlightColor;
}

/** Tiptap-dokument. Formen ägs av editorn, så den lämnas ospecificerad här. */
export type NoteDocument = Record<string, unknown>;

export interface CalendarDayData {
  local_date: DateKey;
  quick_text: string;
  note_document: NoteDocument | null;
  highlights: Highlight[];
  updated_at: string | null;
}

export interface CalendarSettingsData {
  highlight_band_count: number;
}

/** Partiell uppdatering — bara medskickade fält rörs på servern. */
export interface DayPatch {
  quick_text?: string;
  note_document?: NoteDocument | null;
  highlights?: Highlight[];
}

// ─── Interna hjälpare ────────────────────────────────────────────────────────

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
    throw new Error(`Servern svarade med HTTP ${res.status} och ogiltigt JSON.`);
  }
  if (!json.success) {
    throw new Error(json.error ?? `API-fel (HTTP ${res.status}).`);
  }
  return json.data;
}

/** Tom dag, för datum som saknar rad i databasen. */
export function emptyDay(key: DateKey): CalendarDayData {
  return {
    local_date: key,
    quick_text: '',
    note_document: null,
    highlights: [],
    updated_at: null,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const monthCalendarService = {
  /**
   * Dagar med innehåll i ett intervall. Tomma dagar saknas i svaret — de har
   * ingen rad i databasen. Anroparen fyller i resten av matrisen.
   */
  async getDays(
    start: DateKey,
    end: DateKey,
    signal?: AbortSignal,
  ): Promise<CalendarDayData[]> {
    const res = await fetchWithAuth(
      `${BASE}/days?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      { signal },
    );
    return unwrap<CalendarDayData[]>(res);
  },

  async getDay(key: DateKey, signal?: AbortSignal): Promise<CalendarDayData> {
    const res = await fetchWithAuth(`${BASE}/days/${key}`, { signal });
    return unwrap<CalendarDayData>(res);
  },

  /**
   * `keepalive` används när sidan håller på att stängas: webbläsaren slutför
   * anropet även efter unload, så en anteckning mitt i debouncen inte tappas.
   */
  async patchDay(
    key: DateKey,
    patch: DayPatch,
    keepalive = false,
  ): Promise<CalendarDayData> {
    const res = await fetchWithAuth(`${BASE}/days/${key}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
      keepalive,
    });
    return unwrap<CalendarDayData>(res);
  },

  async getSettings(signal?: AbortSignal): Promise<CalendarSettingsData> {
    const res = await fetchWithAuth(`${BASE}/settings`, { signal });
    return unwrap<CalendarSettingsData>(res);
  },

  async patchSettings(bandCount: number): Promise<CalendarSettingsData> {
    const res = await fetchWithAuth(`${BASE}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({ highlight_band_count: bandCount }),
    });
    return unwrap<CalendarSettingsData>(res);
  },
};

export default monthCalendarService;
