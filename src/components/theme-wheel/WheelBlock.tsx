'use client';

import React from 'react';
import { ThemeBlock } from '@/types/themeWheel';
import { BlockPlacement } from '@/utils/themeWheelLayout';
import {
  CHILD_INSET_PX,
  WheelMetrics,
  arcLength,
  blockRadii,
  describeSector,
  describeTextArc,
  fitFontSize,
  insetAngles,
  isFlippedAngle,
  polar,
  radialTextRotation,
  textRadii,
  truncateToWidth,
  weekSpanAngles,
} from '@/utils/themeWheelGeometry';
import { getMutedTextColor, getReadableTextColor } from '@/utils/readableTextColor';
import {
  COMMENT_FONT_SIZE,
  COMMENT_MIN_FONT_SIZE,
  COMMENT_MIN_RING_HEIGHT,
  TEXT_MIN_EXTENT,
  TITLE_FONT_SIZE,
  TITLE_MIN_FONT_SIZE,
  WHEEL_STROKE,
  WHEEL_STROKE_WIDTH,
} from '@/components/theme-wheel/constants';

type WheelBlockProps = {
  block: ThemeBlock;
  /** Ring och beskuret veckospann från buildRingLayout(). */
  placement: BlockPlacement;
  weekCount: number;
  metrics: WheelMetrics;
  /** Prefix för textbanornas id, så att två hjul på samma sida inte krockar. */
  idPrefix: string;
  isSelected?: boolean;
  /** Blocket dras just nu – förhandsvisningen visar var det hamnar. */
  isDimmed?: boolean;
  onPointerDownBody?: (event: React.PointerEvent, block: ThemeBlock, placement: BlockPlacement) => void;
  onResizeStart?: (event: React.PointerEvent, block: ThemeBlock, placement: BlockPlacement, edge: 'start' | 'end') => void;
  onSelect?: (block: ThemeBlock) => void;
  onOpenEditor?: (block: ThemeBlock) => void;
  onContextMenu?: (event: React.MouseEvent, block: ThemeBlock) => void;
};

/** Avstånd från blockets mittlinje till titel- respektive kommentarraden. */
const LINE_OFFSET = 8;
/** Längs bågen behövs luft mot grannen i sidled. */
const ARC_TEXT_PADDING = 10;
/** Radiellt begränsas texten bara av ringens egna kanter, så det räcker mindre. */
const RADIAL_TEXT_PADDING = 6;
const HANDLE_RADIUS = 6.5;

