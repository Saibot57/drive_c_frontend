'use client';

import { Check, Eraser } from 'lucide-react';

import type { HighlightColor } from '@/services/monthCalendarService';
import { HIGHLIGHT_PALETTE, MAX_BANDS, MIN_BANDS } from './constants';
import type { HighlighterMode } from './types';

interface Props {
  mode: HighlighterMode;
  activeColor: HighlightColor;
  bandCount: number;
  onColor: (c: HighlightColor) => void;
  onErase: () => void;
  onBandCount: (n: number) => void;
}

export default function HighlighterPalette({
  mode,
  activeColor,
  bandCount,
  onColor,
  onErase,
  onBandCount,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Överstrykning">
      {HIGHLIGHT_PALETTE.map(({ key, hex, label }) => {
        const active = mode === 'paint' && activeColor === key;
        return (
          <button
            key={key}
            type="button"
            className={`mc-swatch${active ? ' mc-swatch--active' : ''}`}
            style={{ backgroundColor: hex }}
            onClick={() => onColor(key)}
            aria-label={label}
            aria-pressed={active}
            title={label}
          >
            {/* Färgen får inte vara enda statusbäraren för vilket verktyg som är valt. */}
            {active && (
              <Check
                size={12}
                strokeWidth={3}
                className="absolute inset-0 m-auto text-black"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}

      <button
        type="button"
        className={`mc-btn${mode === 'erase' ? ' mc-btn--active' : ''}`}
        onClick={onErase}
        aria-pressed={mode === 'erase'}
        title="Sudda markering"
      >
        <Eraser size={14} />
        Sudda
      </button>

      <label className="ml-1 flex items-center gap-1 text-xs font-semibold">
        Band
        <select
          className="mc-btn"
          value={bandCount}
          onChange={(e) => onBandCount(Number(e.target.value))}
          aria-label="Antal band per dag"
        >
          {Array.from({ length: MAX_BANDS - MIN_BANDS + 1 }, (_, i) => MIN_BANDS + i).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
