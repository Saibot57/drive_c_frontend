'use client';

import { useMemo } from 'react';
import type { ThemeBlock } from '@/types/themeWheel';
import type { BlockLane, BlockPlacement } from '@/utils/themeWheelLayout';
import { fitFontSize, polar, truncateToWidth } from '@/utils/themeWheelGeometry';
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
import type { ProvenanceStatus } from '../../utils/provenance';
import {
  STRAIGHT_PX_PER_WEEK,
  partAngles,
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
  /** Markeringen ritas på formens kontur — kortet har ingen ram att bära den. */
  isSelected?: boolean;
  /** Ritas som en prick *på* bågen. Kortets hörn är tomt luftrum här. */
  provenance?: ProvenanceStatus;
}

/** Färgerna motsvarar .ws-provenance-dot i workspace.css. */
const PROVENANCE_FILL: Partial<Record<ProvenanceStatus, string>> = {
  drifted: '#fbbf24',
  missing: '#e11d48',
};

/** Prickens radie, i samma enheter som formen ritas i. */
const DOT_RADIUS = 6;

function ProvenanceDot({ x, y, status }: { x: number; y: number; status: ProvenanceStatus }) {
  const fill = PROVENANCE_FILL[status];
  if (!fill) return null;
  return (
    <circle
      cx={x}
      cy={y}
      r={DOT_RADIUS}
      fill={fill}
      stroke={WHEEL_STROKE}
      strokeWidth={1.5}
      pointerEvents="none"
      data-export="omit"
    >
      <title>
        {status === 'drifted'
          ? 'Källan har ändrats sedan det här hämtades. Högerklicka för att uppdatera.'
          : 'Källan finns inte längre.'}
      </title>
    </circle>
  );
}

/**
 * En utbruten tårtbit ur en temakalender, krökt eller uträtad.
 *
 * Innehållet är en stickling och behöver varken hämtas eller kunna saknas, så
 * till skillnad från WheelRefViewer finns här inga tillstånd att hantera.
 */
export default function WheelPartViewer({
  content,
  elementId,
  isSelected = false,
  provenance,
}: WheelPartViewerProps) {
  if (!content) {
    return <div className="ws-wheel-part__state">Delen saknar innehåll.</div>;
  }

  return (
    <div className="ws-wheel-part">
      {/*
        Kortet är genomskinligt och släpper igenom pekaren; formen fångar den i
        stället, och SVG träfftestar mot pathens fyllning. Hålet i en båge blir
        därför riktig tom yta — man kan lägga en lapp inuti kurvan och klicka på
        den. Draget överlever ändå, eftersom pointer-events inte påverkar
        bubbling: händelsen träffar bågen och bubblar upp till kortet.
      */}
      <div className="ws-wheel-part__canvas">
        {content.straight
          ? <StraightPart content={content} elementId={elementId} isSelected={isSelected} provenance={provenance} />
          : <CurvedPart content={content} elementId={elementId} isSelected={isSelected} provenance={provenance} />}
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
function CurvedPart({
  content,
  elementId,
  isSelected,
  provenance,
}: {
  content: WheelPartContent;
  elementId: string;
  isSelected: boolean;
  provenance?: ProvenanceStatus;
}) {
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

    const metrics = partMetrics(content);
    const { shape, start, end } = partAngles(content, metrics);
    // Pricken sitter mitt på bandet, strax innanför ytterkanten. Där finns det
    // alltid färg att sitta på, oavsett hur bred eller smal tårtbiten är.
    const dot = polar(metrics, shape.outer - DOT_RADIUS - 3, (start + end) / 2);

    return { metrics, viewBox: partViewBox(content).viewBox, block, placement, dot };
  }, [content]);

  return (
    <svg
      viewBox={model.viewBox}
      fontFamily={WHEEL_FONT_STACK}
      className="ws-wheel-part__svg"
      role="img"
      aria-label={`${content.title}, ur ${content.sourceName}`}
    >
      {/*
        Alla pekarhanterare utelämnade — då är WheelBlock skrivskyddad.
        isSelected tjocknar konturen, vilket är markeringen nu när kortet inte
        har någon ram att bära den på.
      */}
      <WheelBlock
        block={model.block}
        placement={model.placement}
        weekCount={content.weekCount}
        metrics={model.metrics}
        idPrefix={elementId}
        isSelected={isSelected}
      />
      {provenance && <ProvenanceDot x={model.dot.x} y={model.dot.y} status={provenance} />}
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
function StraightPart({
  content,
  elementId,
  isSelected,
  provenance,
}: {
  content: WheelPartContent;
  elementId: string;
  isSelected: boolean;
  provenance?: ProvenanceStatus;
}) {
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
        strokeWidth={isSelected ? 2.6 : WHEEL_STROKE_WIDTH}
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

      {provenance && (
        <ProvenanceDot x={width - DOT_RADIUS - 3} y={DOT_RADIUS + 3} status={provenance} />
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
