'use client';

import { useMemo } from 'react';
import type { ThemeBlock } from '@/types/themeWheel';
import type { BlockLane, BlockPlacement } from '@/utils/themeWheelLayout';
import { fitFontSize, truncateToWidth } from '@/utils/themeWheelGeometry';
import { getMutedTextColor, getReadableTextColor } from '@/utils/readableTextColor';
import {
  COMMENT_FONT_SIZE,
  COMMENT_MIN_FONT_SIZE,
  COMMENT_MIN_RING_HEIGHT,
  TITLE_FONT_SIZE,
  TITLE_MIN_FONT_SIZE,
  WHEEL_FONT_STACK,
  WHEEL_STROKE,
  WHEEL_STROKE_WIDTH,
} from '@/components/theme-wheel/constants';
import { WheelBlock } from '@/components/theme-wheel/WheelBlock';
import type { WheelPartContent } from '../../types/wheelPart.types';
import {
  STRAIGHT_PX_PER_WEEK,
  partHolidayOffsets,
  partMetrics,
  partViewBox,
  partWeekLabel,
  partWeeks,
  straightSize,
} from '../../utils/wheelPartGeometry';

interface WheelPartViewerProps {
  content: WheelPartContent | null;
  /** Prefix för id:n i SVG:n, så att två delar på samma yta inte krockar. */
  elementId: string;
}

/**
 * En utbruten tårtbit ur en temakalender, krökt eller uträtad.
 *
 * Innehållet är en stickling och behöver varken hämtas eller kunna saknas, så
 * till skillnad från WheelRefViewer finns här inga tillstånd att hantera.
 */
export default function WheelPartViewer({ content, elementId }: WheelPartViewerProps) {
  if (!content) {
    return <div className="ws-wheel-part__state">Delen saknar innehåll.</div>;
  }

  return (
    <div className="ws-wheel-part">
      {/* pointer-events av: kortet ska gå att dra i, inte formen inuti det. */}
      <div className="ws-wheel-part__canvas">
        {content.straight
          ? <StraightPart content={content} elementId={elementId} />
          : <CurvedPart content={content} elementId={elementId} />}
      </div>

      {/*
        Härkomsten tar ingen plats i layouten. Kortet är måttsatt efter delens
        proportioner, och en rad text hade förvridit dem.
      */}
      <span className="ws-wheel-part__source">
        {content.sourceName}
        {formatCaptured(content.capturedAt) ? ` · ${formatCaptured(content.capturedAt)}` : ''}
      </span>
    </div>
  );
}

/**
 * Krökt läge: delen ritas av `WheelBlock` — samma komponent som hjulet självt
 * använder — inuti en SVG vars viewBox beskurits till bitens omslutande
 * rätblock. Pathen räknas alltså inte om, den kikas ut ur hjulets
 * koordinatsystem. Det är vad som garanterar att en del ser exakt likadan ut på
 * ytan som i hjulet, utan en andra ritrutin att hålla i synk.
 */
function CurvedPart({ content, elementId }: { content: WheelPartContent; elementId: string }) {
  const model = useMemo(() => {
    const block: ThemeBlock = {
      instanceId: content.instanceId,
      areaId: content.areaId,
      parentId: content.parentId,
      title: content.title,
      color: content.color,
      comment: content.comment,
      startWeek: content.startWeek,
      endWeek: content.endWeek,
      ring: content.ring,
      milestone: content.milestone,
    };

    const placement: BlockPlacement = {
      ring: content.ring,
      lane: content.lane as BlockLane,
      startWeek: content.startWeek,
      endWeek: content.endWeek,
    };

    return { metrics: partMetrics(content), viewBox: partViewBox(content).viewBox, block, placement };
  }, [content]);

  return (
    <svg
      viewBox={model.viewBox}
      fontFamily={WHEEL_FONT_STACK}
      className="ws-wheel-part__svg"
      role="img"
      aria-label={`${content.title}, ur ${content.sourceName}`}
    >
      {/* Alla pekarhanterare utelämnade — då är WheelBlock skrivskyddad. */}
      <WheelBlock
        block={model.block}
        placement={model.placement}
        weekCount={content.weekCount}
        metrics={model.metrics}
        idPrefix={elementId}
      />
    </svg>
  );
}

/** Luft mellan texten och stapelns kortsidor. */
const STRAIGHT_TEXT_PADDING = 12;

/**
 * Rakt läge: bandet uträtat till en stapel.
 *
 * Enklare att rita än den krökta formen — en rektangel och vanlig text, i
 * stället för en path och en `textPath` med vändlogik för hjulets nedre halva.
 * Veckoskiljare och lovskraffering hör hemma här och inte i hjulet: det är
 * först på en rak tidslinje man kan följa var i spannet man befinner sig.
 */
