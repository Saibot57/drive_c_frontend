'use client';

import React from 'react';
import { DonutChart } from '@/components/term-planner/DonutChart';
import {
  classShareSlices,
  foldSlices,
  formatHours,
  StatColumn,
  TeacherLessonMix,
  TermStats,
} from '@/utils/termPlanner';

const CLASSES: { key: StatColumn; label: string }[] = [
  { key: 'oliv', label: 'Oliv' },
  { key: 'rosa', label: 'Rosa' },
  { key: 'grund', label: 'Grund' },
];

/** Fler bitar än så går inte att läsa i ett cirkeldiagram. */
const MAX_LESSON_SLICES = 7;

const chartGrid = 'grid gap-x-6 gap-y-8 p-4 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]';

const Empty = () => <p className="p-4 text-sm italic text-gray-500">Inga lärartimmar att visa ännu.</p>;

/** Hur Oliv, Rosa och Grund fördelas på lärarna. */
export function ClassSharePanel({ stats, teacherColors }: {
  stats: TermStats;
  teacherColors: Map<string, string>;
}) {
  if (stats.rows.length === 0) return <Empty />;
  return (
    <div className={chartGrid}>
      {CLASSES.map(({ key, label }) => (
        <DonutChart key={key} title={label} slices={classShareSlices(stats, key, teacherColors)} />
      ))}
    </div>
  );
}

/** Vad varje lärares tid består av, per lektion, i lektionernas färger från planeraren. */
export function LessonMixPanel({ mixes, teacherColors }: {
  mixes: TeacherLessonMix[];
  teacherColors: Map<string, string>;
}) {
  if (mixes.length === 0) return <Empty />;
  return (
    <div className={chartGrid}>
      {mixes.map(mix => (
        <DonutChart
          key={mix.key}
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
      ))}
    </div>
  );
}
