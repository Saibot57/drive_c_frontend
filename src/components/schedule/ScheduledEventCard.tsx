'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Edit2, FileText, Trash2 } from 'lucide-react';
import { ScheduledEntry } from '@/types/schedule';
import { EVENT_GAP_PX, getPositionStyles, MIN_HEIGHT_PX } from '@/utils/scheduleTime';

type ScheduledEventCardProps = {
  entry: ScheduledEntry;
  onEdit: (entry: ScheduledEntry) => void;
  onRemove: (instanceId: string) => void;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>, entry: ScheduledEntry) => void;
  hidden?: boolean;
  columnIndex: number;
  columnCount: number;
  isLastOfDay: boolean;
  showLayoutDebug: boolean;
  dragDisabled?: boolean;
  isSelected?: boolean;
};

const extractUrl = (value?: string) => {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
};

export function ScheduledEventCard({
  entry,
  onEdit,
  onRemove,
  onContextMenu,
  hidden,
  columnIndex,
  columnCount,
  isLastOfDay,
  showLayoutDebug,
  dragDisabled = false,
  isSelected = false
}: ScheduledEventCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry.instanceId,
    data: { type: 'scheduled', entry },
    disabled: dragDisabled
  });

  const { top, height } = getPositionStyles(entry.startTime, entry.duration);
  const adjustedTop = top + EVENT_GAP_PX / 2;
  const adjustedHeight = Math.max(height - EVENT_GAP_PX, MIN_HEIGHT_PX);
  const widthPercentage = 100 / Math.max(columnCount, 1);
  const leftPercentage = widthPercentage * columnIndex;
  const assignmentUrl = extractUrl(entry.category);

  if (hidden) return null;

  const isShortDuration = entry.duration < 50;
  const isCompactHeight = adjustedHeight < 38;
  const timeLabel = isLastOfDay ? `${entry.startTime}–${entry.endTime}` : entry.startTime;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onContextMenu={(event) => onContextMenu(event, entry)}
      style={{
        position: 'absolute',
        top: `${adjustedTop}px`,
        height: `${adjustedHeight}px`,
        left: `calc(${leftPercentage}% + 4px)`,
        width: `calc(${widthPercentage}% - 8px)`,
        backgroundColor: entry.color,
        zIndex: isDragging ? 50 : 10
      }}
      data-instance-id={entry.instanceId}
      className={`scheduled-event-card rounded border border-black/20 shadow-sm overflow-hidden p-1 group ${dragDisabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${isDragging ? 'opacity-60 ring-2 ring-black' : ''} ${isSelected ? 'ring-2 ring-black ring-offset-2' : ''}`}
      title={`${entry.duration} min • ${entry.startTime} – ${entry.endTime}`}
    >
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-start">
          <span className="text-2xs font-mono font-bold opacity-70 leading-tight">
            {timeLabel}
            {isShortDuration && (
              <span className="ml-1 font-sans font-bold">{entry.title}</span>
            )}
          </span>
          {showLayoutDebug && (
            <span className="rounded bg-white/70 px-1 text-2xs font-mono font-bold text-gray-700">
              {columnIndex}/{columnCount}
            </span>
          )}
          <div className="flex items-start gap-1">
            {assignmentUrl && (
              <a
                href={assignmentUrl}
                target="_blank"
                rel="noreferrer"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                className="p-1 bg-white/70 hover:bg-white rounded text-gray-700"
                aria-label="Öppna uppgift"
                title="Öppna uppgift"
              >
                <FileText size={10} />
              </a>
            )}
            <div className={`${isSelected ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 flex gap-1 bg-white/60 rounded`}>
              <button onPointerDown={e => e.stopPropagation()} onClick={() => onEdit(entry)} className="p-1 hover:bg-white rounded"><Edit2 size={8} /></button>
              <button onPointerDown={e => e.stopPropagation()} onClick={() => onRemove(entry.instanceId)} className="p-1 hover:bg-rose-200 text-rose-600 rounded"><Trash2 size={8} /></button>
            </div>
          </div>
        </div>
        {!isShortDuration && (
          <p className={`font-bold leading-tight truncate ${isCompactHeight ? 'text-xs' : 'text-sm'}`}>{entry.title}</p>
        )}
        {adjustedHeight > 30 && (
          <p className={`text-gray-700 truncate ${isCompactHeight ? 'text-2xs' : 'text-xs'}`}>
            {entry.teacher && <span className="font-semibold">{entry.teacher}</span>}
            {entry.teacher && entry.room ? ' ' : ''}
            {entry.room}
          </p>
        )}
        {entry.notes && adjustedHeight > 46 && (
          <p className={`text-gray-600 line-clamp-4 ${isCompactHeight ? 'text-2xs' : 'text-xs'}`}>{entry.notes}</p>
        )}
      </div>
    </div>
  );
}
