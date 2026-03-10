'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, RotateCcw } from 'lucide-react';

import { chatService } from '@/services/chatService';
import type { ChatMessage as ChatMessageType } from '@/types/chat';
import type { ActivityImportItem } from '@/types/schedule';

import { ChatMessage } from './ChatMessage';
import { ActivityPreviewTable } from './ActivityPreviewTable';

interface AIChatPanelProps {
  /** Week/year context sent when creating the session */
  selectedWeek: number;
  selectedYear: number;
  /** Called when the AI produces valid activities */
  onActivitiesReady: (activities: ActivityImportItem[]) => void;
  /** Placeholder text for the input */
  placeholder?: string;
}

export function AIChatPanel({
  selectedWeek,
  selectedYear,
  onActivitiesReady,
  placeholder = 'Beskriv aktiviteterna...',
}: AIChatPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingActivities, setPendingActivities] = useState<ActivityImportItem[] | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingActivities]);

  // Create session on mount
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const id = await chatService.createSession({ week: selectedWeek, year: selectedYear });
        if (!cancelled) setSessionId(id);
      } catch {
        if (!cancelled) setError('Kunde inte starta chattsession.');
      }
    };
    init();
    return () => { cancelled = true; };
  }, [selectedWeek, selectedYear]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !sessionId || isLoading) return;

    setInput('');
    setError(null);
    setPendingActivities(null);

    const userMsg: ChatMessageType = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await chatService.sendMessage(sessionId, text);

      const assistantMsg: ChatMessageType = { role: 'assistant', content: response.message };
      setMessages(prev => [...prev, assistantMsg]);

      if (response.isComplete && response.activities) {
        const activities = response.activities as ActivityImportItem[];
        setPendingActivities(activities);
        onActivitiesReady(activities);
      }

      if (response.error) {
        setError(response.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel.');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, sessionId, isLoading, onActivitiesReady]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = useCallback(async () => {
    // Delete old session, create new one
    if (sessionId) {
      chatService.deleteSession(sessionId).catch(() => {});
    }
    setMessages([]);
    setPendingActivities(null);
    setError(null);
    setInput('');
    try {
      const id = await chatService.createSession({ week: selectedWeek, year: selectedYear });
      setSessionId(id);
    } catch {
      setError('Kunde inte starta ny chattsession.');
    }
  }, [sessionId, selectedWeek, selectedYear]);

  return (
    <div className="flex flex-col" style={{ height: '400px' }}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1" style={{ minHeight: 0 }}>
        {messages.length === 0 && !isLoading && (
          <p className="text-sm text-gray-500 text-center mt-8">
            Beskriv vilka aktiviteter du vill lägga till. Jag ställer frågor om något saknas.
          </p>
        )}
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            role={msg.role}
            content={msg.content}
            hideJsonFence={msg.role === 'assistant' && i === messages.length - 1 && pendingActivities !== null}
          />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-2">
            <div className="rounded-lg px-3 py-2 bg-gray-100 text-gray-500 text-sm">
              Tänker...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Preview area */}
      {pendingActivities && pendingActivities.length > 0 && (
        <div className="border-t px-3 py-2">
          <p className="text-xs text-gray-500 mb-1 font-medium">
            {pendingActivities.length} aktivitet{pendingActivities.length > 1 ? 'er' : ''} redo att importera:
          </p>
          <ActivityPreviewTable activities={pendingActivities} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-1">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Input area */}
      <div className="border-t p-2 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          className="flex-1 resize-none rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
          rows={2}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={!sessionId || isLoading}
        />
        <div className="flex flex-col gap-1">
          <button
            className="p-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40"
            onClick={handleSend}
            disabled={!input.trim() || !sessionId || isLoading}
            title="Skicka"
          >
            <Send size={16} />
          </button>
          <button
            className="p-1.5 rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
            onClick={handleReset}
            title="Ny konversation"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
