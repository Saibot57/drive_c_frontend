'use client';

import React, { forwardRef, useMemo } from 'react';
import { ThemeBlock, ThemeWheel as ThemeWheelData } from '@/types/themeWheel';
import { BlockPlacement, buildRingLayout } from '@/utils/themeWheelLayout';
import { buildWheelWeeks, currentWheelIndex } from '@/utils/themeWheelWeeks';
import {
  buildWheelMetrics,
  describeSector,
  ringRadii,
  truncateToWidth,
  weekSpanAngles,
} from '@/utils/themeWheelGeometry';
import { WheelPreview } from '@/hooks/useWheelInteraction';
import { WHEEL_FONT_STACK, WHEEL_STROKE } from '@/components/theme-wheel/constants';
import { WheelAxis } from '@/components/theme-wheel/WheelAxis';
import { WheelBlock } from '@/components/theme-wheel/WheelBlock';

type ThemeWheelProps = {
  wheel: ThemeWheelData;
  className?: string;
  /** Injicerbar för test och för att kunna förhandsgranska en annan vecka. */
  today?: Date;
  selectedInstanceId?: string | null;
  preview?: WheelPreview | null;
  onBlockPointerDown?: (event: React.PointerEvent, block: ThemeBlock, placement: BlockPlacement) => void;
  onBlockResizeStart?: (event: React.PointerEvent, block: ThemeBlock, placement: BlockPlacement, edge: 'start' | 'end') => void;
  onSelectBlock?: (block: ThemeBlock) => void;
  onOpenBlockEditor?: (block: ThemeBlock) => void;
  onBlockContextMenu?: (event: React.MouseEvent, block: ThemeBlock) => void;
  onEmptyCellClick?: (week: number, ring: number) => void;
  onWeekClick?: (week: number) => void;
  onWeekContextMenu?: (event: React.MouseEvent, week: number) => void;
  onBackgroundClick?: () => void;
};

