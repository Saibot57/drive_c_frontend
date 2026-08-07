'use client';

import React, { forwardRef, useMemo } from 'react';
import { ThemeBlock, ThemeWheel as ThemeWheelData } from '@/types/themeWheel';
import { BlockPlacement, buildRingLayout, hostBlockAt } from '@/utils/themeWheelLayout';
import { buildWheelWeeks, currentWheelIndex } from '@/utils/themeWheelWeeks';
import {
  CHILD_INSET_PX,
  blockRadii,
  buildWheelMetrics,
  describeSector,
  insetAngles,
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
  /** parentId satt = rutan ligger i ett arbetsområdes yttre lana, alltså ett delområde. */
  onEmptyCellClick?: (week: number, ring: number, parentId?: string) => void;
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

  const { placementByBlock, ringCount, ringsWithChildren } = useMemo(
    () => buildRingLayout(wheel.blocks, wheel.weekCount),
    [wheel.blocks, wheel.weekCount]
  );

  const metrics = useMemo(
    () => buildWheelMetrics(ringCount, ringsWithChildren),
    [ringCount, ringsWithChildren]
  );
  const todayIndex = useMemo(() => currentWheelIndex(weeks, today), [weeks, today]);

  /**
   * Lediga rutor att klicka på. Två sorter: hela ringar där inget arbetsområde
   * ligger, och veckorna inuti ett arbetsområde som redan har delområden – där
   * skapar ett klick ett nytt delområde.
   */
  const emptyCells = useMemo(() => {
    const occupied = new Set<string>();
    const childWeeks = new Set<string>();

    wheel.blocks.forEach(block => {
      const placement = placementByBlock.get(block.instanceId);
      if (!placement) return;
      for (let week = placement.startWeek; week <= placement.endWeek; week++) {
        if (placement.lane === 'child') childWeeks.add(`${block.parentId}:${week}`);
        else occupied.add(`${week}:${placement.ring}`);
      }
    });

    const cells: {
      week: number;
      ring: number;
      lane: 'full' | 'child';
      /** Arbetsområdet rutan ligger inuti. Bara satt för delområdesrutor. */
      host?: ThemeBlock;
      hostPlacement?: BlockPlacement;
    }[] = [];

    for (let week = 0; week < wheel.weekCount; week++) {
      for (let ring = 0; ring < ringCount; ring++) {
        if (!occupied.has(`${week}:${ring}`)) cells.push({ week, ring, lane: 'full' });
      }
    }

    wheel.blocks.forEach(block => {
      const placement = placementByBlock.get(block.instanceId);
      if (!placement || placement.lane !== 'parent') return;
      for (let week = placement.startWeek; week <= placement.endWeek; week++) {
        if (childWeeks.has(`${block.instanceId}:${week}`)) continue;
        cells.push({
          week,
          ring: placement.ring,
          lane: 'child',
          host: block,
          hostPlacement: placement,
        });
      }
    });

    return cells;
  }, [placementByBlock, ringCount, wheel.blocks, wheel.weekCount]);

  /**
   * Arbetsområdet ett släpp skulle hamna inuti. Ett block som redan är ett
   * arbetsområde blir inte ett delområde av att flyttas – det trycks ut i en
   * egen ring – så för det ritas spöket i full bandhöjd.
   */
  const previewHost = useMemo(() => {
    if (!preview) return null;
    const dragged = preview.instanceId
      ? wheel.blocks.find(block => block.instanceId === preview.instanceId) ?? null
      : null;
    if (dragged && !dragged.parentId) return null;
    return hostBlockAt(
      wheel.blocks, placementByBlock, preview.ring, preview.startWeek, preview.instanceId
    );
  }, [placementByBlock, preview, wheel.blocks]);

  const previewSector = useMemo(() => {
    if (!preview) return null;
    // Dras något ut i en ny ring finns den inte i metrics ännu; rita den
    // direkt utanför den yttersta befintliga i stället.
    const ring = Math.min(preview.ring, metrics.ringCount - 1);
    const isNewRing = preview.ring >= metrics.ringCount;
    const shift = isNewRing ? metrics.baseRingHeight : 0;

    const lane = previewHost && !isNewRing ? 'child' : 'full';
    const { inner, outer } = blockRadii(metrics, ring, lane);
    const span = weekSpanAngles(preview.startWeek, preview.endWeek, wheel.weekCount);
    const { start, end } = lane === 'child'
      ? insetAngles(span, (inner + outer) / 2, CHILD_INSET_PX)
      : span;

    return describeSector(metrics, inner + shift, outer + shift, start, end);
  }, [metrics, preview, previewHost, wheel.weekCount]);

  /**
   * Delområdena ritas efter arbetsområdena. De ligger inuti sin förälders band
   * och skulle annars målas över av det – och i SVG är det översta lagret också
   * det som tar emot klick.
   */
  const { parentBlocks, childBlocks } = useMemo(() => {
    const parents: { block: ThemeBlock; placement: BlockPlacement }[] = [];
    const children: { block: ThemeBlock; placement: BlockPlacement }[] = [];
    wheel.blocks.forEach(block => {
      const placement = placementByBlock.get(block.instanceId);
      if (!placement) return;
      (placement.lane === 'child' ? children : parents).push({ block, placement });
    });
    return { parentBlocks: parents, childBlocks: children };
  }, [placementByBlock, wheel.blocks]);

  const renderBlock = ({ block, placement }: { block: ThemeBlock; placement: BlockPlacement }) => (
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

      {parentBlocks.map(renderBlock)}

      {onEmptyCellClick && emptyCells.map(cell => {
        const { inner, outer } = blockRadii(metrics, cell.ring, cell.lane);
        const span = weekSpanAngles(cell.week, cell.week, wheel.weekCount);
        const { start, end } = cell.lane === 'child'
          ? insetAngles(span, (inner + outer) / 2, CHILD_INSET_PX)
          : span;
        return (
          <path
            key={`empty-${cell.lane}-${cell.host?.instanceId ?? ''}-${cell.week}-${cell.ring}`}
            d={describeSector(metrics, inner, outer, start, end)}
            fill="transparent"
            className="theme-wheel-empty-cell"
            style={{ cursor: 'copy' }}
            data-export="omit"
            onClick={() => onEmptyCellClick(cell.week, cell.ring, cell.host?.instanceId)}
            // Rutan ligger ovanpå arbetsområdet och skulle annars äta upp
            // greppet om det. Ett drag härifrån flyttar alltså bandet, medan
            // ett klick utan rörelse lägger till ett delområde.
            onPointerDown={cell.host && cell.hostPlacement
              ? event => onBlockPointerDown?.(event, cell.host!, cell.hostPlacement!)
              : undefined}
          >
            <title>
              {cell.host
                ? 'Klicka för att lägga till ett delområde'
                : 'Klicka för att lägga till ett arbetsområde'}
            </title>
          </path>
        );
      })}

      {childBlocks.map(renderBlock)}

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
