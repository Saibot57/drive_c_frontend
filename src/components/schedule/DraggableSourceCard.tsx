'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Edit2, Trash2 } from 'lucide-react';
import { PlannerCourse } from '@/types/schedule';

type DraggableSourceCardProps = {
  course: PlannerCourse;
  onEdit: (course: PlannerCourse) => void;
  onDelete: (course: PlannerCourse, isDerived: boolean) => void;
  hidden?: boolean;
  isDerived?: boolean;
  dragDisabled?: boolean;
  isSelected?: boolean;
  /** Färgen att visa. Kan skilja sig från course.color när en färgregel slår till. */
  color?: string;
};

export function DraggableSourceCard({
  course,
  onEdit,
  onDelete,
  hidden,
  isDerived,
  dragDisabled = false,
  isSelected = false,
  color
}: DraggableSourceCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${course.id}`,
    data: { type: 'course', course },
    disabled: dragDisabled
  });

  if (hidden) return null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ backgroundColor: color ?? course.color }}
      onDoubleClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if ((event.target as HTMLElement).closest('a, button')) return;
        onEdit(course);
      }}
      className={`relative group p-2 mb-2 rounded sp-source-card transition-all ${dragDisabled ? 'cursor-default' : 'cursor-grab hover:shadow-[2px_2px_0_0_#000]'} ${isDragging ? 'opacity-50' : ''} ${isSelected ? 'sp-ring' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-bold">{course.title}</p>
          <p className="text-2xs text-gray-600">{course.teacher} {course.room && `(${course.room})`}</p>
          <p className="text-2xs text-gray-500">{course.duration} min</p>
        </div>
      </div>
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onEdit(course)}
          className="grid h-5 w-5 place-items-center rounded-full bg-white/50 hover:bg-white"
          aria-label="Redigera byggsten"
          title="Redigera byggsten"
        >
          <Edit2 size={12} />
        </button>
        <button
          type="button"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onDelete(course, Boolean(isDerived))}
          className="grid h-5 w-5 place-items-center rounded-full bg-white/50 text-rose-700 hover:bg-rose-200 disabled:opacity-40 disabled:hover:bg-white/50"
          disabled={isDerived}
          aria-label="Ta bort byggsten"
          title={isDerived ? 'Automatiska byggstenar kan inte tas bort här.' : 'Ta bort byggsten'}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
