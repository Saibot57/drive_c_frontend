// src/components/calendar/EventCard.tsx
'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { EventCardProps } from './types';

export const EventCard: React.FC<EventCardProps> = ({ 
  event, 
  isExpanded, 
  onToggle, 
  onClose 
}) => {
  return (
    <div 
      className={`preserve-3d transition-transform duration-500 ${
        isExpanded ? 'z-50 absolute top-0 left-0 w-full h-full' : 'relative'
      }`}
      style={{
        transform: isExpanded ? 'rotateX(180deg) scale(2)' : 'rotateX(0deg) scale(1)',
        transformOrigin: 'center center'
      }}
    >
      {/* Front of event card */}
      <div 
        className={`w-full backface-hidden ${
          isExpanded ? 'pointer-events-none' : 'cursor-pointer'
        }`}
        onClick={onToggle}
      >
        <div className="rounded border-2 border-black bg-[#ff6b6b] p-2 text-white font-medium hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <span>{event.title}</span>
            <span className="text-[10px] opacity-80">
              {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Back of event card */}
      <div 
        className={`absolute w-full h-full backface-hidden rotate-x-180 ${
          isExpanded ? '' : 'pointer-events-none'
        }`}
      >
        <div className="relative h-full rounded-lg border-2 border-black bg-white p-4 shadow-neo">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-monument text-xl">{event.title}</h3>
            <Button
              onClick={onClose}
              className="h-8 w-8 p-0"
              variant="neutral"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium bg-[#ff6b6b]/10 rounded-full px-3 py-1">
              {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
              {event.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block font-monument text-sm mb-2">Notes</label>
              <textarea
                className="w-full h-[calc(100%-100px)] min-h-[100px] rounded-lg border-2 border-black p-2 focus:outline-none focus:ring-2 focus:ring-[#ff6b6b]"
                placeholder="Add event notes..."
                defaultValue={event.notes}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};