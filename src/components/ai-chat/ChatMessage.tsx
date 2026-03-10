import React from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  hideJsonFence?: boolean;
}

/** Strip ```json ... ``` code fences from display text. */
function stripJsonFences(text: string): string {
  return text.replace(/```json\s*\n[\s\S]*?\n\s*```/g, '').trim();
}

export function ChatMessage({ role, content, hideJsonFence }: ChatMessageProps) {
  const isUser = role === 'user';
  const displayText = hideJsonFence ? stripJsonFences(content) : content;

  if (!displayText) return null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`rounded-lg px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-blue-100 text-blue-900'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        {displayText}
      </div>
    </div>
  );
}
