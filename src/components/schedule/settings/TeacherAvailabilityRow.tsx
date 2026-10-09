'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PLANNER_DAYS } from '@/config/plannerConstants';
import { Button } from '@/components/ui/button';
import { TeacherAvailability, TeacherDayBlock } from '@/types/schedule';
import { blocksWholeDay } from '@/utils/scheduleRules';

const DAY_ABBREVIATION: Record<string, string> = {
  'Måndag': 'Må',
  'Tisdag': 'Ti',
  'Onsdag': 'On',
  'Torsdag': 'To',
  'Fredag': 'Fr'
};

export const toggleBlock = (
  availability: TeacherAvailability,
  teacher: string,
  day: string,
  next: TeacherDayBlock[]
): TeacherAvailability => {
  const days = { ...(availability[teacher] ?? {}) };
  if (next.length === 0) {
    delete days[day];
  } else {
    days[day] = next;
  }

  const updated = { ...availability };
  if (Object.keys(days).length === 0) {
    delete updated[teacher];
  } else {
    updated[teacher] = days;
  }
  return updated;
};

type TeacherAvailabilityRowProps = {
  teacher: string;
  days: Record<string, TeacherDayBlock[]>;
  onChange: (day: string, next: TeacherDayBlock[]) => void;
};

export function TeacherAvailabilityRow({ teacher, days, onChange }: TeacherAvailabilityRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const summary = useMemo(() => {
    const parts = PLANNER_DAYS
      .filter(day => (days[day] ?? []).length > 0)
      .map(day => {
        const blocks = days[day];
        if (blocksWholeDay(blocks)) return DAY_ABBREVIATION[day];
        return `${DAY_ABBREVIATION[day]} ${blocks[0]}`;
      });
    return parts.length > 0 ? parts.join(', ') : 'Alltid tillgänglig';
  }, [days]);

  return (
    <div className="border-frame border-ui-line rounded p-2 bg-ui-paper">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm break-words">{teacher}</p>
          <p className="text-[11px] text-ui-muted truncate">{summary}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="neutral"
          className="h-7 w-7 p-0 shrink-0"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? `Dölj halvdagar för ${teacher}` : `Visa halvdagar för ${teacher}`}
          onClick={() => setIsExpanded(open => !open)}
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Button>
      </div>

      <div className="mt-2 flex gap-1">
        {PLANNER_DAYS.map(day => {
          const blocks = days[day] ?? [];
          const wholeDay = blocksWholeDay(blocks);

          return (
            <div key={day} className="flex-1 min-w-0 space-y-1">
              <button
                type="button"
                aria-pressed={wholeDay}
                title={`${teacher}, ${day.toLocaleLowerCase('sv')} – hela dagen`}
                onClick={() => onChange(day, wholeDay ? [] : ['all'])}
                className={`w-full rounded border-frame border-ui-line px-1 py-1 text-xs font-bold transition-colors ${
                  wholeDay ? 'bg-rose-300' : 'bg-ui-paper hover:bg-gray-100 kron:hover:bg-ui-surface-3'
                }`}
              >
                {DAY_ABBREVIATION[day]}
              </button>

              {isExpanded && (['fm', 'em'] as const).map(part => {
                const active = wholeDay || blocks.includes(part);
                return (
                  <button
                    key={part}
                    type="button"
                    aria-pressed={active}
                    title={`${teacher}, ${day.toLocaleLowerCase('sv')} ${part === 'fm' ? 'förmiddag (före 12)' : 'eftermiddag (efter 12)'}`}
                    onClick={() => {
                      const current = wholeDay ? (['fm', 'em'] as TeacherDayBlock[]) : blocks;
                      const next = current.includes(part)
                        ? current.filter(block => block !== part)
                        : [...current.filter(block => block !== 'all'), part];
                      onChange(day, next);
                    }}
                    className={`w-full rounded border border-black px-1 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                      active ? 'bg-rose-200' : 'bg-ui-paper hover:bg-gray-100 kron:hover:bg-ui-surface-3'
                    }`}
                  >
                    {part}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
