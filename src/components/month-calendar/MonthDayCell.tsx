'use client';

import { useEffect, useRef, useState } from 'react';

import type { CalendarDayData, Highlight } from '@/services/monthCalendarService';
import type { DayCell } from '@/utils/calendarDates';
import { formatSwedishDateShort } from '@/utils/calendarDates';
import { HIGHLIGHT_ALPHA, HIGHLIGHT_HEX, HIGHLIGHT_LABEL, withAlpha } from '@/config/monthCalendarConstants';
import { fitsRows } from '@/utils/calendarRows';
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
  // Senast godtagna text, att gå tillbaka till när en ändring inte får plats.
  const accepted = useRef(data.quick_text);
  const [overflowing, setOverflowing] = useState(false);
  const painting = mode !== 'off';

  // Textarean speglar cachen. Att sätta value direkt skulle flytta markören
  // till slutet vid varje omrendering, så DOM-värdet skrivs bara när det
  // faktiskt skiljer sig — typiskt vid dagbyte eller när servern svarat.
  useEffect(() => {
    const el = textarea.current;
    if (el && el.value !== data.quick_text && document.activeElement !== el) {
      el.value = data.quick_text;
    }
    if (el) accepted.current = el.value;
  }, [data.quick_text]);

  // En lång rad radbryts och kan då ta en rad till än antalet. Toningen visas
  // bara när något faktiskt är dolt. Bredden ändras med fönstret, så det
  // räknas om vid storleksändring och inte bara när texten ändras.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [data.quick_text, bandCount]);

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
        overflowing ? 'mc-cell--overflowing' : '',
      ].filter(Boolean).join(' ')}
      onMouseDown={() => {
        // Val av dag ska ske även när man målar, men bandet hanterar sitt
        // eget klick och stoppar bubblingen.
        if (!painting) onSelect(cell.key);
      }}
    >
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

      {/* Radytan: en rad per band. Banden ligger underst, texten ovanpå med
          samma radhöjd, så att varje textrad hamnar i sitt band. */}
      <div className="mc-lines">
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
          onChange={(e) => {
            const el = e.currentTarget;
            // Fler rader än cellen har tas inte emot, varken från Enter eller
            // inklistring. Markören står kvar där den var.
            if (!fitsRows(accepted.current, el.value, bandCount)) {
              const caret = Math.max(
                0,
                el.selectionStart - (el.value.length - accepted.current.length),
              );
              el.value = accepted.current;
              el.setSelectionRange(caret, caret);
              return;
            }
            accepted.current = el.value;
            setOverflowing(el.scrollHeight > el.clientHeight + 1);
            onQuickText(cell.key, el.value);
          }}
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
    </div>
  );
}
