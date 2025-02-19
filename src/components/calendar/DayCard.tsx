// src/components/calendar/DayCard.tsx
'use client';

import React, { useState, useMemo } from 'react';  // Added useMemo import
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, MoreHorizontal } from "lucide-react";
import { EventCard } from './EventCard';
import { TimeGrid } from './TimeGrid';
import { DayCardProps } from './types';

export const DayCard: React.FC<DayCardProps> = ({ 
  date, 
  events, 
  isFlipped, 
  onFlip, 
  onClose,
  onEventAdd 
}) => {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
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
      className={`preserve-3d transition-transform duration-500 ${
        isFlipped ? 'z-50' : 'z-0'
      }`}
      style={{
        transform: isFlipped ? 'rotateX(180deg) scale(2)' : 'rotateX(0deg) scale(1)',
        transformOrigin: 'center center'
      }}
    >
      {/* Front of card */}
      <div 
        className={`absolute w-full h-full backface-hidden ${
          isFlipped ? 'pointer-events-none' : 'cursor-pointer'
        }`}
        onClick={onFlip}
      >
        <div className={`h-full rounded-lg border-2 border-black bg-white p-2 ${
          isToday ? 'shadow-[inset_0_0_0_2px_#ff6b6b]' : ''
        } hover:shadow-neo transition-shadow`}>
          <div className="font-monument text-lg">{date.getDate()}</div>
          <ScrollArea className="h-[calc(100%-28px)]">
            {events.slice(0, maxVisibleEvents).map((event) => (
              <div key={event.id} className="mb-1">
                <EventCard
                  event={event}
                  isExpanded={expandedEvent === event.id}
                  onToggle={() => setExpandedEvent(event.id)}
                  onClose={() => setExpandedEvent(null)}
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
      </div>

      {/* Back of card */}
      <div 
        className={`absolute w-full h-full backface-hidden rotate-x-180 ${
          isFlipped ? '' : 'pointer-events-none'
        }`}
      >
        <div className="relative h-full rounded-lg border-2 border-black bg-white shadow-neo">
          <Button
            onClick={onClose}
            className="absolute right-2 top-2 z-10"
            variant="neutral"
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="flex h-full">
            <TimeGrid 
              events={events} 
              onEventAdd={onEventAdd}
              date={date}
            />
            <div className="flex-1 p-4 border-l-2 border-black">
              <h3 className="mb-4 font-monument text-lg">Notes for {date.toLocaleDateString()}</h3>
              <textarea
                className="h-[calc(100%-40px)] w-full rounded-lg border-2 border-black p-2 focus:outline-none focus:ring-2 focus:ring-[#ff6b6b]"
                placeholder="Add day notes..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};