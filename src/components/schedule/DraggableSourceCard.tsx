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
};

export function DraggableSourceCard({
  course,
  onEdit,
  onDelete,
  hidden,
  isDerived,
  dragDisabled = false
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
      style={{ backgroundColor: course.color }}
      className={`relative group p-2 mb-2 rounded border border-black/10 transition-all ${dragDisabled ? 'cursor-default' : 'cursor-grab hover:shadow-md'} ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-bold">{course.title}</p>
          <p className="text-[10px] text-gray-600">{course.teacher} {course.room && `(${course.room})`}</p>
          <p className="text-[10px] text-gray-500">{course.duration} min</p>
        </div>
      </div>
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onPointerDown={e => e.stopPropagation()} onClick={() => onEdit(course)} className="p-1 bg-white/50 hover:bg-white rounded-full"><Edit2 size={10} /></button>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onDelete(course, Boolean(isDerived))}
          className="p-1 bg-white/50 hover:bg-rose-200 rounded-full text-rose-700 disabled:opacity-40 disabled:hover:bg-white/50"
          disabled={isDerived}
          title={isDerived ? 'Automatiska byggstenar kan inte raderas här.' : 'Ta bort byggsten'}
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}
