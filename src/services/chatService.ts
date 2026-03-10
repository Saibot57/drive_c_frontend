import { fetchWithAuth } from './authService';
import { API_URL } from '@/config/api';

import type { ChatResponse } from '@/types/chat';

const CHAT_API_URL = `${API_URL}/schedule/chat`;

export const chatService = {
  async createSession(body: { week?: number; year?: number }): Promise<string> {
    const response = await fetchWithAuth(`${CHAT_API_URL}/sessions`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Kunde inte starta chattsession.');
    }
    return payload.data.sessionId;
  },

  async sendMessage(sessionId: string, message: string): Promise<ChatResponse> {
    const response = await fetchWithAuth(`${CHAT_API_URL}/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(35000),
    });
    const payload = await response.json();
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Kunde inte skicka meddelande.');
    }
    return payload.data as ChatResponse;
  },

  async deleteSession(sessionId: string): Promise<void> {
    await fetchWithAuth(`${CHAT_API_URL}/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },
};
