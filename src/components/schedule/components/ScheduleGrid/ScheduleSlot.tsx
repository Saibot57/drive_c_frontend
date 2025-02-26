'use client';

import React, { useState } from 'react';
import { ArrowDownCircle } from 'lucide-react';
import type { Box, Restriction, Schedule } from '../../types';
import { hasRestriction } from '../../utils/schedule';

interface ScheduleSlotProps {
  day: string;
  timeSlotId: string;
  slotIndex: number;
  box: Box | undefined;
  boxes: Box[];
  schedule: Schedule;
  restrictions: Restriction[];
  isHighlighted: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onSlotClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function ScheduleSlot({
  day,
  timeSlotId,
  box,
  boxes,
  schedule,
  restrictions,
  isHighlighted,
  onDragOver,
  onDrop,
  onSlotClick,
  onMouseEnter,
  onMouseLeave
}: ScheduleSlotProps) {
  const [isRestricted, setIsRestricted] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const droppedBoxId = Number(e.dataTransfer.getData('boxId'));
    const droppedBox = boxes.find(b => b.id === droppedBoxId);

    if (!droppedBox) return;

    // Check if the box has a duration that spans multiple slots
    // We'll need to check restrictions for all slots it would occupy
    const timeSlotKey = `${day}-${timeSlotId}`;
    const conflictingBoxes = Object.entries(schedule)
      .filter(([key]) => key.startsWith(timeSlotKey))
      .map(([, boxId]) => boxes.find(b => b.id === boxId))
      .filter((b): b is Box => b !== undefined);

    const hasConflictResult = conflictingBoxes.some(existingBox => 
      hasRestriction(droppedBox.className, existingBox.className, restrictions)
    );

    if (hasConflictResult) {
      e.stopPropagation();
      setIsRestricted(true);
      setTimeout(() => setIsRestricted(false), 2000);
      
      const restrictionErrorDiv = document.createElement('div');
      restrictionErrorDiv.className = 'fixed top-4 right-4 bg-[#ff6b6b] text-white px-4 py-2 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50';
      restrictionErrorDiv.textContent = 'Denna placering bryter mot en restriktion';
      document.body.appendChild(restrictionErrorDiv);
      
      setTimeout(() => {
        restrictionErrorDiv.remove();
      }, 3000);
      
      return;
    }

    onDrop(e);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    onDragOver(e);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSlotClick();
  };

  return (
    <div
      className={`
        schedule-box min-h-[4.5rem] flex flex-col justify-between
        hover:z-10 transition-all duration-200
        ${!box ? 'border-dashed border-gray-300 bg-white' : ''}
        ${isHighlighted ? 'ring-2 ring-offset-2 ring-[#ff6b6b]' : ''}
        ${isRestricted ? 'schedule-shake ring-2 ring-offset-2 ring-red-500' : ''}
        w-full
      `}
      style={{
        ...(box ? { 
          backgroundColor: box.color
        } : {}),
        animation: isRestricted ? 'shake 0.5s ease-in-out' : 'none'
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {box && (
        <>
          <div className="text-[0.65rem] leading-tight flex-grow">
            <div className="font-medium mb-0.5 break-words">{box.className}</div>
            <div className="text-gray-700 break-words">{box.teacher}</div>
            {box.duration && box.duration !== 60 && (
              <div className="text-gray-700 text-xs mt-1">{box.duration} min</div>
            )}
          </div>
          <div className="flex justify-center mt-1 pdf-hide">
            <ArrowDownCircle size={14} className="text-gray-700" />
          </div>
        </>
      )}
    </div>
  );
}