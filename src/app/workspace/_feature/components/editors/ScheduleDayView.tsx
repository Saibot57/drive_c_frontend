'use client';

import { useMemo } from 'react';
import { buildDayLayout } from '@/utils/scheduleLayout';
import { EVENT_GAP_PX, MIN_HEIGHT_PX, PIXELS_PER_MINUTE, timeToMinutes } from '@/utils/scheduleTime';
import { getReadableTextColor } from '@/utils/readableTextColor';
import type { ScheduleDayContent, ScheduleDayEntry } from '../../types/scheduleDay.types';
import { DAY_HEADER_HEIGHT, DAY_RULER_WIDTH } from '../../utils/scheduleDayImport';

interface ScheduleDayViewProps {
  content: ScheduleDayContent | null;
}

/**
 * En dag ur schemaplaneraren, skrivskyddad.
 *
 * Positioneringen räknas med schemats egna funktioner — `timeToMinutes` och
 * `PIXELS_PER_MINUTE` — så en lektion sitter på exakt samma höjd här som i
 * planeraren. Krockar löses av `buildDayLayout`, samma funktion som lägger
 * kolumnerna där.
 *
 * Det som *inte* följer med är redigeringen. `DayColumn` bygger på `useDroppable`
 * och `ScheduledEventCard` på `useDraggable` plus åtta hanterare; inget av det
 * hör hemma på en yta man antecknar på. Vill man ändra schemat gör man det i
 * planeraren.
 */
export default function ScheduleDayView({ content }: ScheduleDayViewProps) {
  const model = useMemo(() => {
    if (!content) return null;
    const entries = content.entries ?? [];
    return {
      entries,
      layout: buildDayLayout(entries),
      // Nollpunkten är fönstrets början, inte schemats START_HOUR. Kortet är
      // klippt till det som används.
      originMinutes: content.windowStartHour * 60,
      hours: Array.from(
        { length: Math.max(content.windowEndHour - content.windowStartHour, 0) },
        (_, i) => content.windowStartHour + i,
      ),
    };
  }, [content]);

  if (!content || !model) {
    return <div className="ws-schedule-day__state">Dagen saknar innehåll.</div>;
  }

  return (
    <div className="ws-schedule-day">
      <div className="ws-schedule-day__head" style={{ height: DAY_HEADER_HEIGHT }}>
        <span className="ws-schedule-day__name">{content.day}</span>
        {model.entries.length === 0 && (
          <span className="ws-schedule-day__empty">tom</span>
        )}
      </div>

      <div className="ws-schedule-day__body">
        {content.showRuler && (
          <div className="ws-schedule-day__ruler" style={{ width: DAY_RULER_WIDTH }}>
            {model.hours.map((hour) => (
              <span
                key={hour}
                className="ws-schedule-day__hour"
                style={{ top: (hour * 60 - model.originMinutes) * PIXELS_PER_MINUTE }}
              >
                {String(hour).padStart(2, '0')}:00
              </span>
            ))}
          </div>
        )}

        <div className="ws-schedule-day__grid">
          {model.hours.map((hour) => (
            <div
              key={hour}
              className="ws-schedule-day__line"
              style={{ top: (hour * 60 - model.originMinutes) * PIXELS_PER_MINUTE }}
            />
          ))}

          {model.entries.map((entry) => (
            <Lesson
              key={entry.instanceId}
              entry={entry}
              originMinutes={model.originMinutes}
              column={model.layout.get(entry.instanceId)?.column ?? 0}
              columns={model.layout.get(entry.instanceId)?.columns ?? 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * En lektion. Vad som ryms beror på höjden — samma trappa som
 * ScheduledEventCard använder i planeraren, så en kort lektion ser lika kort ut
 * här.
 */
function Lesson({
  entry,
  originMinutes,
  column,
  columns,
}: {
  entry: ScheduleDayEntry;
  originMinutes: number;
  column: number;
  columns: number;
}) {
  const top = (timeToMinutes(entry.startTime) - originMinutes) * PIXELS_PER_MINUTE;
  const height = Math.max(entry.duration * PIXELS_PER_MINUTE - EVENT_GAP_PX, MIN_HEIGHT_PX);
  const widthPercent = 100 / Math.max(columns, 1);

  const isShort = entry.duration < 45;
  const isCompact = height < 38;
  const textColor = getReadableTextColor(entry.color);

  return (
    <div
      className="ws-schedule-day__lesson"
      style={{
        top: top + EVENT_GAP_PX / 2,
        height,
        left: `calc(${widthPercent * column}% + 3px)`,
        width: `calc(${widthPercent}% - 6px)`,
        backgroundColor: entry.color,
        color: textColor,
      }}
      title={[
        `${entry.startTime}–${entry.endTime} · ${entry.title}`,
        entry.teacher,
        entry.room,
        entry.notes,
      ].filter(Boolean).join('\n')}
    >
      <span className="ws-schedule-day__time">
        {entry.startTime}
        {isShort && <span className="ws-schedule-day__inline-title">{entry.title}</span>}
      </span>
      {!isShort && (
        <span className={`ws-schedule-day__title ${isCompact ? 'is-compact' : ''}`}>
          {entry.title}
        </span>
      )}
      {height > 30 && entry.teacher && (
        <span className="ws-schedule-day__meta">{entry.teacher}</span>
      )}
      {height > 30 && entry.room && (
        <span className="ws-schedule-day__meta">{entry.room}</span>
      )}
      {height > 46 && entry.notes && (
        <span className="ws-schedule-day__notes">{entry.notes}</span>
      )}
    </div>
  );
}
