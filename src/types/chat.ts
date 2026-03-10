export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  message: string;
  activities: unknown[] | null;
  isComplete: boolean;
  error?: string;
}
