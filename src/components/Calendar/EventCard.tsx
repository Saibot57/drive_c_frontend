// src/components/Calendar/EventCard.tsx
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
        <div className="rounded border-2 border-black bg-[#ff6b6b] p-1 text-xs">
          {event.title}
        </div>
      </div>

      {/* Back of event card */}
      <div 
        className={`absolute w-full h-full backface-hidden rotate-x-180 ${
          isExpanded ? '' : 'pointer-events-none'
        }`}
      >
        <div className="relative h-full border-2 border-black bg-white p-4">
          <Button
            onClick={onClose}
            className="absolute right-2 top-2 z-10"
            variant="neutral"
          >
            <X className="h-4 w-4" />
          </Button>
          
          <h3 className="font-bold mb-2">{event.title}</h3>
          <div className="text-xs mb-4">
            {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
            {event.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          
          <textarea
            className="w-full h-[calc(100%-100px)] border-2 border-black p-2"
            placeholder="Add event notes..."
            defaultValue={event.notes}
          />
        </div>
      </div>
    </div>
  );
};