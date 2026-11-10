'use client';

import React from 'react';
import type { LabState } from '@/types/lessonLab';
import { classColor, DragData, lessonLabel } from '@/components/lesson-lab/labShared';

/** Det som följer muspekaren när man drar en lektion, en klass, en lärare eller en bricka. */

export function LabDragPreview({ data, state }: { data: DragData; state: LabState }) {
  const lesson = 'lessonId' in data ? state.template.find(l => l.id === data.lessonId) : undefined;
  if (data.kind === 'teacher') {
    const teacher = state.teachers.find(t => t.id === data.teacherId);
    return <span className="rounded-full border-frame border-ui-line bg-ui-paper px-3 py-1 text-sm font-bold shadow-frame-sm">{teacher?.name}</span>;
  }
  if (!lesson) return null;
  const background = data.kind === 'part' ? classColor(data.className) : '#fff';
  return (
    <span
      className="inline-block rounded-md border-frame border-ui-line px-2 py-1 font-mono text-xs font-bold shadow-frame-sm"
      style={{ background }}
    >
      {lessonLabel(lesson)}{data.kind === 'part' && ` · ${data.className}`}
    </span>
  );
}
