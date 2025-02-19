// src/components/Calendar/TimeGrid.tsx
'use client';

import React, { useRef, useState } from 'react';
import { TimeGridProps } from './types';

export const TimeGrid: React.FC<TimeGridProps> = ({ events, onEventAdd, date }) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [dragPreview, setDragPreview] = useState<{ start: string; end: string } | null>(null);

  const hourToY = (hour: number): number => {
    return ((hour - 6) / 14) * (gridRef.current?.clientHeight ?? 0);
  };

  const yToHour = (y: number): number => {
    const height = gridRef.current?.clientHeight ?? 0;
    return 6 + (y / height) * 14;
  };

  const formatHour = (hour: number): string => {
    const hours = Math.floor(hour);
    const minutes = Math.round((hour - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setIsDragging(true);
    setDragStart(y);
    setDragEnd(y);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    setDragEnd(y);

    if (dragStart !== null) {
      const startHour = yToHour(Math.min(dragStart, y));
      const endHour = yToHour(Math.max(dragStart, y));
      setDragPreview({
        start: formatHour(startHour),
        end: formatHour(endHour)
      });
    }
  };

  const handleMouseUp = () => {
    if (dragStart !== null && dragEnd !== null) {
      const startHour = yToHour(Math.min(dragStart, dragEnd));
      const endHour = yToHour(Math.max(dragStart, dragEnd));
      
      const newEvent = {
        title: 'New Event',
        start: new Date(date.setHours(Math.floor(startHour), (startHour % 1) * 60)),
        end: new Date(date.setHours(Math.floor(endHour), (endHour % 1) * 60)),
      };
      
      onEventAdd(newEvent);
    }
    
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    setDragPreview(null);
  };

  const hours = Array.from({ length: 15 }, (_, i) => i + 6); // 6:00 to 20:00

  return (
    <div className="h-full w-1/3 border-r-2 border-black bg-white p-2">
      <div 
        ref={gridRef}
        className="relative h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {hours.map((hour) => (
          <div key={hour} className="absolute w-full border-t border-gray-200" 
               style={{ top: `${((hour - 6) / 14) * 100}%` }}>
            <span className="text-xs font-bold">{hour}:00</span>
          </div>
        ))}
        
        {events.map((event) => {
          const startHour = event.start.getHours() + event.start.getMinutes() / 60;
          const endHour = event.end.getHours() + event.end.getMinutes() / 60;
          const top = Math.max(0, ((startHour - 6) / 14) * 100);
          const height = Math.min(100 - top, ((endHour - startHour) / 14) * 100);
          const minHeight = 10; // Minimum height for very short events

          return (
            <div
              key={event.id}
              className="absolute left-6 right-2 bg-[#ff6b6b] border-2 border-black p-1 text-xs overflow-hidden"
              style={{
                top: `${top}%`,
                height: `${Math.max(minHeight, height)}%`,
              }}
            >
              {event.title}
            </div>
          );
        })}
        
        {isDragging && dragStart !== null && dragEnd !== null && (
          <div
            className="absolute left-6 right-2 bg-[#90EE90] border-2 border-black p-1 text-xs"
            style={{
              top: `${Math.min(dragStart, dragEnd)}px`,
              height: `${Math.abs(dragEnd - dragStart)}px`,
              boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
              animation: 'pulse 2s infinite'
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold">{dragPreview?.start}</span>
              <span className="mx-1">-</span>
              <span className="font-bold">{dragPreview?.end}</span>
            </div>
            <style jsx>{`
              @keyframes pulse {
                0% { opacity: 0.7; }
                50% { opacity: 0.9; }
                100% { opacity: 0.7; }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
};