function StraightPart({ content, elementId }: { content: WheelPartContent; elementId: string }) {
  const { width, height } = straightSize(content);
  const weeks = partWeeks(content);
  const holidays = partHolidayOffsets(content);
  const weekLabel = partWeekLabel(content);

  const textColor = getReadableTextColor(content.color);
  const mutedColor = getMutedTextColor(content.color);
  const available = Math.max(width - STRAIGHT_TEXT_PADDING * 2, 0);

  const titleSize = fitFontSize(content.title, available, TITLE_FONT_SIZE, TITLE_MIN_FONT_SIZE);
  const title = truncateToWidth(content.title, titleSize, available);

  // Andra raden bär både veckospannet och kommentaren. Vilken som helst av dem
  // ensam duger, men de får inte konkurrera om samma rad utan avskiljare.
  const subtitleText = [weekLabel, content.comment?.trim() || null].filter(Boolean).join(' · ');
  const subtitleSize = fitFontSize(subtitleText, available, COMMENT_FONT_SIZE, COMMENT_MIN_FONT_SIZE);
  const showSubtitle = subtitleText.length > 0 && height >= COMMENT_MIN_RING_HEIGHT;
  const subtitle = showSubtitle ? truncateToWidth(subtitleText, subtitleSize, available) : '';

  const holidayId = `${elementId}-holiday`;
  const milestoneWeek = content.milestone?.week;
  const milestoneInSpan =
    typeof milestoneWeek === 'number' &&
    milestoneWeek >= content.startWeek &&
    milestoneWeek <= content.endWeek;

  const inset = WHEEL_STROKE_WIDTH / 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      fontFamily={WHEEL_FONT_STACK}
      className="ws-wheel-part__svg"
      role="img"
      aria-label={`${content.title}${weekLabel ? `, ${weekLabel}` : ''}, ur ${content.sourceName}`}
    >
      <defs>
        <pattern
          id={holidayId}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="7" stroke="#1a1a1a" strokeOpacity="0.18" strokeWidth="3" />
        </pattern>
      </defs>

      <rect
        x={inset}
        y={inset}
        width={Math.max(width - WHEEL_STROKE_WIDTH, 0)}
        height={Math.max(height - WHEEL_STROKE_WIDTH, 0)}
        fill={content.color}
        stroke={WHEEL_STROKE}
        strokeWidth={WHEEL_STROKE_WIDTH}
      >
        <title>{[content.title, weekLabel, content.comment].filter(Boolean).join('\n')}</title>
      </rect>

      {holidays.map((offset) => (
        <rect
          key={`holiday-${offset}`}
          x={offset * STRAIGHT_PX_PER_WEEK}
          y={inset}
          width={STRAIGHT_PX_PER_WEEK}
          height={Math.max(height - WHEEL_STROKE_WIDTH, 0)}
          fill={`url(#${holidayId})`}
          pointerEvents="none"
        />
      ))}

      {/* Veckoskiljare. Utan dem är stapeln bara en längd, inte ett spann. */}
      {Array.from({ length: Math.max(weeks - 1, 0) }, (_, i) => (
        <line
          key={`tick-${i}`}
          x1={(i + 1) * STRAIGHT_PX_PER_WEEK}
          y1={inset}
          x2={(i + 1) * STRAIGHT_PX_PER_WEEK}
          y2={height - inset}
          stroke="#1a1a1a"
          strokeOpacity="0.14"
          strokeWidth="1"
          pointerEvents="none"
        />
      ))}

      {title && (
        <text
          x={width / 2}
          y={height / 2}
          dy={subtitle ? -7 : 0}
          fontSize={titleSize}
          fontWeight={700}
          fill={textColor}
          textAnchor="middle"
          dominantBaseline="middle"
          pointerEvents="none"
        >
          {title}
        </text>
      )}

      {subtitle && (
        <text
          x={width / 2}
          y={height / 2}
          dy={7}
          fontSize={subtitleSize}
          fill={mutedColor}
          textAnchor="middle"
          dominantBaseline="middle"
          pointerEvents="none"
        >
          {subtitle}
        </text>
      )}

      {milestoneInSpan && typeof milestoneWeek === 'number' && (
        <circle
          cx={(milestoneWeek - content.startWeek + 0.5) * STRAIGHT_PX_PER_WEEK}
          cy={height - 7}
          r={4.5}
          fill={WHEEL_STROKE}
          stroke="#ffffff"
          strokeWidth={1.4}
          pointerEvents="none"
        >
          <title>{content.milestone?.label}</title>
        </circle>
      )}
    </svg>
  );
}

/** "9 aug" — hela datumet ligger i tooltipen på kortet. */
function formatCaptured(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}
