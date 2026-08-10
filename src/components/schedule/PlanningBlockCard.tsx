'use client';

import React from 'react';
import { formatMinutes, TimeInterval } from '@/utils/scheduleStats';
import { EVENT_GAP_PX, getPositionStyles, MIN_HEIGHT_PX, minutesToTime } from '@/utils/scheduleTime';

type PlanningBlockCardProps = {
  block: TimeInterval;
};

/**
 * En lucka i planeringsvyn. Streckad kant och egen färg så den aldrig
 * förväxlas med en lektion, och genomsläpplig för pekaren så dagkolumnen
 * fortfarande tar emot det man drar.
 */
export function PlanningBlockCard({ block }: PlanningBlockCardProps) {
  const duration = block.end - block.start;
  const startTime = minutesToTime(block.start);
  const endTime = minutesToTime(block.end);
  const { top, height } = getPositionStyles(startTime, duration);
  const adjustedHeight = Math.max(height - EVENT_GAP_PX, MIN_HEIGHT_PX);
  const isCompact = adjustedHeight < 46;

  return (
    <div
      className="sp-planning-card pointer-events-none absolute rounded p-1"
      style={{
        top: `${top + EVENT_GAP_PX / 2}px`,
        height: `${adjustedHeight}px`,
        left: '4px',
        right: '4px',
        zIndex: 10
      }}
      title={`Planering ${startTime}–${endTime} • ${formatMinutes(duration)}`}
    >
      <div className="flex h-full flex-col">
        <span className="text-2xs font-mono font-bold leading-tight opacity-70">
          {startTime}–{endTime}
        </span>
        {!isCompact && (
          <>
            <p className="text-sm font-bold leading-tight">Planering</p>
            <p className="text-xs font-semibold text-gray-700">{formatMinutes(duration)}</p>
          </>
        )}
      </div>
    </div>
  );
}

/** Visas i stället för block när dagen är spärrad som ledig i debug-menyn. */
export function PlanningDayOffLabel() {
  return (
    <div className="sp-planning-dayoff pointer-events-none absolute inset-x-1 top-2 rounded px-2 py-1 text-center">
      <p className="text-xs font-bold uppercase tracking-wide">Ledig</p>
    </div>
  );
}
