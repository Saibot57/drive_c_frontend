'use client';

import { ChevronLeft, ChevronRight, Cloud, CloudOff, Highlighter, Loader2 } from 'lucide-react';

import { FeatureNavigation } from '@/components/FeatureNavigation';
import type { HighlightColor } from '@/services/monthCalendarService';
import { MAX_BANDS, MIN_BANDS } from '@/config/monthCalendarConstants';
import { formatMonthTitle } from '@/utils/calendarDates';
import type { SaveStatus } from '@/hooks/useCalendarAutosave';
import HighlighterPalette from './HighlighterPalette';
import type { HighlighterMode } from './types';

interface Props {
  year: number;
  month: number;
  mode: HighlighterMode;
  activeColor: HighlightColor;
  bandCount: number;
  minBandCount: number;
  bandError: string | null;
  saveStatus: SaveStatus;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onToggleHighlighter: () => void;
  onColor: (c: HighlightColor) => void;
  onErase: () => void;
  onBandCount: (n: number) => void;
  onBandFocus: () => void;
}

export default function CalendarToolbar({
  year,
  month,
  mode,
  activeColor,
  bandCount,
  minBandCount,
  bandError,
  saveStatus,
  onPrev,
  onNext,
  onToday,
  onToggleHighlighter,
  onColor,
  onErase,
  onBandCount,
  onBandFocus,
}: Props) {
  const rowOptions = Array.from({ length: MAX_BANDS - MIN_BANDS + 1 }, (_, i) => MIN_BANDS + i);

  return (
    <header className="mc-toolbar">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2">
        <FeatureNavigation />

        <div className="flex items-center gap-1">
          <button type="button" className="mc-btn mc-btn--icon" onClick={onPrev} aria-label="Föregående månad">
            <ChevronLeft size={16} />
          </button>
          <h1 className="ui-heading min-w-[10.5rem] px-1 text-center text-lg leading-none tracking-wide">
            {formatMonthTitle(year, month)}
          </h1>
          <button type="button" className="mc-btn mc-btn--icon" onClick={onNext} aria-label="Nästa månad">
            <ChevronRight size={16} />
          </button>
          <button type="button" className="mc-btn ml-1" onClick={onToday}>
            Idag
          </button>
        </div>

        <button
          type="button"
          className={`mc-btn${mode !== 'off' ? ' mc-btn--active' : ''}`}
          onClick={onToggleHighlighter}
          aria-pressed={mode !== 'off'}
          title="Överstrykningspenna (Escape avslutar)"
        >
          <Highlighter size={14} />
          Markera
        </button>

        {/* Raderna är både textrader och överstrykningsband. */}
        <label
          className="flex items-center gap-1.5 text-xs font-semibold"
          title={
            minBandCount > MIN_BANDS
              ? `En dag har ${minBandCount} rader text. Ta bort rader där för att välja färre.`
              : undefined
          }
        >
          Rader
          <select
            className="mc-btn"
            value={bandCount}
            onFocus={onBandFocus}
            onChange={(e) => onBandCount(Number(e.target.value))}
            aria-label="Antal rader per dag"
            aria-describedby={bandError ? 'mc-band-error' : undefined}
          >
            {rowOptions.map((n) => (
              <option key={n} value={n} disabled={n < minBandCount && n !== bandCount}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {bandError && (
          <span id="mc-band-error" role="alert" className="text-xs font-semibold text-red-600 kron:text-ui-danger">
            {bandError}
          </span>
        )}

        {/* Sparstatus bor bara här, inte också i sidebaren. */}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-ui-muted" aria-live="polite">
          {saveStatus === 'saving' && (
            <>
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              Sparar…
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Cloud size={13} aria-hidden="true" />
              Sparat
            </>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 font-semibold text-red-600 kron:text-ui-danger">
              <CloudOff size={13} aria-hidden="true" />
              Ej sparat
            </span>
          )}
        </div>
      </div>

      {mode !== 'off' && (
        <div className="border-t border-black/10 bg-ui-paper px-4 py-2">
          <HighlighterPalette
            mode={mode}
            activeColor={activeColor}
            onColor={onColor}
            onErase={onErase}
          />
        </div>
      )}
    </header>
  );
}
