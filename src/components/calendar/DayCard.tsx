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
  const maxVisibleEvents = 4;
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
      className={`h-full rounded-lg border-2 border-black bg-white p-2 cursor-pointer
        ${isToday ? 'shadow-[inset_0_0_0_2px_#ff6b6b]' : ''}
        hover:shadow-neo transition-shadow`}
    >
      <div className="font-monument text-lg">{date.getDate()}</div>
      <ScrollArea className="h-[calc(100%-28px)]">
        {events.slice(0, maxVisibleEvents).map((event) => (
          <div key={event.id} className="mb-1">
            <EventCard
              event={event}
              isPreview
            />
          </div>
        ))}
        {hasMoreEvents && (
          <div className="text-xs text-gray-500 flex items-center gap-1 py-1 px-2 bg-gray-50 rounded">
            <MoreHorizontal className="h-4 w-4" />
            {events.length - maxVisibleEvents} more
          </div>
        )}
      </ScrollArea>
    </div>
  );
};