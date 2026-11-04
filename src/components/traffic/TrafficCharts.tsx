'use client';

import React, { useEffect, useRef, useState } from 'react';
import { axisTicks, formatCount } from '@/utils/traffic';

export type BarSeries<T> = { key: keyof T & string; name: string; color: string };

type BarChartProps<T> = {
  rows: T[];
  series: BarSeries<T>[];
  label: (row: T) => string;
  /** Hovringstext för en stapelgrupp, en rad per serie läggs till. */
  title: (row: T) => string;
  /** Rita en röd prick över gruppen. */
  marker?: (row: T) => boolean;
  /** Ungefärlig bredd i px som en etikett behöver; fler etiketter hoppas över när det är trångt. */
  labelWidth?: number;
  height?: number;
};

const LEFT = 40;
const BOTTOM = 22;
const TOP = 14;

/** Elementets bredd i px, uppdaterad när kortet ändrar storlek. */
function useWidth<E extends HTMLElement>(): [React.RefObject<E>, number] {
  const ref = useRef<E>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/**
 * Staplar sida vid sida, ritade i SVG i kortets verkliga bredd, så att
 * texten har samma storlek på telefon och dator.
 */
export function BarChart<T>({ rows, series, label, title, marker, labelWidth = 40, height = 220 }: BarChartProps<T>) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const WIDTH = Math.max(240, measured);
  const value = (row: T, key: keyof T) => Number(row[key]) || 0;
  const ticks = axisTicks(Math.max(1, ...rows.flatMap(r => series.map(s => value(r, s.key)))));
  const max = ticks[ticks.length - 1];
  const plotH = height - TOP - BOTTOM;
  const y = (v: number) => TOP + plotH - (v / max) * plotH;
  const band = (WIDTH - LEFT) / Math.max(1, rows.length);
  const inner = band * 0.75;
  const barW = inner / series.length;
  const labelEvery = Math.max(1, Math.ceil(labelWidth / band));

  return (
    <div ref={ref} style={{ minHeight: height }}>
      {measured > 0 && (
        <svg viewBox={`0 0 ${WIDTH} ${height}`} width={WIDTH} height={height} role="img" className="block text-ui-muted">
          {ticks.map(t => (
            <g key={t}>
              <line x1={LEFT} x2={WIDTH} y1={y(t)} y2={y(t)} stroke="var(--ui-hair)" strokeWidth={1} />
              <text x={LEFT - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="currentColor">{formatCount(t)}</text>
            </g>
          ))}
          {rows.map((row, i) => {
            const x0 = LEFT + i * band + (band - inner) / 2;
            const top = Math.min(...series.map(s => y(value(row, s.key))));
            return (
              <g key={i}>
                <title>{[title(row), ...series.map(s => `${s.name}: ${formatCount(value(row, s.key))}`)].join('\n')}</title>
                <rect x={LEFT + i * band} y={TOP} width={band} height={plotH} fill="transparent" />
                {series.map((s, j) => {
                  const v = value(row, s.key);
                  return (
                    <rect
                      key={s.key}
                      x={x0 + j * barW + 1}
                      y={y(v)}
                      width={Math.max(1, barW - 2)}
                      height={Math.max(0, TOP + plotH - y(v))}
                      rx={Math.min(3, barW / 2)}
                      fill={s.color}
                    />
                  );
                })}
                {marker?.(row) && <circle cx={x0 + inner / 2} cy={top - 8} r={4} fill="var(--ui-danger)" />}
                {i % labelEvery === 0 && (
                  <text
                    x={Math.min(x0 + inner / 2, WIDTH - labelWidth / 2)}
                    y={height - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fill="currentColor"
                  >
                    {label(row)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** Liggande staplar för kategorier, med värdet bredvid. Den största får accentfärgen. */
export function HorizontalBars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  if (rows.length === 0) return <p className="text-sm text-ui-muted">Inget under perioden.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((row, i) => (
        <li key={row.label} className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-2 text-sm">
          <span className="truncate">{row.label}</span>
          <span className="h-4 rounded-ui-sm bg-ui-surface-3">
            <span
              className="block h-full rounded-ui-sm"
              style={{ width: `${(row.value / max) * 100}%`, background: i === 0 ? 'var(--ui-accent)' : 'var(--ui-muted)' }}
            />
          </span>
          <span className="text-right tabular-nums text-ui-muted">{formatCount(row.value)}</span>
        </li>
      ))}
    </ul>
  );
}
