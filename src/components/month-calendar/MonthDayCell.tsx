'use client';

import { useEffect, useRef } from 'react';

import type { CalendarDayData, Highlight } from '@/services/monthCalendarService';
import type { DayCell } from '@/utils/calendarDates';
import { formatSwedishDateShort } from '@/utils/calendarDates';
import { HIGHLIGHT_ALPHA, HIGHLIGHT_HEX, HIGHLIGHT_LABEL, withAlpha } from './constants';
import type { HighlighterMode } from './types';

interface Props {
  cell: DayCell;
  data: CalendarDayData;
  bandCount: number;
  isToday: boolean;
  isSelected: boolean;
  mode: HighlighterMode;
  onSelect: (key: string) => void;
  onQuickText: (key: string, text: string) => void;
  onBandClick: (key: string, band: number) => void;
  registerRef: (key: string, el: HTMLDivElement | null) => void;
}

export default function MonthDayCell({
  cell,
  data,
  bandCount,
  isToday,
  isSelected,
  mode,
  onSelect,
  onQuickText,
  onBandClick,
  registerRef,
}: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const painting = mode !== 'off';

  // Textarean speglar cachen. Att sätta value direkt skulle flytta markören
  // till slutet vid varje omrendering, så DOM-värdet skrivs bara när det
  // faktiskt skiljer sig — typiskt vid dagbyte eller när servern svarat.
  useEffect(() => {
    const el = textarea.current;
    if (el && el.value !== data.quick_text && document.activeElement !== el) {
      el.value = data.quick_text;
    }
  }, [data.quick_text]);

  const byBand = new Map<number, Highlight>(data.highlights.map((h) => [h.band, h]));

  const contentSummary = [
    data.quick_text ? 'har text' : null,
    data.note_document ? 'har anteckning' : null,
    data.highlights.length
      ? `${data.highlights.length} ${data.highlights.length === 1 ? 'markering' : 'markeringar'}`
      : null,
  ].filter(Boolean);

  return (
    <div
      ref={(el) => registerRef(cell.key, el)}
      role="gridcell"
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      aria-label={
        `${formatSwedishDateShort(cell.key)}` +
        `${isToday ? ', idag' : ''}` +
        `${cell.inMonth ? '' : ', annan månad'}` +
        `${contentSummary.length ? `, ${contentSummary.join(', ')}` : ', tom'}`
      }
      className={[
        'mc-cell',
        cell.inMonth ? '' : 'mc-cell--outside',
        isToday ? 'mc-cell--today' : '',
        isSelected ? 'mc-cell--selected' : '',
      ].filter(Boolean).join(' ')}
      onMouseDown={() => {
        // Val av dag ska ske även när man målar, men bandet hanterar sitt
        // eget klick och stoppar bubblingen.
        if (!painting) onSelect(cell.key);
      }}
    >
      {/* Bandlagret. pointer-events styrs helt av .mc-root--painting i CSS. */}
      <div className="mc-bands" aria-hidden={!painting}>
        {Array.from({ length: bandCount }, (_, band) => {
          const hl = byBand.get(band);
          return (
            <button
              key={band}
              type="button"
              className="mc-band"
              tabIndex={painting ? 0 : -1}
              aria-hidden={!painting}
              aria-label={
                hl
                  ? `Band ${band + 1}, ${HIGHLIGHT_LABEL[hl.color].toLowerCase()}`
                  : `Band ${band + 1}, omarkerat`
              }
              style={
                hl
                  ? { backgroundColor: withAlpha(HIGHLIGHT_HEX[hl.color], HIGHLIGHT_ALPHA) }
                  : undefined
              }
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBandClick(cell.key, band);
              }}
            />
          );
        })}
      </div>

      <div className="mc-dayhead">
        <button
          type="button"
          className="mc-daynum"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onSelect(cell.key)}
          aria-label={`Välj ${formatSwedishDateShort(cell.key)}`}
        >
          {cell.dayOfMonth}
        </button>
        {data.note_document && (
          <span className="mc-marker" aria-hidden="true" title="Har anteckning">
            ●
          </span>
        )}
      </div>

      <textarea
        ref={textarea}
        className="mc-quicktext"
        defaultValue={data.quick_text}
        // Under målning är texten inte redigerbar — annars blir klickmålet oklart.
        readOnly={painting}
        tabIndex={painting ? -1 : 0}
        aria-label={`Snabbtext för ${formatSwedishDateShort(cell.key)}`}
        spellCheck={false}
        onMouseDown={(e) => {
          if (painting) return;
          e.stopPropagation();
          onSelect(cell.key);
        }}
        onChange={(e) => onQuickText(cell.key, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.currentTarget.blur();
          }
          // Piltangenter tillhör texten när man skriver, inte griden.
          e.stopPropagation();
        }}
      />
      <div className="mc-fade" aria-hidden="true" />
    </div>
  );
}
