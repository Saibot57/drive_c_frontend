// src/components/calendar/DayModal.tsx
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Plus } from "lucide-react";
import { DayModalProps } from './types';
import { TimeGrid } from './TimeGrid';
import { EventCard } from './EventCard';
import { ScrollArea } from "@/components/ui/scroll-area";

export const DayModal: React.FC<DayModalProps> = ({
  date,
  events,
  isOpen,
  onClose,
  onEventAdd,
  onEventUpdate,
  onEventDelete
}) => {
  const [notes, setNotes] = useState<string>('');
  const [quickEventMode, setQuickEventMode] = useState(false);

  if (!isOpen) return null;

  const sortedEvents = [...events].sort((a, b) => 
    a.start.getTime() - b.start.getTime()
  );

  const handleQuickEventAdd = () => {
    const now = new Date(date);
    const currentHour = now.getHours();
    
    const startTime = new Date(date);
    startTime.setHours(currentHour + 1, 0, 0, 0);
    
    const endTime = new Date(date);
    endTime.setHours(currentHour + 2, 0, 0, 0);

    onEventAdd({
      title: 'New Event',
      start: startTime,
      end: endTime,
      notes: ''
    });
    setQuickEventMode(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center">
      <div 
        className="relative w-[90vw] h-[80vh] max-w-6xl bg-white rounded-xl border-2 border-black shadow-neo"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between p-6 border-b-2 border-black bg-[#ff6b6b]">
          <h2 className="font-monument text-2xl text-white">
            {date.toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </h2>
          <Button
            onClick={onClose}
            variant="neutral"
            className="h-8 w-8 p-0 bg-white hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex h-[calc(100%-5rem)]">
          {/* Time Grid Section */}
          <div className="w-2/3 border-r-2 border-black">
            <div className="h-full">
              <TimeGrid 
                events={events}
                onEventAdd={onEventAdd}
                onEventUpdate={onEventUpdate}
                date={date}
              />
            </div>
          </div>

          {/* Events & Notes Section */}
          <div className="w-1/3 flex flex-col h-full">
            {/* Events List */}
            <div className="flex-1 p-6 border-b-2 border-black">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-monument text-lg">Events</h3>
                <Button
                  onClick={handleQuickEventAdd}
                  variant="neutral"
                  className="h-8 px-2 border-2 border-black bg-white hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Event
                </Button>
              </div>
              
              <ScrollArea className="h-[calc(100%-2rem)]">
                <div className="space-y-2">
                  {sortedEvents.map(event => (
                    <EventCard 
                      key={event.id} 
                      event={event}
                      onEdit={onEventUpdate ? 
                        (id) => onEventUpdate(id, { isEditing: true }) : 
                        undefined
                      }
                      onDelete={onEventDelete}
                      onUpdate={(id, updates) => {
                        if (onEventUpdate) {
                          onEventUpdate(id, updates);
                        }
                      }}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Notes Section */}
            <div className="flex-1 p-6">
              <h3 className="font-monument text-lg mb-4">Notes</h3>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes for this day..."
                className="w-full h-[calc(100%-2rem)] rounded-lg border-2 border-black p-2 resize-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};