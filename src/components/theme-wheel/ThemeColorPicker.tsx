'use client';

import React, { useCallback, useState } from 'react';
import {
  MAX_RECENT_CUSTOM_COLORS,
  THEME_AREA_PALETTE,
  THEME_WHEEL_RECENT_COLORS_KEY,
} from '@/components/theme-wheel/constants';
import { getReadableTextColor } from '@/utils/readableTextColor';

type ThemeColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

const loadRecentColors = (): string[] => {
  try {
    const raw = localStorage.getItem(THEME_WHEEL_RECENT_COLORS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Samma färgväljare som schemaplanerarens: palett, egen färg och de senaste
 * egna. Här visas dessutom vilken textfärg som hamnar på färgen, eftersom
 * hjulet skriver namnet direkt i tårtbiten.
 */
export function ThemeColorPicker({ value, onChange }: ThemeColorPickerProps) {
  const [recentColors, setRecentColors] = useState<string[]>(loadRecentColors);

  const saveRecentColor = useCallback((color: string) => {
    const paletteSet = new Set(THEME_AREA_PALETTE as readonly string[]);
    if (paletteSet.has(color)) return;
    setRecentColors(prev => {
      const updated = [color, ...prev.filter(c => c !== color)].slice(0, MAX_RECENT_CUSTOM_COLORS);
      try {
        localStorage.setItem(THEME_WHEEL_RECENT_COLORS_KEY, JSON.stringify(updated));
      } catch {
        // Ingen lagring tillgänglig – färgen fungerar ändå, den minns bara inte.
      }
      return updated;
    });
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {THEME_AREA_PALETTE.map(color => (
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
              saveRecentColor(event.target.value);
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

      <div
        className="rounded border-2 border-black px-3 py-1.5 text-sm font-bold"
        style={{ backgroundColor: value, color: getReadableTextColor(value) }}
      >
        Så här blir texten
      </div>
    </div>
  );
}
