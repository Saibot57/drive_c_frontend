'use client';

import { useMemo } from 'react';
import type { ThemeBlock } from '@/types/themeWheel';
import type { BlockLane, BlockPlacement } from '@/utils/themeWheelLayout';
import { WHEEL_FONT_STACK } from '@/components/theme-wheel/constants';
import { WheelBlock } from '@/components/theme-wheel/WheelBlock';
import type { WheelPartContent } from '../../types/wheelPart.types';
import { partMetrics, partViewBox } from '../../utils/wheelPartGeometry';

interface WheelPartViewerProps {
  content: WheelPartContent | null;
  /** Prefix för textbanornas id, så att två delar på samma yta inte krockar. */
  elementId: string;
}

/**
 * En utbruten tårtbit ur en temakalender.
 *
 * Delen ritas av `WheelBlock` — samma komponent som hjulet självt använder —
 * inuti en SVG vars viewBox är beskuren till just den här bitens omslutande
 * rätblock. Pathen räknas alltså inte om; den kikas ut ur hjulets
 * koordinatsystem. Det är också vad som garanterar att en del ser exakt likadan
 * ut på ytan som den gjorde i hjulet, utan en andra ritrutin att hålla i synk.
 *
 * Till skillnad från WheelRefViewer finns här inga tillstånd att hantera:
 * innehållet är en stickling och behöver varken hämtas eller kunna saknas.
 */
export default function WheelPartViewer({ content, elementId }: WheelPartViewerProps) {
  const model = useMemo(() => {
    if (!content) return null;

    const metrics = partMetrics(content);
    const { viewBox } = partViewBox(content);

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

    return { metrics, viewBox, block, placement };
  }, [content]);

  if (!content || !model) {
    return <div className="ws-wheel-part__state">Delen saknar innehåll.</div>;
  }

  const captured = formatCaptured(content.capturedAt);

  return (
    <div className="ws-wheel-part">
      {/* pointer-events av: kortet ska gå att dra i, inte bågen inuti det. */}
      <div className="ws-wheel-part__canvas">
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
      </div>

      {/*
        Härkomsten tar ingen plats i layouten. Kortet är måttsatt efter delens
        proportioner ur hjulet, och en rad text hade förvridit dem.
      */}
      <span className="ws-wheel-part__source">
        {content.sourceName}
        {captured ? ` · ${captured}` : ''}
      </span>
    </div>
  );
}

/** "9 aug" — hela datumet ligger i tooltipen på kortet. */
function formatCaptured(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}
