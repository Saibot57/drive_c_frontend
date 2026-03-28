'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { GhostPlacement } from '@/types/plannerUI';
import { END_HOUR, EVENT_GAP_PX, getPositionStyles, MIN_HEIGHT_PX, PIXELS_PER_MINUTE, START_HOUR } from '@/utils/scheduleTime';

type DayColumnProps = {
  day: string;
  ghost: GhostPlacement | null;
  children: React.ReactNode;
  className?: string;
  placementGhost?: GhostPlacement | null;
  isPlacementMode?: boolean;
};

export function DayColumn({
  day, ghost, children, className = '',
  placementGhost, isPlacementMode,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: day,
    data: { day }
  });

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const ghostStyles = ghost ? getPositionStyles(ghost.startTime, ghost.duration) : null;
  const placementGhostStyles = placementGhost ? getPositionStyles(placementGhost.startTime, placementGhost.duration) : null;

  return (
    <div
      ref={setNodeRef}
      className={`relative flex-1 min-w-[140px] sp-day-column transition-colors ${isOver ? 'sp-day-column-active' : ''} ${isPlacementMode ? 'cursor-crosshair' : ''} ${className}`}
      style={{ height: `${(END_HOUR - START_HOUR) * 60 * PIXELS_PER_MINUTE}px` }}
    >
      <div className={`absolute -top-4 left-0 right-0 h-4 sp-day-column ${isOver ? 'sp-day-column-active' : ''}`} />
      {hours.map(h => (
        <div
          key={h}
          className="absolute w-full sp-grid-line"
          style={{ top: `${(h - START_HOUR) * 60 * PIXELS_PER_MINUTE}px` }}
        />
      ))}
      {ghost && ghostStyles && (
        <>
          <div
            className="absolute left-0 right-0 border-t border-dashed z-[5]"
            style={{ top: `${ghostStyles.top}px`, borderColor: ghost.color }}
          />
          <div
            className="absolute rounded border-2 border-dashed text-blue-900/80 px-1 py-0.5 z-[6] pointer-events-none opacity-70"
            style={{
              top: `${ghostStyles.top}px`,
              height: `${Math.max(ghostStyles.height - EVENT_GAP_PX, MIN_HEIGHT_PX)}px`,
              left: '6px',
              right: '6px',
              borderColor: ghost.color,
              backgroundColor: ghost.color
            }}
          >
            <div className="text-2xs font-mono font-bold opacity-70 leading-tight">{ghost.startTime}–{ghost.endTime}</div>
            <div className="text-xs font-bold truncate">{ghost.title}</div>
          </div>
        </>
      )}
      {placementGhost && placementGhostStyles && (
        <div
          className="absolute rounded border-2 border-solid px-1 py-0.5 z-[7] pointer-events-none opacity-80"
          style={{
            top: `${placementGhostStyles.top}px`,
            height: `${Math.max(placementGhostStyles.height - EVENT_GAP_PX, MIN_HEIGHT_PX)}px`,
            left: '6px',
            right: '6px',
            borderColor: placementGhost.color,
            backgroundColor: placementGhost.color
          }}
        >
          <div className="text-2xs font-mono font-bold opacity-70 leading-tight">{placementGhost.startTime}–{placementGhost.endTime}</div>
          <div className="text-xs font-bold truncate">{placementGhost.title}</div>
        </div>
      )}
      {children}
    </div>
  );
}
