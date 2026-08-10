'use client';

import { useEffect, useRef, useState } from 'react';
import type { HeadingContent, HeadingFont, HeadingLevel } from '../types/heading.types';
import {
  HEADING_COLORS,
  HEADING_DEFAULT_COLOR,
  HEADING_FONT_LABELS,
  HEADING_FONT_ORDER,
  HEADING_FONT_STACK,
  HEADING_RECENT_COLORS_KEY,
  HEADING_RECENT_COLORS_MAX,
} from '../types/constants';
import { resolveHeadingFont } from './editors/HeadingEditor';

const LEVELS: HeadingLevel[] = [1, 2, 3];

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HEADING_RECENT_COLORS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

function pushRecent(color: string): string[] {
  const next = [color, ...readRecent().filter((c) => c !== color)].slice(
    0,
    HEADING_RECENT_COLORS_MAX,
  );
  try {
    window.localStorage.setItem(HEADING_RECENT_COLORS_KEY, JSON.stringify(next));
  } catch {
    /* Privat läge eller full kvot — färgen fungerar ändå, den minns bara inte. */
  }
  return next;
}

interface HeadingToolbarProps {
  content: HeadingContent;
  onChange: (content: HeadingContent) => void;
}

export default function HeadingToolbar({ content, onChange }: HeadingToolbarProps) {
  const [colorOpen, setColorOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const colorRef = useRef<HTMLDivElement>(null);
  const activeFont = resolveHeadingFont(content);
  const activeColor = content.color ?? HEADING_DEFAULT_COLOR;

  useEffect(() => setRecent(readRecent()), []);

  useEffect(() => {
    if (!colorOpen) return;
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setColorOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorOpen]);

  const applyColor = (color: string, remember: boolean) => {
    onChange({ ...content, color });
    if (remember) setRecent(pushRecent(color));
  };

  return (
    <div
      className="ws-heading-bar"
      // Raden hör till redigeringen och ska inte med i en export.
      data-export="omit"
      // Klick i raden får varken markera om eller dra kortet.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {LEVELS.map((level) => (
        <button
          key={level}
          className={`ws-heading-bar__btn${content.level === level ? ' ws-heading-bar__btn--active' : ''}`}
          onClick={() => onChange({ ...content, level })}
          title={`Nivå ${level}`}
        >
          H{level}
        </button>
      ))}

      <span className="ws-heading-bar__sep" />

      {HEADING_FONT_ORDER.map((font: HeadingFont) => (
        <button
          key={font}
          className={`ws-heading-bar__btn${activeFont === font ? ' ws-heading-bar__btn--active' : ''}`}
          style={{ fontFamily: HEADING_FONT_STACK[font] }}
          onClick={() => onChange({ ...content, font })}
          title={HEADING_FONT_LABELS[font]}
        >
          Aa
        </button>
      ))}

      <span className="ws-heading-bar__sep" />

      <div className="ws-heading-bar__color" ref={colorRef}>
        <button
          className="ws-heading-bar__swatch"
          style={{ background: activeColor }}
          onClick={() => setColorOpen((open) => !open)}
          title="Färg"
        />

        {colorOpen && (
          <div className="ws-heading-palette">
            <div className="ws-heading-palette__grid">
              {HEADING_COLORS.map((color) => (
                <button
                  key={color}
                  className={`ws-heading-palette__dot${color === activeColor ? ' ws-heading-palette__dot--active' : ''}`}
                  style={{ background: color }}
                  onClick={() => applyColor(color, false)}
                  title={color}
                />
              ))}
            </div>

            {recent.length > 0 && (
              <>
                <div className="ws-heading-palette__label">Egna</div>
                <div className="ws-heading-palette__grid">
                  {recent.map((color) => (
                    <button
                      key={color}
                      className={`ws-heading-palette__dot${color === activeColor ? ' ws-heading-palette__dot--active' : ''}`}
                      style={{ background: color }}
                      onClick={() => applyColor(color, false)}
                      title={color}
                    />
                  ))}
                </div>
              </>
            )}

            <label className="ws-heading-palette__custom">
              Egen färg
              {/*
                onChange under dragningen i färgväljaren, men bara onBlur sparar
                i "Egna" — annars hade varje nyans man drog förbi hamnat i
                listan och trängt ut de sex man faktiskt använder.
              */}
              <input
                type="color"
                value={activeColor}
                onChange={(e) => applyColor(e.target.value, false)}
                onBlur={(e) => applyColor(e.target.value, true)}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
