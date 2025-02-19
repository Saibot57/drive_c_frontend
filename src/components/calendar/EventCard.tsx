// src/components/calendar/EventCard.tsx
'use client';

import React from 'react';
import { EventCardProps } from './types';

export const EventCard: React.FC<EventCardProps> = ({ 
  event,
  isPreview = false
}) => {
  return (
    <div className="rounded border-2 border-black bg-[#ff6b6b] p-2 text-white font-medium hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
      <div className="flex items-center justify-between">
        <span className="truncate">{event.title}</span>
        {!isPreview && (
          <span className="text-[10px] opacity-80">
            {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
            {event.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
};