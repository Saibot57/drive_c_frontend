'use client';

import React, { useState } from 'react';
import { formatHours, Slice } from '@/utils/termPlanner';

/**
 * Ett ringdiagram med förklaring, för andelar av en helhet.
 *
 * Följer dataviz-skillens regler: bitarna skiljs av en 2 px lucka i ytans färg
 * (ingen kantlinje), texten står i textfärg bredvid en färgruta och aldrig i
 * bitens färg, och varje värde står utskrivet i förklaringen — hovringen visar
 * bara samma sak tydligare. Den som anropar ser till att bitarna är få
 * (`foldSlices`).
 */

type Props = {
  title: React.ReactNode;
  slices: Slice[];
  size?: number;
};

const SURFACE = '#ffffff';

/** Punkt på cirkeln, med vinkeln räknad medurs från klockan tolv. */
const polar = (c: number, radius: number, angle: number) =>
  [c + radius * Math.sin(angle), c - radius * Math.cos(angle)] as const;

const arcPath = (c: number, outer: number, inner: number, start: number, end: number) => {
  const large = end - start > Math.PI ? 1 : 0;
  const [x0, y0] = polar(c, outer, start);
  const [x1, y1] = polar(c, outer, end);
  const [x2, y2] = polar(c, inner, end);
  const [x3, y3] = polar(c, inner, start);
  return `M${x0} ${y0} A${outer} ${outer} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${inner} ${inner} 0 ${large} 0 ${x3} ${y3} Z`;
};

const formatPercent = (share: number) => {
  const percent = share * 100;
  if (percent > 0 && percent < 1) return '<1 %';
  return `${Math.round(percent)} %`;
};

export function DonutChart({ title, slices, size = 136 }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.minutes, 0);

  const c = size / 2;
  const outer = c - 1;
  const inner = outer * 0.6;
  const activeSlice = slices.find(slice => slice.key === active) ?? null;

  let angle = 0;
  const arcs = slices.map(slice => {
    const start = angle;
    angle += (slice.minutes / total) * Math.PI * 2;
    return { slice, start, end: angle };
  });

  const markProps = (slice: Slice) => ({
    fill: slice.color,
    stroke: SURFACE,
    strokeWidth: 2,
    strokeLinejoin: 'round' as const,
    opacity: active && active !== slice.key ? 0.35 : 1,
    tabIndex: 0,
    className: 'cursor-default outline-none transition-opacity focus-visible:opacity-100',
    onPointerEnter: () => setActive(slice.key),
    onPointerLeave: () => setActive(null),
    onFocus: () => setActive(slice.key),
    onBlur: () => setActive(null),
    'aria-label': `${slice.label}: ${formatHours(slice.minutes)} timmar, ${formatPercent(slice.minutes / total)}`,
  });

  return (
    <figure className="flex min-w-0 flex-col items-center gap-3">
      <figcaption className="w-full truncate text-center text-sm font-semibold">{title}</figcaption>

      {total <= 0 ? (
        <div
          className="flex items-center justify-center rounded-full border-2 border-dashed border-gray-200 text-xs text-gray-400"
          style={{ width: size, height: size }}
        >
          Ingen tid
        </div>
      ) : (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="group" aria-label="Fördelning">
          {arcs.length === 1 ? (
            // En hel ring går inte att rita som en båge från ett varv till samma punkt.
            <circle
              cx={c}
              cy={c}
              r={(outer + inner) / 2}
              {...markProps(arcs[0].slice)}
              fill="none"
              stroke={arcs[0].slice.color}
              strokeWidth={outer - inner}
            >
              <title>{arcs[0].slice.label}</title>
            </circle>
          ) : arcs.map(({ slice, start, end }) => (
            <path key={slice.key} d={arcPath(c, outer, inner, start, end)} {...markProps(slice)}>
              <title>{slice.label}</title>
            </path>
          ))}

          <text x={c} y={c - 2} textAnchor="middle" className="fill-black text-[15px] font-bold tabular-nums">
            {formatHours(activeSlice ? activeSlice.minutes : total)} h
          </text>
          <text x={c} y={c + 14} textAnchor="middle" className="fill-gray-500 text-[10px]">
            {activeSlice ? formatPercent(activeSlice.minutes / total) : 'totalt'}
          </text>
        </svg>
      )}

      {total > 0 && (
        <ul className="w-full space-y-0.5 text-xs">
          {slices.map(slice => (
            <li
              key={slice.key}
              className={`flex items-center gap-2 rounded px-1 py-0.5 ${active === slice.key ? 'bg-gray-100' : ''}`}
              onPointerEnter={() => setActive(slice.key)}
              onPointerLeave={() => setActive(null)}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: slice.color }} />
              <span className="min-w-0 flex-1 truncate" title={slice.label}>{slice.label}</span>
              <span className="tabular-nums">{formatHours(slice.minutes)} h</span>
              <span className="w-9 text-right tabular-nums text-gray-500">{formatPercent(slice.minutes / total)}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
