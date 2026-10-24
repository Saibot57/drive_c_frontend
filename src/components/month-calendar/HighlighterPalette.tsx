'use client';

import { Check, Eraser } from 'lucide-react';

import type { HighlightColor } from '@/services/monthCalendarService';
import { HIGHLIGHT_PALETTE } from '@/config/monthCalendarConstants';
import type { HighlighterMode } from './types';

interface Props {
  mode: HighlighterMode;
  activeColor: HighlightColor;
  onColor: (c: HighlightColor) => void;
  onErase: () => void;
}

export default function HighlighterPalette({
  mode,
  activeColor,
  onColor,
  onErase,
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
    </div>
  );
}