export const ThemeWheel = forwardRef<SVGSVGElement, ThemeWheelProps>(function ThemeWheel({
  wheel,
  className = '',
  today,
  selectedInstanceId = null,
  preview = null,
  onBlockPointerDown,
  onBlockResizeStart,
  onSelectBlock,
  onOpenBlockEditor,
  onBlockContextMenu,
  onEmptyCellClick,
  onWeekClick,
  onWeekContextMenu,
  onBackgroundClick,
}, ref) {
  const weeks = useMemo(
    () => buildWheelWeeks(wheel.startWeek, wheel.startYear, wheel.weekCount),
    [wheel.startWeek, wheel.startYear, wheel.weekCount]
  );

  const { placementByBlock, ringCount } = useMemo(
    () => buildRingLayout(wheel.blocks, wheel.weekCount),
    [wheel.blocks, wheel.weekCount]
  );

  const metrics = useMemo(() => buildWheelMetrics(ringCount), [ringCount]);
  const todayIndex = useMemo(() => currentWheelIndex(weeks, today), [weeks, today]);

  /** Lediga rutor att klicka på. Beräknas ur samma placeringar som ritas. */
  const emptyCells = useMemo(() => {
    const occupied = new Set<string>();
    placementByBlock.forEach(placement => {
      for (let week = placement.startWeek; week <= placement.endWeek; week++) {
        occupied.add(`${week}:${placement.ring}`);
      }
    });

    const cells: { week: number; ring: number }[] = [];
    for (let week = 0; week < wheel.weekCount; week++) {
      for (let ring = 0; ring < ringCount; ring++) {
        if (!occupied.has(`${week}:${ring}`)) cells.push({ week, ring });
      }
    }
    return cells;
  }, [placementByBlock, ringCount, wheel.weekCount]);

  const previewSector = useMemo(() => {
    if (!preview) return null;
    const { start, end } = weekSpanAngles(preview.startWeek, preview.endWeek, wheel.weekCount);
    // Dras något ut i en ny ring finns den inte i metrics ännu; rita den
    // direkt utanför den yttersta befintliga i stället.
    const ring = Math.min(preview.ring, metrics.ringCount - 1);
    const isNewRing = preview.ring >= metrics.ringCount;
    const { inner, outer } = ringRadii(metrics, ring);
    const shift = isNewRing ? metrics.ringHeight : 0;
    return describeSector(metrics, inner + shift, outer + shift, start, end);
  }, [metrics, preview, wheel.weekCount]);

  const firstWeek = weeks[0];
  const lastWeek = weeks[weeks.length - 1];
  const spanLabel = firstWeek && lastWeek ? `${firstWeek.label}–${lastWeek.label}` : '';
  const hubTitle = truncateToWidth(wheel.name, 15, metrics.hubRadius * 1.6);

  return (
    <svg
      ref={ref}
      id="theme-wheel-canvas"
      viewBox={`0 0 ${metrics.size} ${metrics.size}`}
      fontFamily={WHEEL_FONT_STACK}
      className={`w-full h-auto touch-none select-none ${className}`}
      role="img"
      aria-label={`Temakalender ${wheel.name}, ${spanLabel}`}
      onClick={event => {
        if (event.target === event.currentTarget) onBackgroundClick?.();
      }}
    >
      <WheelAxis
        weeks={weeks}
        holidayWeeks={wheel.holidayWeeks}
        todayIndex={todayIndex}
        metrics={metrics}
        idPrefix={wheel.id}
        onWeekClick={onWeekClick}
        onWeekContextMenu={onWeekContextMenu}
      />

      {onEmptyCellClick && emptyCells.map(cell => {
        const { start, end } = weekSpanAngles(cell.week, cell.week, wheel.weekCount);
        const { inner, outer } = ringRadii(metrics, cell.ring);
        return (
          <path
            key={`empty-${cell.week}-${cell.ring}`}
            d={describeSector(metrics, inner, outer, start, end)}
            fill="transparent"
            className="theme-wheel-empty-cell"
            style={{ cursor: 'copy' }}
            data-export="omit"
            onClick={() => onEmptyCellClick(cell.week, cell.ring)}
          >
            <title>Klicka för att lägga till ett arbetsområde</title>
          </path>
        );
      })}

      {wheel.blocks.map(block => {
        const placement = placementByBlock.get(block.instanceId);
        if (!placement) return null;
        return (
          <WheelBlock
            key={block.instanceId}
            block={block}
            placement={placement}
            weekCount={wheel.weekCount}
            metrics={metrics}
            idPrefix={wheel.id}
            isSelected={selectedInstanceId === block.instanceId}
            isDimmed={Boolean(preview) && selectedInstanceId === block.instanceId}
            onPointerDownBody={onBlockPointerDown}
            onResizeStart={onBlockResizeStart}
            onSelect={onSelectBlock}
            onOpenEditor={onOpenBlockEditor}
            onContextMenu={onBlockContextMenu}
          />
        );
      })}

      {previewSector && preview && (
        <path
          d={previewSector}
          fill={preview.color}
          fillOpacity={0.75}
          stroke={WHEEL_STROKE}
          strokeWidth={2}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      )}

      {/* Navet ritas sist så att idag-visaren inte skär genom rubriken. */}
      <circle
        cx={metrics.center}
        cy={metrics.center}
        r={metrics.hubRadius - 6}
        fill="#ffffff"
        stroke={WHEEL_STROKE}
        strokeWidth={2}
      />
      <text
        x={metrics.center}
        y={metrics.center - 8}
        fontSize={15}
        fontWeight={700}
        fill="#1a1a1a"
        textAnchor="middle"
        dominantBaseline="middle"
        pointerEvents="none"
      >
        {hubTitle}
      </text>
      <text
        x={metrics.center}
        y={metrics.center + 12}
        fontSize={11.5}
        fill="#6b7280"
        textAnchor="middle"
        dominantBaseline="middle"
        pointerEvents="none"
      >
        {spanLabel}
      </text>
    </svg>
  );
});
