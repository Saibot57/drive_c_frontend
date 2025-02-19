// src/components/calendar/DayModal.tsx
'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { DayModalProps } from './types';
import { TimeGrid } from './TimeGrid';
import { EventCard } from './EventCard';
import { ScrollArea } from "@/components/ui/scroll-area";

export const DayModal: React.FC<DayModalProps> = ({
  date,
  events,
  isOpen,
  onClose,
  onEventAdd
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center">
      <div 
        className="relative w-[90vw] h-[80vh] max-w-6xl bg-white rounded-xl border-2 border-black shadow-neo"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="absolute top-4 right-4 z-10">
          <Button
            onClick={onClose}
            variant="neutral"
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex h-full">
          {/* Time Grid Section */}
          <div className="w-2/3 border-r-2 border-black">
            <div className="p-6 border-b-2 border-black">
              <h2 className="font-monument text-2xl">
                {date.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </h2>
            </div>
            <div className="h-[calc(100%-5rem)]">
              <TimeGrid 
                events={events}
                onEventAdd={onEventAdd}
                date={date}
              />
            </div>
          </div>

          {/* Notes & Events Section */}
          <div className="w-1/3 flex flex-col h-full">
            {/* Events List */}
            <div className="flex-1 p-6 border-b-2 border-black">
              <h3 className="font-monument text-lg mb-4">Events</h3>
              <ScrollArea className="h-[calc(100%-2rem)]">
                <div className="space-y-2">
                  {events.map(event => (
                    <EventCard 
                      key={event.id} 
                      event={event}
                      isPreview
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Notes Section */}
            <div className="flex-1 p-6">
              <h3 className="font-monument text-lg mb-4">Notes</h3>
              <textarea
                className="w-full h-[calc(100%-2rem)] rounded-lg border-2 border-black p-2 focus:outline-none focus:ring-2 focus:ring-[#ff6b6b]"
                placeholder="Add notes for this day..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};