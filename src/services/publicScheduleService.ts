import { API_URL } from '@/config/api';
import type { PublicSchedulePayload } from '@/types/schedule';

/**
 * Läser en publik schemalänk. Vanlig `fetch` med flit: `fetchWithAuth` rensar
 * inloggningen och skickar till /login vid 401, och den här sidan besöks av
 * deltagare som aldrig haft något konto. Ingen Authorization skickas heller —
 * en inloggad lärare som öppnar länken ska se exakt det deltagarna ser.
 */

export type PublicScheduleResult =
  | { status: 'ok'; payload: PublicSchedulePayload; etag: string | null }
  | { status: 'unchanged' }
  | { status: 'not-found' }
  | { status: 'rate-limited' }
  | { status: 'error' };

export const fetchPublicSchedule = async (
  token: string,
  etag: string | null
): Promise<PublicScheduleResult> => {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/planner/public/${encodeURIComponent(token)}`, {
      headers: etag ? { 'If-None-Match': etag } : undefined,
      // Webbläsarens egen cache skulle annars kunna svara åt servern. ETag:en
      // ovan gör i stället frågan billig: 304 utan kropp när inget ändrats.
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    return { status: 'error' };
  }

  if (response.status === 304) return { status: 'unchanged' };
  if (response.status === 404) return { status: 'not-found' };
  if (response.status === 429) return { status: 'rate-limited' };
  if (!response.ok) return { status: 'error' };

  const body = await response.json().catch(() => null);
  const payload = body?.data;
  if (!payload || !Array.isArray(payload.activities)) return { status: 'error' };

  return { status: 'ok', payload: payload as PublicSchedulePayload, etag: response.headers.get('ETag') };
};

/**
 * Backenden skriver UTC utan zonmarkering (`datetime.utcnow().isoformat()`).
 * Utan ett tillagt Z läser webbläsaren det som lokal tid, och "Uppdaterad"
 * hamnar två timmar fel sommartid.
 */
export const parseServerTimestamp = (value: string | null): Date | null => {
  if (!value) return null;
  const hasZone = /[zZ]|[+-]\d\d:?\d\d$/.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};
