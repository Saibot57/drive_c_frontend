'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { MINDMAP_COLOR_MENU_KEY, MINDMAP_PALETTE_ROWS } from '@/config/mindmapPalette';
import { usePersistentState } from '@/hooks/usePersistentState';
import { MINDMAP_COLORS, MINDMAP_COLOR_LABELS } from '@/types/mindmap';
import { MINDMAP_SHADINGS, type MindmapShading } from '@/types/mindmapDoc';
import {
  isPaintChoice,
  sanitizeRecentColors,
  SHADING_LABELS,
  type MindmapPaintChoice,
} from '@/utils/mindmapPaint';

interface MindmapColorMenuProps {
  /** Den markerade nodens sparade färg. */
  current: MindmapPaintChoice | null;
  shading: MindmapShading;
  /** `wholeBranch`: färgen sätts på noden och grenen under den. */
  onColor: (choice: MindmapPaintChoice | null, wholeBranch: boolean) => void;
  onShading: (shading: MindmapShading) => void;
  /**
   * De senaste egna färgerna. Ägs av verktygsraden, som står kvar när menyn
   * stängs: menyn stängs i samma klick som färgen sparas.
   */
  recentColors: readonly string[];
  rememberColor: (hex: string) => void;
}

const sanitizeOpen = (raw: unknown): boolean => raw === true;

/**
 * Färgmenyn i verktygsraden (docs/plans/mindmap-farger.md, del B): de sex
 * fasta färgerna, "Fler färger" med paletten, egen färg och de senaste, och
 * nyanserna nedåt för kartan.
 */
export function MindmapColorMenu({ current, shading, onColor, onShading, recentColors, rememberColor }: MindmapColorMenuProps) {
  const [wholeBranch, setWholeBranch] = useState(false);
  const [more, setMore] = usePersistentState(MINDMAP_COLOR_MENU_KEY, sanitizeOpen, false);
  const recent = sanitizeRecentColors(recentColors);

  // Färgväljaren sätter färgen när den stängs ("change"), inte för varje
  // rörelse i den ("input"); annars blev varje rörelse ett ångra-steg.
  const pickerRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(current && 'customColor' in current ? current.customColor : '#2563eb');
  const latest = useRef({ onColor, wholeBranch, rememberColor });
  latest.current = { onColor, wholeBranch, rememberColor };
  useEffect(() => {
    const input = pickerRef.current;
    if (!input) return undefined;
    const apply = () => {
      const hex = input.value.toLowerCase();
      latest.current.rememberColor(hex);
      latest.current.onColor({ customColor: hex }, latest.current.wholeBranch);
    };
    input.addEventListener('change', apply);
    return () => input.removeEventListener('change', apply);
  }, [more]);

  const customSwatch = (hex: string, label: string, recentSwatch = false) => {
    const choice = { customColor: hex };
    return (
      <button
        key={`${recentSwatch ? 'r' : 'p'}${hex}`}
        type="button"
        className={`mm__swatch mm__swatch--custom${recentSwatch ? ' mm__swatch--recent' : ''}`}
        style={{ '--mm-swatch': hex } as React.CSSProperties}
        aria-pressed={isPaintChoice(current, choice)}
        onClick={() => onColor(choice, wholeBranch)}
        title={label}
        aria-label={label}
      />
    );
  };

  return (
    <div className="mm__popover mm__color-menu">
      <div className="mm__swatches">
        {MINDMAP_COLORS.map((color, index) => (
          <button
            key={color}
            type="button"
            className={`mm__swatch mm__swatch--${color}`}
            aria-pressed={isPaintChoice(current, { color })}
            onClick={() => onColor({ color }, wholeBranch)}
            title={`${MINDMAP_COLOR_LABELS[color]} (Alt+${index + 1})`}
            aria-label={MINDMAP_COLOR_LABELS[color]}
          />
        ))}
        <button type="button" className="mm__swatch mm__swatch--none" onClick={() => onColor(null, wholeBranch)} title="Ingen färg (Alt+0)" aria-label="Ingen färg">
          <X size={11} />
        </button>
      </div>
      <label className="mm__swatch-option">
        <input type="checkbox" checked={wholeBranch} onChange={(e) => setWholeBranch(e.target.checked)} />
        Hela grenen
      </label>

      <button type="button" className="mm__color-more" aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Fler färger
      </button>
      {more && (
        <div className="mm__color-extra">
          {MINDMAP_PALETTE_ROWS.map((row, index) => (
            <div key={index} className="mm__swatches mm__swatches--grid">
              {row.map((color) => customSwatch(color.hex, color.label))}
            </div>
          ))}
          {recent.length > 0 && (
            <div className="mm__color-recent">
              <span className="mm__color-caption">Senaste</span>
              <div className="mm__swatches mm__swatches--tight">
                {recent.map((hex) => customSwatch(hex, `Senast använda ${hex}`, true))}
              </div>
            </div>
          )}
          <label className="mm__color-pick">
            <span className="mm__swatch mm__swatch--custom" style={{ '--mm-swatch': draft } as React.CSSProperties} aria-hidden="true" />
            Egen färg …
            <input
              ref={pickerRef}
              type="color"
              className="sr-only"
              aria-label="Välj egen färg"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="mm__color-shading" role="group" aria-label="Nyanser nedåt i grenen">
        <span className="mm__color-caption">Nyanser nedåt</span>
        <div className="mm__segmented">
          {MINDMAP_SHADINGS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={shading === value}
              onClick={() => onShading(value)}
            >
              {SHADING_LABELS[value]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
