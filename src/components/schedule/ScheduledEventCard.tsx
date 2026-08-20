'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Edit2, FileText, Trash2 } from 'lucide-react';
import { ScheduledEntry } from '@/types/schedule';
import { splitTeacherNames } from '@/utils/scheduleStats';
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
  isHighlighted?: boolean;
  /** Ligger inom gummibandet just nu och får anteckningarna när ramen släpps. */
  isNotesTarget?: boolean;
  /** Ligger inom gummibandet men är skyddad — hoppas över vid inklistring. */
  isNotesProtected?: boolean;
  /** Färgen att visa. Kan skilja sig från entry.color när en färgregel slår till. */
  color?: string;
  /** Syns på skärmen men döljs i PDF/bild av regeln under `.pdf-export`. */
  excludedFromExport?: boolean;
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
  isSelected = false,
  isHighlighted = false,
  isNotesTarget = false,
  isNotesProtected = false,
  color,
  excludedFromExport = false
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
  const teacherNames = splitTeacherNames(entry.teacher);

  if (hidden) return null;

  const isShortDuration = entry.duration < 45;
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
        backgroundColor: color ?? entry.color,
        zIndex: isDragging ? 50 : 10
      }}
      data-instance-id={entry.instanceId}
      data-export-exclude={excludedFromExport ? 'true' : undefined}
      className={`scheduled-event-card sp-event-card rounded overflow-hidden p-1 group ${dragDisabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${isDragging ? 'opacity-60 sp-ring' : ''} ${isSelected ? 'sp-ring' : ''} ${isHighlighted ? 'ring-4 ring-orange-500 ring-offset-1' : ''} ${isNotesTarget ? 'ring-4 ring-sky-600 ring-offset-1' : ''} ${isNotesProtected ? 'sp-notes-protected' : ''}`}
      title={`${entry.duration} min • ${entry.startTime} – ${entry.endTime}`}
    >
      <div className="sp-event-card-body flex flex-col h-full">
        <div className="flex justify-between items-start">
          <span
            /* På korta kort ryms ingen egen titelrad – titeln sitter här inne,
               och då är det den här raden exporten ska klämma. */
            data-card-title={isShortDuration ? true : undefined}
            className="text-2xs font-mono font-bold opacity-70 leading-tight"
          >
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
            <div data-card-actions className={`${isSelected ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 flex gap-1 bg-white/60 rounded`}>
              <button onPointerDown={e => e.stopPropagation()} onClick={() => onEdit(entry)} className="p-1 hover:bg-white rounded"><Edit2 size={8} /></button>
              <button onPointerDown={e => e.stopPropagation()} onClick={() => onRemove(entry.instanceId)} className="p-1 hover:bg-rose-200 text-rose-600 rounded"><Trash2 size={8} /></button>
            </div>
          </div>
        </div>
        {!isShortDuration && (
          <p data-card-title className={`font-bold leading-tight truncate ${isCompactHeight ? 'text-xs' : 'text-sm'}`}>{entry.title}</p>
        )}
        {adjustedHeight > 30 && teacherNames.length > 0 && (
          /* Lärarnamn kortas aldrig av med "…" – varje namn får en egen rad och
             bryts vid behov över flera rader. */
          <div className={`shrink-0 text-gray-700 leading-tight font-semibold ${isCompactHeight ? 'text-2xs' : 'text-xs'}`}>
            {teacherNames.map((name, index) => (
              <p key={`${name}-${index}`} className="break-words">{name}</p>
            ))}
          </div>
        )}
        {adjustedHeight > 30 && entry.room && (
          <p className={`text-gray-700 truncate leading-tight ${isCompactHeight ? 'text-2xs' : 'text-xs'}`}>
            {entry.room}
          </p>
        )}
        {entry.notes && adjustedHeight > 46 && (
          /* `data-card-notes` är fästet som exporten klämmer i – klassnamnen
             byts av `.pdf-export` och duger inte som väljare där. */
          <p data-card-notes className={`text-gray-600 whitespace-pre-line line-clamp-4 ${isCompactHeight ? 'text-2xs' : 'text-xs'}`}>{entry.notes}</p>
        )}
      </div>
    </div>
  );
}
