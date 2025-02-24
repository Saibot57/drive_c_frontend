// src/components/calendar/EventCard.tsx
'use client';

import React from 'react';
import { EventCardProps } from './types';
import { Edit2 } from "lucide-react";

export const EventCard: React.FC<EventCardProps> = ({
  event,
  isPreview = false,
  onEdit,
  onDelete,
  onUpdate
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit',
      minute: '2-digit',
      hour12: false 
    });
  };

  // Preview mode (compact card in calendar view)
  if (isPreview) {
    return (
      <div 
        className="cursor-pointer rounded border-2 border-black p-1 text-xs transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group relative"
        style={{ backgroundColor: event.color || '#ff6b6b' }}
        onClick={() => onEdit && onEdit(event.id)}
      >
        <div className="flex items-center justify-between text-white">
          <span className="truncate pr-6">{event.title}</span>
          <span className="text-[10px] opacity-80">
            {formatTime(event.start)}
          </span>
        </div>
        
        <button
          className="absolute right-1 top-1 bg-white text-black rounded-full h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
          onClick={(e) => {
            e.stopPropagation();
            if (onEdit) {
              onEdit(event.id);
            }
          }}
          aria-label="Edit event"
        >
          <Edit2 className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // Default display (non-preview)
  return (
    <div 
      className="calendar-event-card cursor-pointer"
      style={{ backgroundColor: event.color || '#ff6b6b' }}
    >
      <div className="flex items-center justify-between text-white">
        <span className="truncate">{event.title}</span>
        <span className="text-[10px] opacity-80">
          {formatTime(event.start)} - {formatTime(event.end)}
        </span>
      </div>
    </div>
  );
};