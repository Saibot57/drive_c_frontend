'use client';

import React, { useState } from 'react';
import { THEME_COLOR_PALETTE } from '@/config/themeDefaults';
import { useTheme } from '@/contexts/ThemeContext';
import { RotateCcw } from 'lucide-react';

interface Props {
  tokenKey: string;
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  onReset: () => void;
}

export default function ThemeColorPicker({ tokenKey, value, defaultValue, onChange, onReset }: Props) {
  const { recentColors, addRecentColor } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const isModified = value !== defaultValue;

  // Parse rgba/hex values to a hex for the color input
  const hexValue = toHex(value);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 group">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-6 h-6 rounded-full border-2 shrink-0 cursor-pointer"
          style={{
            backgroundColor: value,
            borderColor: 'var(--theme-border-color)',
          }}
          title={value}
        />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs truncate cursor-pointer hover:underline flex-1 text-left"
          style={{ color: 'var(--theme-text-primary)' }}
        >
          {hexValue || value}
        </button>
        {isModified && (
          <button
            onClick={(e) => { e.stopPropagation(); onReset(); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-100"
            title="Återställ till standard"
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 top-8 z-50 p-3 rounded-lg border-2 shadow-neo-sm w-[220px]"
          style={{
            backgroundColor: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-border-color)',
          }}
        >
          {/* Palette grid */}
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {THEME_COLOR_PALETTE.map(c => (
              <button
                key={c}
                onClick={() => { onChange(c); }}
                className={`w-7 h-7 rounded-full cursor-pointer border-2 transition-transform hover:scale-110 ${value === c ? 'ring-2 ring-black ring-offset-1' : ''}`}
                style={{
                  backgroundColor: c,
                  borderColor: c === '#ffffff' ? '#d1d5db' : 'transparent',
                }}
              />
            ))}
          </div>

          {/* Custom color input */}
          <label className="flex items-center gap-2 text-xs border rounded px-2 py-1.5 cursor-pointer hover:bg-gray-50"
            style={{ borderColor: 'var(--theme-border-subtle)' }}
          >
            <input
              type="color"
              className="w-5 h-5 cursor-pointer border-0 p-0"
              value={hexValue || '#000000'}
              onChange={(e) => {
                onChange(e.target.value);
                addRecentColor(e.target.value);
              }}
            />
            <span style={{ color: 'var(--theme-text-secondary)' }}>Egen färg...</span>
          </label>

          {/* Recent colors */}
          {recentColors.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-2xs" style={{ color: 'var(--theme-text-muted)' }}>Senaste:</span>
              {recentColors.slice(0, 6).map(c => (
                <button
                  key={`recent-${tokenKey}-${c}`}
                  onClick={() => onChange(c)}
                  className="w-5 h-5 rounded-full cursor-pointer border border-dashed"
                  style={{ backgroundColor: c, borderColor: 'var(--theme-border-subtle)' }}
                />
              ))}
            </div>
          )}

          <button
            onClick={() => setIsOpen(false)}
            className="mt-2 w-full text-2xs py-1 rounded border cursor-pointer hover:bg-gray-50"
            style={{ borderColor: 'var(--theme-border-subtle)', color: 'var(--theme-text-secondary)' }}
          >
            Stäng
          </button>
        </div>
      )}
    </div>
  );
}

/** Best-effort conversion of any CSS color value to hex for <input type="color"> */
function toHex(val: string): string {
  if (/^#[0-9a-f]{6}$/i.test(val)) return val;
  if (/^#[0-9a-f]{3}$/i.test(val)) {
    return '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
  }
  // Try to parse rgb/rgba
  const m = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const r = parseInt(m[1]).toString(16).padStart(2, '0');
    const g = parseInt(m[2]).toString(16).padStart(2, '0');
    const b = parseInt(m[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return val;
}
