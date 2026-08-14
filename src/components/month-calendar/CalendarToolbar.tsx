'use client';

import { ChevronLeft, ChevronRight, Cloud, CloudOff, Highlighter, Loader2 } from 'lucide-react';

import { FeatureNavigation } from '@/components/FeatureNavigation';
import type { HighlightColor } from '@/services/monthCalendarService';
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
  saveStatus: SaveStatus;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onToggleHighlighter: () => void;
  onColor: (c: HighlightColor) => void;
  onErase: () => void;
  onBandCount: (n: number) => void;
}

export default function CalendarToolbar({
  year,
  month,
  mode,
  activeColor,
  bandCount,
  saveStatus,
  onPrev,
  onNext,
  onToday,
  onToggleHighlighter,
  onColor,
  onErase,
  onBandCount,
}: Props) {
  return (
    <header className="mc-toolbar">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2">
        <FeatureNavigation />

        <div className="flex items-center gap-1">
          <button type="button" className="mc-btn mc-btn--icon" onClick={onPrev} aria-label="Föregående månad">
            <ChevronLeft size={16} />
          </button>
          <h1 className="font-monument min-w-[10.5rem] px-1 text-center text-lg leading-none tracking-wide">
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

        {/* Sparstatus bor bara här, inte också i sidebaren. */}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500" aria-live="polite">
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
            <span className="flex items-center gap-1.5 font-semibold text-red-600">
              <CloudOff size={13} aria-hidden="true" />
              Ej sparat
            </span>
          )}
        </div>
      </div>

      {mode !== 'off' && (
        <div className="border-t border-black/10 bg-white px-4 py-2">
          <HighlighterPalette
            mode={mode}
            activeColor={activeColor}
            bandCount={bandCount}
            onColor={onColor}
            onErase={onErase}
            onBandCount={onBandCount}
          />
        </div>
      )}
    </header>
  );
}
