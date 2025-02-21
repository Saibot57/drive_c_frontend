// src/components/calendar/TimeGrid.tsx
'use client';

import React, { useRef, useState, useCallback } from 'react';
import { TimeGridProps, Event } from './types';
import { EventCard } from './EventCard';
import EventConfirmationDialog from './EventConfirmationDialog';

export const TimeGrid: React.FC<TimeGridProps> = ({ 
  events, 
  onEventAdd, 
  onEventUpdate,
  date 
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [resizingEvent, setResizingEvent] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ start: string; end: string } | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [newEventTimes, setNewEventTimes] = useState<{ start: Date; end: Date } | null>(null);

  // Constants for grid configuration
  const GRID_START_HOUR = 6; // 6 AM
  const GRID_END_HOUR = 20; // 8 PM
  const GRID_TOTAL_HOURS = GRID_END_HOUR - GRID_START_HOUR;
  const TIME_SLOT_HEIGHT = 15; // pixels per 15 minutes

  const snapToGrid = (y: number): number => {
    const slotSize = (gridRef.current?.clientHeight ?? 0) / (GRID_TOTAL_HOURS * 4);
    return Math.round(y / slotSize) * slotSize;
  };

  const yToTime = (y: number): Date => {
    const height = gridRef.current?.clientHeight ?? 0;
    const hour = GRID_START_HOUR + (y / height) * GRID_TOTAL_HOURS;
    const newDate = new Date(date);
    newDate.setHours(Math.floor(hour));
    newDate.setMinutes((hour % 1) * 60);
    return newDate;
  };

  const timeToY = (time: Date): number => {
    const hour = time.getHours() + time.getMinutes() / 60;
    const normalizedHour = hour - GRID_START_HOUR;
    return (normalizedHour / GRID_TOTAL_HOURS) * (gridRef.current?.clientHeight ?? 0);
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const getEventStyle = (event: Event, overlappingEvents: number = 1, position: number = 0) => {
    const top = timeToY(event.start);
    const height = timeToY(event.end) - top;
    const width = overlappingEvents > 1 ? `${85 / overlappingEvents}%` : '85%';
    const left = overlappingEvents > 1 ? `${(85 / overlappingEvents) * position + 10}%` : '10%';

    return {
      top: `${top}px`,
      height: `${Math.max(TIME_SLOT_HEIGHT, height)}px`,
      width,
      left,
    };
  };

  const findOverlappingEvents = (currentEvents: Event[]): Record<string, Event[]> => {
    const eventGroups: Record<string, Event[]> = {};
    
    currentEvents.forEach(event => {
      const overlapping = currentEvents.filter(e => 
        e.id !== event.id &&
        event.start < e.end &&
        event.end > e.start
      );
      
      if (overlapping.length > 0) {
        const groupKey = [event.id, ...overlapping.map(e => e.id)].sort().join('-');
        eventGroups[groupKey] = [event, ...overlapping];
      }
    });

    return eventGroups;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const y = snapToGrid(e.clientY - rect.top);
    setIsDragging(true);
    setDragStart(y);
    setDragEnd(y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const y = snapToGrid(Math.max(0, Math.min(e.clientY - rect.top, rect.height)));
    setDragEnd(y);

    if (dragStart !== null) {
      const startTime = yToTime(Math.min(dragStart, y));
      const endTime = yToTime(Math.max(dragStart, y));
      setDragPreview({
        start: formatTime(startTime),
        end: formatTime(endTime)
      });
    }
  };

  const handleMouseUp = () => {
    if (dragStart !== null && dragEnd !== null) {
      const startTime = yToTime(Math.min(dragStart, dragEnd));
      const endTime = yToTime(Math.max(dragStart, dragEnd));
      
      if (endTime.getTime() - startTime.getTime() >= 15 * 60 * 1000) { // Minimum 15 minutes
        // Instead of directly creating the event, show the dialog
        setNewEventTimes({ start: startTime, end: endTime });
        setShowEventDialog(true);
      }
    }
    
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    setDragPreview(null);
  };

  const handleEventConfirm = (eventDetails: Omit<Event, 'id'>) => {
    onEventAdd(eventDetails);
    setShowEventDialog(false);
    setNewEventTimes(null);
  };

  const handleDialogClose = () => {
    setShowEventDialog(false);
    setNewEventTimes(null);
  };

  const handleEventResize = useCallback((eventId: string, edge: 'top' | 'bottom', newY: number) => {
    const event = events.find(e => e.id === eventId);
    if (!event || !onEventUpdate) return;

    const newTime = yToTime(newY);
    if (edge === 'top') {
      onEventUpdate(eventId, { start: newTime });
    } else {
      onEventUpdate(eventId, { end: newTime });
    }
  }, [events, onEventUpdate, yToTime]);

  // Generate time slots
  const timeSlots = Array.from(
    { length: (GRID_END_HOUR - GRID_START_HOUR) * 4 }, 
    (_, i) => {
      const hour = GRID_START_HOUR + Math.floor(i / 4);
      const minutes = (i % 4) * 15;
      return { hour, minutes };
    }
  );

  return (
    <div className="h-full relative bg-white p-2">
      <div 
        ref={gridRef}
        className="relative h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Time slots */}
        {timeSlots.map((slot, i) => (
          <div
            key={i}
            className="absolute w-full border-t border-gray-200"
            style={{ 
              top: `${(i * TIME_SLOT_HEIGHT)}px`,
              height: `${TIME_SLOT_HEIGHT}px`
            }}
          >
            {slot.minutes === 0 && (
              <span className="absolute -left-6 -top-3 text-xs font-bold">
                {`${String(slot.hour).padStart(2, '0')}:00`}
              </span>
            )}
          </div>
        ))}
        
        {/* Events */}
        {events.map((event) => {
          const overlappingGroups = findOverlappingEvents(events);
          let overlappingCount = 1;
          let position = 0;

          // Find if event is in an overlapping group
          Object.values(overlappingGroups).forEach(group => {
            if (group.find(e => e.id === event.id)) {
              overlappingCount = group.length;
              position = group.findIndex(e => e.id === event.id);
            }
          });

          return (
            <div
              key={event.id}
              className="absolute bg-[#ff6b6b] border-2 border-black rounded-lg overflow-hidden transition-all hover:shadow-neo"
              style={getEventStyle(event, overlappingCount, position)}
            >
              <div className="h-full w-full overflow-hidden">
                <div className="text-[10px] font-bold text-white px-1 truncate">
                  {event.title}
                </div>
              </div>
              
              {/* Resize handles */}
              <div 
                className="absolute top-0 left-0 w-full h-2 cursor-ns-resize"
                onMouseDown={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setIsResizing(true);
                  setResizingEvent(event.id);
                }}
              />
              <div 
                className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize"
                onMouseDown={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setIsResizing(true);
                  setResizingEvent(event.id);
                }}
              />
            </div>
          );
        })}
        
        {/* Drag preview */}
        {isDragging && dragStart !== null && dragEnd !== null && (
          <div
            className="absolute left-[10%] w-[85%] bg-[#90EE90] border-2 border-black rounded-lg p-1 text-xs"
            style={{
              top: `${Math.min(dragStart, dragEnd)}px`,
              height: `${Math.abs(dragEnd - dragStart)}px`,
              animation: 'pulse 2s infinite'
            }}
          >
            <div className="flex items-center justify-between text-black">
              <span className="font-bold">{dragPreview?.start}</span>
              <span className="mx-1">-</span>
              <span className="font-bold">{dragPreview?.end}</span>
            </div>
          </div>
        )}
      </div>

      {/* Event Creation Dialog */}
      {showEventDialog && newEventTimes && (
        <EventConfirmationDialog
          isOpen={showEventDialog}
          onClose={handleDialogClose}
          onConfirm={handleEventConfirm}
          startTime={newEventTimes.start}
          endTime={newEventTimes.end}
        />
      )}
    </div>
  );
};