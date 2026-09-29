import { fetchWithAuth } from './authService';
import { API_URL } from '@/config/api';
import type { Term, TermSummary } from '@/types/term';

const TERM_API_URL = `${API_URL}/terms`;

/** Backend svarar {success, data, error}; felen är skrivna för användaren. */
const readData = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || fallbackMessage);
  }
  return payload?.data as T;
};

const toPayload = (term: Omit<Term, 'id'>) => ({
  name: term.name,
  startWeek: term.startWeek,
  startYear: term.startYear,
  weeks: term.weeks,
});

export const termService = {
  async listTerms(): Promise<TermSummary[]> {
    const response = await fetchWithAuth(TERM_API_URL);
    const data = await readData<TermSummary[]>(response, 'Kunde inte hämta terminerna.');
    return Array.isArray(data) ? data : [];
  },

  async getTerm(id: string): Promise<Term> {
    const response = await fetchWithAuth(`${TERM_API_URL}/${encodeURIComponent(id)}`);
    return readData<Term>(response, 'Kunde inte hämta terminen.');
  },

  async createTerm(term: Omit<Term, 'id'>): Promise<Term> {
    const response = await fetchWithAuth(TERM_API_URL, {
      method: 'POST',
      body: JSON.stringify(toPayload(term)),
    });
    return readData<Term>(response, 'Kunde inte skapa terminen.');
  },

  async updateTerm(term: Term): Promise<Term> {
    const response = await fetchWithAuth(`${TERM_API_URL}/${encodeURIComponent(term.id)}`, {
      method: 'PUT',
      body: JSON.stringify(toPayload(term)),
    });
    return readData<Term>(response, 'Kunde inte spara terminen.');
  },

  async deleteTerm(id: string): Promise<void> {
    const response = await fetchWithAuth(`${TERM_API_URL}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await readData(response, 'Kunde inte ta bort terminen.');
  },
};
