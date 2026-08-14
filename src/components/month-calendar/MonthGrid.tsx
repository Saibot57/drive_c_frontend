'use client';

import { useCallback, useRef } from 'react';

import type { CalendarDayData } from '@/services/monthCalendarService';
import {
  SV_WEEKDAYS_SHORT,
  getMatrixRows,
  type DateKey,
  type DayCell,
} from '@/utils/calendarDates';
import MonthDayCell from './MonthDayCell';
import type { HighlighterMode } from './types';

interface Props {
  cells: DayCell[];
  getDay: (key: DateKey) => CalendarDayData;
  bandCount: number;
  todayKey: DateKey;
  selected: DateKey;
  mode: HighlighterMode;
  onSelect: (key: DateKey) => void;
  onQuickText: (key: DateKey, text: string) => void;
  onBandClick: (key: DateKey, band: number) => void;
}

export default function MonthGrid({
  cells,
  getDay,
  bandCount,
  todayKey,
  selected,
  mode,
  onSelect,
  onQuickText,
  onBandClick,
}: Props) {
  const rows = getMatrixRows(cells);
  const cellRefs = useRef(new Map<DateKey, HTMLDivElement>());

  const registerRef = useCallback((key: DateKey, el: HTMLDivElement | null) => {
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  }, []);

  /** Pilnavigering: en dag i sidled, en vecka i höjdled. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const delta =
        e.key === 'ArrowLeft' ? -1
        : e.key === 'ArrowRight' ? 1
        : e.key === 'ArrowUp' ? -7
        : e.key === 'ArrowDown' ? 7
        : e.key === 'Home' ? -(cells.findIndex((c) => c.key === selected) % 7)
        : e.key === 'End' ? 6 - (cells.findIndex((c) => c.key === selected) % 7)
        : null;

      if (delta === null) return;
      e.preventDefault();

      const index = cells.findIndex((c) => c.key === selected);
      const next = cells[index + delta];
      // Utanför matrisen: låt månadsnavigationen sköta det i stället för att
      // hoppa till en cell som inte finns.
      if (!next) return;
      onSelect(next.key);
      cellRefs.current.get(next.key)?.focus();
    },
    [cells, selected, onSelect],
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
    <div className="mc-grid" role="grid" aria-label="Månadskalender" onKeyDown={onKeyDown}>
      <div className="mc-corner" role="presentation" />
      {SV_WEEKDAYS_SHORT.map((d) => (
        <div key={d} className="mc-weekday" role="columnheader">
          {d}
        </div>
      ))}

      {rows.map((row) => (
        <div key={row[0].key} style={{ display: 'contents' }} role="row">
          <div className="mc-weeknum" role="rowheader" aria-label={`Vecka ${row[0].isoWeek}`}>
            {row[0].isoWeek}
          </div>
          {row.map((cell) => (
            <MonthDayCell
              key={cell.key}
              cell={cell}
              data={getDay(cell.key)}
              bandCount={bandCount}
              isToday={cell.key === todayKey}
              isSelected={cell.key === selected}
              mode={mode}
              onSelect={onSelect}
              onQuickText={onQuickText}
              onBandClick={onBandClick}
              registerRef={registerRef}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