export function WheelBlock({
  block,
  placement,
  weekCount,
  metrics,
  idPrefix,
  isSelected = false,
  isDimmed = false,
  onPointerDownBody,
  onResizeStart,
  onSelect,
  onOpenEditor,
  onContextMenu,
}: WheelBlockProps) {
  // Ytan blocket fyller och ytan dess text får använda är inte samma sak: ett
  // arbetsområde med delområden fyller hela bandet men skriver bara på raden
  // innerst, eftersom delområdena ritas över resten.
  const shape = blockRadii(metrics, placement.ring, placement.lane);
  const label = textRadii(metrics, placement.ring, placement.lane);
  const span = weekSpanAngles(placement.startWeek, placement.endWeek, weekCount);
  const { start, end } = placement.lane === 'child'
    ? insetAngles(span, (shape.inner + shape.outer) / 2, CHILD_INSET_PX)
    : span;

  const midAngle = (start + end) / 2;
  const midRadius = (label.inner + label.outer) / 2;
  const textHeight = label.outer - label.inner;
  const spanDegrees = end - start;

  const textColor = getReadableTextColor(block.color);
  const mutedColor = getMutedTextColor(block.color);
  const commentText = block.comment?.trim() ?? '';
  const showComment = commentText.length > 0 && textHeight >= COMMENT_MIN_RING_HEIGHT;

  // Välj den riktning som ger mest plats: längs bågen för breda spann, radiellt
  // ut från mitten när tårtbiten är högre än den är bred.
  const curvedWidth = arcLength(midRadius, spanDegrees) - ARC_TEXT_PADDING;
  const radialWidth = textHeight - RADIAL_TEXT_PADDING;
  const useArcText = curvedWidth >= radialWidth;
  const availableWidth = Math.max(useArcText ? curvedWidth : radialWidth, 0);
  const hasRoomForText = Math.max(curvedWidth, radialWidth) >= TEXT_MIN_EXTENT;

  // Krymp texten först, kapa bara när den fortfarande inte får plats.
  const titleFontSize = fitFontSize(block.title, availableWidth, TITLE_FONT_SIZE, TITLE_MIN_FONT_SIZE);
  const title = truncateToWidth(block.title, titleFontSize, availableWidth);
  const commentFontSize = fitFontSize(commentText, availableWidth, COMMENT_FONT_SIZE, COMMENT_MIN_FONT_SIZE);
  const comment = showComment
    ? truncateToWidth(commentText, commentFontSize, availableWidth)
    : '';

  const flipped = isFlippedAngle(midAngle);
  // Glyfernas uppåtriktning pekar utåt i övre halvan och inåt i den nedre, så
  // vilken radie som ligger "ovanför" beror på om bågen är vänd.
  const up = flipped ? -1 : 1;
  const titleRadius = comment ? midRadius + up * LINE_OFFSET : midRadius;
  const commentRadius = midRadius - up * (LINE_OFFSET + 1);

  const titlePathId = `${idPrefix}-title-${block.instanceId}`;
  const commentPathId = `${idPrefix}-comment-${block.instanceId}`;

  const milestoneLabel = block.milestone
    ? `${block.milestone.label}${block.milestone.date ? ` (${block.milestone.date})` : ''}`
    : null;
  const tooltip = [block.title, commentText || null, milestoneLabel]
    .filter(Boolean)
    .join('\n');

  // Milstolpen ritas i sin egen vecka, inte i mitten av blocket, så att den
  // visar var i spannet inlämningen eller provet ligger. Den läggs strax utanför
  // textraden: ett arbetsområde med delområden har bara raden innerst, och där
  // hamnar prickens plats i luften mellan raden och delområdena – synlig, och
  // utan att lägga sig ovanpå namnet.
  const milestoneRadius = placement.lane === 'parent'
    ? label.outer + CHILD_INSET_PX / 2
    : label.outer - 8;
  const milestoneWeek = block.milestone?.week;
  const milestoneInSpan = typeof milestoneWeek === 'number'
    && milestoneWeek >= placement.startWeek
    && milestoneWeek <= placement.endWeek;
  let milestonePoint: { x: number; y: number } | null = null;
  if (milestoneInSpan && typeof milestoneWeek === 'number') {
    const weekAngles = weekSpanAngles(milestoneWeek, milestoneWeek, weekCount);
    milestonePoint = polar(metrics, milestoneRadius, (weekAngles.start + weekAngles.end) / 2);
  }

  const radialAnchor = polar(metrics, midRadius, midAngle);
  const startHandle = polar(metrics, midRadius, start);
  const endHandle = polar(metrics, midRadius, end);

  return (
    <g data-instance-id={block.instanceId} opacity={isDimmed ? 0.35 : 1}>
      <path
        d={describeSector(metrics, shape.inner, shape.outer, start, end)}
        fill={block.color}
        stroke={WHEEL_STROKE}
        strokeWidth={isSelected ? 2.6 : WHEEL_STROKE_WIDTH}
        data-export={isSelected ? 'selected' : undefined}
        style={{ cursor: onPointerDownBody ? 'grab' : 'default' }}
        onPointerDown={event => onPointerDownBody?.(event, block, placement)}
        onClick={() => onSelect?.(block)}
        onDoubleClick={() => onOpenEditor?.(block)}
        onContextMenu={event => {
          event.preventDefault();
          onContextMenu?.(event, block);
        }}
      >
        <title>{tooltip}</title>
      </path>

      {hasRoomForText && title && (
        useArcText ? (
          <>
            <defs>
              <path
                id={titlePathId}
                d={describeTextArc(metrics, titleRadius, start, end, flipped)}
                fill="none"
              />
              {comment && (
                <path
                  id={commentPathId}
                  d={describeTextArc(metrics, commentRadius, start, end, flipped)}
                  fill="none"
                />
              )}
            </defs>
            <text
              fontSize={titleFontSize}
              fontWeight={700}
              fill={textColor}
              dominantBaseline="middle"
              pointerEvents="none"
            >
              <textPath href={`#${titlePathId}`} startOffset="50%" textAnchor="middle">
                {title}
              </textPath>
            </text>
            {comment && (
              <text
                fontSize={commentFontSize}
                fill={mutedColor}
                dominantBaseline="middle"
                pointerEvents="none"
              >
                <textPath href={`#${commentPathId}`} startOffset="50%" textAnchor="middle">
                  {comment}
                </textPath>
              </text>
            )}
          </>
        ) : (
          <g
            transform={`translate(${radialAnchor.x.toFixed(2)},${radialAnchor.y.toFixed(2)}) rotate(${radialTextRotation(midAngle).toFixed(2)})`}
            pointerEvents="none"
          >
            <text
              fontSize={titleFontSize}
              fontWeight={700}
              fill={textColor}
              textAnchor="middle"
              dominantBaseline="middle"
              dy={comment ? -7 : 0}
            >
              {title}
            </text>
            {comment && (
              <text
                fontSize={commentFontSize}
                fill={mutedColor}
                textAnchor="middle"
                dominantBaseline="middle"
                dy={7}
              >
                {comment}
              </text>
            )}
          </g>
        )
      )}

      {milestonePoint && (
        <circle
          cx={milestonePoint.x}
          cy={milestonePoint.y}
          r={4.5}
          fill={WHEEL_STROKE}
          stroke="#ffffff"
          strokeWidth={1.4}
          pointerEvents="none"
        />
      )}

      {/* Handtagen dyker upp först när blocket är valt, annars skymmer de
          grannarna i ett tätt hjul. */}
      {isSelected && onResizeStart && (
        <>
          <circle
            cx={startHandle.x}
            cy={startHandle.y}
            r={HANDLE_RADIUS}
            fill="#ffffff"
            stroke={WHEEL_STROKE}
            strokeWidth={2}
            style={{ cursor: 'ew-resize' }}
            data-export="omit"
            onPointerDown={event => onResizeStart(event, block, placement, 'start')}
          >
            <title>Dra för att ändra startvecka</title>
          </circle>
          <circle
            cx={endHandle.x}
            cy={endHandle.y}
            r={HANDLE_RADIUS}
            fill="#ffffff"
            stroke={WHEEL_STROKE}
            strokeWidth={2}
            style={{ cursor: 'ew-resize' }}
            data-export="omit"
            onPointerDown={event => onResizeStart(event, block, placement, 'end')}
          >
            <title>Dra för att ändra slutvecka</title>
          </circle>
        </>
      )}
    </g>
  );
}
