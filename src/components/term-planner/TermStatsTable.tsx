'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { WheelWeek } from '@/utils/themeWheelWeeks';
import { formatHours, STAT_COLUMNS, TeacherMinutes, TermStats } from '@/utils/termPlanner';

type Props = {
  stats: TermStats;
  calendarWeeks: WheelWeek[];
  /** Lärarens färg i diagrammen, som en prick vid namnet. */
  teacherColors: Map<string, string>;
};

const numberCell = 'px-2 py-1.5 text-right tabular-nums';

function MinuteCells({ minutes, strong = false }: { minutes: TeacherMinutes; strong?: boolean }) {
  return (
    <>
      {STAT_COLUMNS.map(column => (
        <td key={column.key} className={numberCell}>{formatHours(minutes.byColumn[column.key])}</td>
      ))}
      <td className={`${numberCell} border-l-2 border-black ${strong ? 'font-bold' : 'font-semibold'}`}>
        {formatHours(minutes.total) || '0'}
      </td>
    </>
  );
}

export function TermStatsTable({ stats, calendarWeeks, teacherColors }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  if (stats.rows.length === 0) {
    return <p className="p-4 text-sm italic text-gray-500">Inga lärartimmar att räkna ännu.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-xs uppercase tracking-wide text-gray-500">
            <th className="px-2 py-2 text-left font-semibold">Lärare</th>
            {STAT_COLUMNS.map(column => (
              <th key={column.key} className="px-2 py-2 text-right font-semibold">{column.label}</th>
            ))}
            <th className="border-l-2 border-black px-2 py-2 text-right font-semibold">Totalt</th>
          </tr>
        </thead>
        <tbody>
          {stats.rows.map(row => {
            const isOpen = expanded.has(row.key);
            return (
              <React.Fragment key={row.key}>
                <tr
                  className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                  onClick={() => toggle(row.key)}
                >
                  <td className="whitespace-nowrap px-2 py-1.5 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span
                        className="mx-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: teacherColors.get(row.key) }}
                        aria-hidden
                      />
                      {row.label}
                    </span>
                  </td>
                  <MinuteCells minutes={row.minutes} />
                </tr>
                {isOpen && row.weeks.map(week => (
                  <tr key={week.index} className="border-b border-gray-100 bg-gray-50 text-xs text-gray-600">
                    <td className="whitespace-nowrap py-1 pl-7 pr-2">
                      {calendarWeeks[week.index]?.label}
                      <span className="ml-2 text-gray-400">{calendarWeeks[week.index]?.dateLabel}</span>
                    </td>
                    <MinuteCells minutes={week.minutes} />
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black">
            <td className="px-2 py-2 font-bold">Summa</td>
            <MinuteCells minutes={stats.totals} strong />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
