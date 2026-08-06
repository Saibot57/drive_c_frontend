'use client';

import React from 'react';
import {
  WheelMetrics,
  describeSector,
  describeTextArc,
  isFlippedAngle,
  polar,
  weekSpanAngles,
} from '@/utils/themeWheelGeometry';
import { WheelWeek } from '@/utils/themeWheelWeeks';
import {
  AXIS_DATE_FONT_SIZE,
  AXIS_FILL,
  AXIS_WEEK_FONT_SIZE,
  HOLIDAY_FILL,
  TODAY_STROKE,
  WHEEL_GUIDE_STROKE,
  WHEEL_STROKE,
  WHEEL_STROKE_WIDTH,
} from '@/components/theme-wheel/constants';

type WheelAxisProps = {
  weeks: WheelWeek[];
  holidayWeeks: number[];
  /** Hjulindex för dagens vecka, eller null när i dag ligger utanför hjulet. */
  todayIndex: number | null;
  metrics: WheelMetrics;
  idPrefix: string;
  onWeekClick?: (week: number) => void;
  onWeekContextMenu?: (event: React.MouseEvent, week: number) => void;
};

const LINE_OFFSET = 7;

export function WheelAxis({
  weeks,
  holidayWeeks,
  todayIndex,
  metrics,
  idPrefix,
  onWeekClick,
  onWeekContextMenu,
}: WheelAxisProps) {
  const holidays = new Set(holidayWeeks);
  const weekCount = weeks.length;
  const axisMidRadius = (metrics.axisInner + metrics.axisOuter) / 2;

  return (
    <g>
      {/* Bandets ytterkant, så att tomma ringar ändå avgränsas. */}
      <circle
        cx={metrics.center}
        cy={metrics.center}
        r={metrics.contentOuter}
        fill="none"
        stroke={WHEEL_GUIDE_STROKE}
        strokeWidth={1}
      />

      {weeks.map(week => {
        const { start, end } = weekSpanAngles(week.index, week.index, weekCount);
        const midAngle = (start + end) / 2;
        const flipped = isFlippedAngle(midAngle);
        const up = flipped ? -1 : 1;
        const isHoliday = holidays.has(week.index);
        const labelPathId = `${idPrefix}-axis-label-${week.index}`;
        const datePathId = `${idPrefix}-axis-date-${week.index}`;

        // Ekrarna markerar veckogränsen även där inga arbetsområden ligger.
        const spokeInner = polar(metrics, metrics.hubRadius, start);
        const spokeOuter = polar(metrics, metrics.contentOuter, start);

        return (
          <g key={week.index}>
            <line
              x1={spokeInner.x}
              y1={spokeInner.y}
              x2={spokeOuter.x}
              y2={spokeOuter.y}
              stroke={WHEEL_GUIDE_STROKE}
              strokeWidth={1}
            />
            <path
              d={describeSector(metrics, metrics.axisInner, metrics.axisOuter, start, end)}
              fill={isHoliday ? HOLIDAY_FILL : AXIS_FILL}
              stroke={WHEEL_STROKE}
              strokeWidth={week.index === todayIndex ? 2.4 : WHEEL_STROKE_WIDTH}
              style={{ cursor: onWeekClick ? 'pointer' : 'default' }}
              onClick={() => onWeekClick?.(week.index)}
              onContextMenu={event => {
                if (!onWeekContextMenu) return;
                event.preventDefault();
                onWeekContextMenu(event, week.index);
              }}
            >
              <title>
                {`${week.label} · ${week.dateLabel}${isHoliday ? ' · lov' : ''}${
                  onWeekClick ? '\nKlicka för att lägga till arbetsområde' : ''
                }`}
              </title>
            </path>

            <defs>
              <path
                id={labelPathId}
                d={describeTextArc(metrics, axisMidRadius + up * LINE_OFFSET, start, end, flipped)}
                fill="none"
              />
              <path
                id={datePathId}
                d={describeTextArc(metrics, axisMidRadius - up * (LINE_OFFSET + 1), start, end, flipped)}
                fill="none"
              />
            </defs>
            <text
              fontSize={AXIS_WEEK_FONT_SIZE}
              fontWeight={700}
              fill={isHoliday ? '#6b7280' : '#1a1a1a'}
              dominantBaseline="middle"
              pointerEvents="none"
            >
              <textPath href={`#${labelPathId}`} startOffset="50%" textAnchor="middle">
                {week.label}
              </textPath>
            </text>
            <text
              fontSize={AXIS_DATE_FONT_SIZE}
              fill="#6b7280"
              dominantBaseline="middle"
              pointerEvents="none"
            >
              <textPath href={`#${datePathId}`} startOffset="50%" textAnchor="middle">
                {isHoliday ? 'lov' : week.dateLabel}
              </textPath>
            </text>
          </g>
        );
      })}

      {todayIndex !== null && (() => {
        const { start, end } = weekSpanAngles(todayIndex, todayIndex, weekCount);
        const midAngle = (start + end) / 2;
        // Visaren stannar innanför ytterringen, annars skär den genom veckans
        // egen etikett.
        const from = polar(metrics, metrics.hubRadius - 10, midAngle);
        const to = polar(metrics, metrics.contentOuter + 6, midAngle);
        return (
          <g pointerEvents="none">
            {/* Vit understrykning gör visaren läsbar även över mörka färger. */}
            <line
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="#ffffff" strokeWidth={4} strokeLinecap="round" opacity={0.85}
            />
            <line
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={TODAY_STROKE} strokeWidth={1.6} strokeLinecap="round"
            />
            <circle cx={to.x} cy={to.y} r={4} fill={TODAY_STROKE} stroke="#ffffff" strokeWidth={1.4}>
              <title>I dag</title>
            </circle>
          </g>
        );
      })()}
    </g>
  );
}
