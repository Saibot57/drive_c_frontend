// src/components/calendar/DayCard.tsx
'use client';

import React, { useMemo } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoreHorizontal } from "lucide-react";
import { EventCard } from './EventCard';
import { DayCardProps } from './types';

export const DayCard: React.FC<DayCardProps> = ({ 
  date, 
  events,
  onClick
}) => {
  const maxVisibleEvents = 3; // Reduced from 4 to provide more space per event
  const hasMoreEvents = events.length > maxVisibleEvents;
  
  const isToday = useMemo(() => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }, [date]);

  return (
    <div 
      onClick={onClick}
      className={`h-full rounded-lg border-2 border-black bg-white p-2 cursor-pointer flex flex-col
        ${isToday ? 'shadow-[inset_0_0_0_2px_#ff6b6b]' : ''}
        hover:shadow-neo transition-shadow`}
    >
      <div className="font-monument text-lg mb-1">{date.getDate()}</div>
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="space-y-1">
          {events.slice(0, maxVisibleEvents).map((event) => (
            <EventCard
              key={event.id}
              event={event}
              isPreview
            />
          ))}
          {hasMoreEvents && (
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1 py-1 px-2 bg-gray-50 rounded mt-1">
              <MoreHorizontal className="h-4 w-4" />
              <span>{events.length - maxVisibleEvents} more</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};