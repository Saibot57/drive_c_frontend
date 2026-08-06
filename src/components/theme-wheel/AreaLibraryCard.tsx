'use client';

import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { ThemeArea } from '@/types/themeWheel';
import { getMutedTextColor, getReadableTextColor } from '@/utils/readableTextColor';

type AreaLibraryCardProps = {
  area: ThemeArea;
  /** Härledd ur hjulet i stället för skapad för hand – går inte att radera. */
  isDerived: boolean;
  weeksUsed: number;
  onEdit: (area: ThemeArea) => void;
  onDelete: (area: ThemeArea, isDerived: boolean) => void;
  onPointerDown: (area: ThemeArea, event: React.PointerEvent) => void;
};

/**
 * Ett arbetsområde i biblioteket. Motsvarar DraggableSourceCard i
 * schemaplaneraren, men dras med samma pekarlager som hjulet använder.
 */
export function AreaLibraryCard({
  area,
  isDerived,
  weeksUsed,
  onEdit,
  onDelete,
  onPointerDown,
}: AreaLibraryCardProps) {
  const textColor = getReadableTextColor(area.color);
  const mutedColor = getMutedTextColor(area.color);

  return (
    <div
      onPointerDown={event => onPointerDown(area, event)}
      style={{ backgroundColor: area.color, color: textColor }}
      className="group relative mb-2 cursor-grab touch-none select-none rounded p-2 sp-source-card transition-all hover:shadow-md active:cursor-grabbing"
      title="Dra ut i hjulet för att placera"
    >
      <p className="pr-12 text-sm font-bold">{area.title}</p>
      <p className="text-2xs" style={{ color: mutedColor }}>
        {weeksUsed > 0 ? `${weeksUsed} v i hjulet` : 'Inte placerad'}
        {area.comment ? ` · ${area.comment}` : ''}
      </p>
      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onPointerDown={event => event.stopPropagation()}
          onClick={() => onEdit(area)}
          className="rounded-full bg-white/60 p-1 hover:bg-white"
          aria-label={`Redigera ${area.title}`}
        >
          <Edit2 size={10} />
        </button>
        <button
          type="button"
          onPointerDown={event => event.stopPropagation()}
          onClick={() => onDelete(area, isDerived)}
          disabled={isDerived}
          className="rounded-full bg-white/60 p-1 text-rose-700 hover:bg-rose-200 disabled:opacity-40 disabled:hover:bg-white/60"
          title={isDerived ? 'Området finns i hjulet och kan inte raderas här.' : 'Ta bort ur biblioteket'}
          aria-label={`Ta bort ${area.title}`}
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}
