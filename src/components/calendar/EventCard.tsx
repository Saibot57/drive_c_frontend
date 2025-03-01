// src/components/calendar/EventCard.tsx
'use client';

import React, { useState } from 'react';
import { EventCardProps } from './types';
import { Edit2, Clock } from "lucide-react";

export const EventCard: React.FC<EventCardProps> = ({
  event,
  isPreview = false,
  onEdit,
  onDelete,
  onUpdate
}) => {
  const [isHovered, setIsHovered] = useState(false);

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
        className="cursor-pointer rounded border-2 border-black py-1 px-1.5 text-xs transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group relative w-full flex flex-col"
        style={{ 
          backgroundColor: event.color || '#ff6b6b',
          minHeight: '22px'
        }}
        onClick={() => onEdit && onEdit(event.id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-start text-white w-full">
          <span className="truncate max-w-full text-[10px] font-medium">
            {event.title}
          </span>
        </div>
        
        {isHovered && (
          <div className="flex items-center text-white text-[9px] mt-0.5">
            <Clock className="h-2.5 w-2.5 mr-0.5" />
            <span>{formatTime(event.start)}</span>
          </div>
        )}
        
        <button
          className="absolute right-0.5 top-0.5 bg-white text-black rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
          onClick={(e) => {
            e.stopPropagation();
            if (onEdit) {
              onEdit(event.id);
            }
          }}
          aria-label="Edit event"
        >
          <Edit2 className="h-2.5 w-2.5" />
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