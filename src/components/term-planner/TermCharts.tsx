'use client';

import React from 'react';
import { DonutChart } from '@/components/term-planner/DonutChart';
import { SortableCharts } from '@/components/term-planner/SortableCharts';
import {
  classShareSlices,
  foldSlices,
  formatHours,
  LessonTeachers,
  StatColumn,
  TeacherLessonMix,
  teacherShareSlices,
  TermStats,
} from '@/utils/termPlanner';

const CLASSES: { key: StatColumn; label: string }[] = [
  { key: 'oliv', label: 'Oliv' },
  { key: 'rosa', label: 'Rosa' },
  { key: 'grund', label: 'Grund' },
];

/** Fler bitar än så går inte att läsa i ett cirkeldiagram. */
const MAX_LESSON_SLICES = 7;

// Korten har egen luft och en ram vid hovring, så gapet är mindre än förut.
const chartGrid = 'grid gap-4 p-3 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]';

// Ordningen sparas per ruta. Id:na är klassnyckeln respektive lärarens
// normaliserade namn, så en lärare behåller sin plats mellan terminer.
const CLASS_ORDER_KEY = 'termPlanner.order.classes.v1';
const LESSON_ORDER_KEY = 'termPlanner.order.lessons.v1';
// Passens titel, normaliserad.
const LESSON_TYPE_ORDER_KEY = 'termPlanner.order.lessonTypes.v1';

const Empty = () => <p className="p-4 text-sm italic text-gray-500">Inga lärartimmar att visa ännu.</p>;

/** Hur Oliv, Rosa och Grund fördelas på lärarna. */
export function ClassSharePanel({ stats, teacherColors }: {
  stats: TermStats;
  teacherColors: Map<string, string>;
}) {
  if (stats.rows.length === 0) return <Empty />;
  return (
    <SortableCharts
      storageKey={CLASS_ORDER_KEY}
      className={chartGrid}
      items={CLASSES.map(({ key, label }) => ({
        id: key,
        label,
        node: <DonutChart title={label} slices={classShareSlices(stats, key, teacherColors)} />,
      }))}
    />
  );
}

/** Vad varje lärares tid består av, per lektion, i lektionernas färger från planeraren. */
export function LessonMixPanel({ mixes, teacherColors }: {
  mixes: TeacherLessonMix[];
  teacherColors: Map<string, string>;
}) {
  if (mixes.length === 0) return <Empty />;
  return (
    <SortableCharts
      storageKey={LESSON_ORDER_KEY}
      className={chartGrid}
      items={mixes.map(mix => ({
        id: mix.key,
        label: mix.label,
        node: (
          <DonutChart
            title={(
              <span className="inline-flex max-w-full items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: teacherColors.get(mix.key) }}
                  aria-hidden
                />
                <span className="truncate">{mix.label}</span>
                <span className="font-normal text-gray-500">· {formatHours(mix.total)} h</span>
              </span>
            )}
            slices={foldSlices(mix.lessons, MAX_LESSON_SLICES)}
          />
        ),
      }))}
    />
  );
}

/**
 * Hur varje valt pass fördelas på lärarna — som Oliv, Rosa och Grund, men för
 * de pass som väljs under kugghjulet.
 */
export function LessonTeachersPanel({ lessons, isSelected, teacherColors }: {
  lessons: LessonTeachers[];
  isSelected: (lesson: LessonTeachers) => boolean;
  teacherColors: Map<string, string>;
}) {
  if (lessons.length === 0) return <Empty />;
  const shown = lessons.filter(isSelected);
  if (shown.length === 0) {
    return <p className="p-4 text-sm italic text-gray-500">Inga pass valda. Välj pass under kugghjulet.</p>;
  }
  return (
    <SortableCharts
      storageKey={LESSON_TYPE_ORDER_KEY}
      className={chartGrid}
      items={shown.map(lesson => ({
        id: lesson.key,
        label: lesson.label,
        node: (
          <DonutChart
            title={(
              <span className="inline-flex max-w-full items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: lesson.color }}
                  aria-hidden
                />
                <span className="truncate">{lesson.label}</span>
              </span>
            )}
            slices={teacherShareSlices(lesson.teachers, teacherColors)}
          />
        ),
      }))}
    />
  );
}
