'use client';

import { useEffect, useMemo, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import { isoWeekYear, isoWeekday, SV_FROM_ISO } from '@/utils/dateSv';
import { plannerService } from '@/services/plannerService';
import { mapPlannerActivitiesToSchedule } from '@/hooks/usePlannerSync';
import { buildDayLayout } from '@/utils/scheduleLayout';
import { START_HOUR, END_HOUR, PIXELS_PER_MINUTE } from '@/utils/scheduleTime';
import { DayColumn } from '@/components/schedule/DayColumn';
import { ScheduledEventCard } from '@/components/schedule/ScheduledEventCard';
import type { ScheduledEntry } from '@/types/schedule';

const WEEK_PATTERN = /^v\.?\s*(\d+)$/i;
const noop = () => {};

export function DailySchedulePanel() {
  const [entries, setEntries] = useState<ScheduledEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const { week } = useMemo(() => isoWeekYear(today), [today]);
  const todayName = useMemo(() => SV_FROM_ISO[isoWeekday(today)], [today]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const names = await plannerService.getPlannerArchiveNames();
        const match = names.find(n => {
          const m = n.match(WEEK_PATTERN);
          return m ? Number(m[1]) === week : false;
        });

        if (!match) {
          if (!cancelled) { setEntries([]); setLoading(false); }
          return;
        }

        const activities = await plannerService.getPlannerArchive(match);
        const all = mapPlannerActivitiesToSchedule(activities);
        const todayEntries = all.filter(e => e.day === todayName);

        if (!cancelled) { setEntries(todayEntries); setLoading(false); }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Kunde inte hämta schema.');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [week, todayName]);

  const layout = useMemo(() => buildDayLayout(entries), [entries]);

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const columnHeight = (END_HOUR - START_HOUR) * 60 * PIXELS_PER_MINUTE;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <h2 className="font-bold text-xs uppercase tracking-widest">{todayName} v. {week}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0 px-2 pb-2">
        {loading && <p className="text-xs text-gray-400 px-2 pt-1">Laddar schema…</p>}
        {error && <p className="text-xs text-red-500 px-2 pt-1">{error}</p>}

        {!loading && !error && entries.length === 0 && (
          <p className="text-xs text-gray-400 px-2 pt-1">
            Inget schema för {todayName.toLowerCase()}, v.&nbsp;{week}.
          </p>
        )}

        {!loading && !error && entries.length > 0 && (
          <DndContext onDragEnd={noop}>
            <div className="flex" style={{ minHeight: `${columnHeight}px` }}>
              {/* Time labels */}
              <div className="w-10 shrink-0 relative" style={{ height: `${columnHeight}px` }}>
                {hours.map(h => (
                  <div
                    key={h}
                    className="absolute text-2xs font-mono text-gray-400 -translate-y-1/2 text-right w-8"
                    style={{ top: `${(h - START_HOUR) * 60 * PIXELS_PER_MINUTE}px` }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Day column */}
              <DayColumn day={todayName} ghost={null} className="!min-w-0 !border-r-0">
                {entries.map((entry, i) => {
                  const info = layout.get(entry.instanceId);
                  return (
                    <ScheduledEventCard
                      key={entry.instanceId}
                      entry={entry}
                      onEdit={noop}
                      onRemove={noop}
                      onContextMenu={noop}
                      columnIndex={info?.column ?? 0}
                      columnCount={info?.columns ?? 1}
                      isLastOfDay={i === entries.length - 1}
                      showLayoutDebug={false}
                      dragDisabled
                    />
                  );
                })}
              </DayColumn>
            </div>
          </DndContext>
        )}
      </div>
    </div>
  );
}
