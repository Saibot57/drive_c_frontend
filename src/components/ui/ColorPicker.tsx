'use client';

import React from 'react';
import { useRecentColors } from '@/hooks/useRecentColors';
import { getReadableTextColor } from '@/utils/readableTextColor';

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  palette: readonly string[];
  /** Var de senast valda egna färgerna sparas. */
  recentStorageKey: string;
  maxRecent: number;
  /** Visar vilken textfärg som hamnar på färgen, för ytor som skriver text på den. */
  showTextPreview?: boolean;
};

/** Palett, egen färg och de senaste egna. Används av schemat och temakalendern. */
export function ColorPicker({
  value,
  onChange,
  palette,
  recentStorageKey,
  maxRecent,
  showTextPreview = false,
}: ColorPickerProps) {
  const { recentColors, rememberColor } = useRecentColors(recentStorageKey, maxRecent, palette);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {palette.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              aria-label={`Färg ${color}`}
              className={`h-6 w-6 rounded-full border border-black/40 ${value === color ? 'sp-swatch-ring' : ''}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-black/20 bg-white/70 px-2 py-1 text-xs text-gray-700 hover:bg-white">
          <span className="h-4 w-4 rounded-full border border-black" style={{ backgroundColor: value }} />
          Egen färg
          <input
            type="color"
            className="sr-only"
            aria-label="Välj egen färg"
            value={value}
            onChange={event => {
              onChange(event.target.value);
              rememberColor(event.target.value);
            }}
          />
        </label>
      </div>

      {recentColors.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Senaste:</span>
          {recentColors.map(color => (
            <button
              key={`recent-${color}`}
              type="button"
              onClick={() => onChange(color)}
              title="Senast använda"
              aria-label={`Senast använda färg ${color}`}
              className={`h-6 w-6 rounded-full border border-dashed border-black/40 ${value === color ? 'sp-swatch-ring' : ''}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}

      {showTextPreview && (
        <div
          className="rounded border-2 border-black px-3 py-1.5 text-sm font-bold"
          style={{ backgroundColor: value, color: getReadableTextColor(value) }}
        >
          Så här blir texten
        </div>
      )}
    </div>
  );
}
