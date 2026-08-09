/**
 * Sprängning av ett temahjul till enskilda delar.
 *
 * Ren funktion: hjul in, ritfärdiga delar ut. Den anropar temakalenderns egna
 * layoutfunktioner men ändrar inget i dem.
 */

import type { ThemeWheel } from '@/types/themeWheel';
import { buildRingLayout } from '@/utils/themeWheelLayout';
import { Point, buildWheelMetrics } from '@/utils/themeWheelGeometry';
import type { WheelPartContent } from '../types/wheelPart.types';
import { partCardSize, partCenter, partViewBox } from './wheelPartGeometry';

export interface WheelPartDraft {
  content: WheelPartContent;
  size: { width: number; height: number };
  /** Förskjutning från hjulets mitt, redan utspridd. */
  offset: Point;
}

/**
 * Hur långt delarna kastas ut från mitten. 1 hade lagt tillbaka hjulet exakt
 * som det var — varje del ligger ju kvar i sin egen ruta ur originalet — så
 * faktorn är det som gör sprängningen synlig. Runt 1,35 ger tydliga glapp utan
 * att formen slutar läsas som ett hjul.
 */
export const EXPLODE_SPREAD = 1.35;

export const buildWheelParts = (
  wheel: ThemeWheel,
  capturedAt: string = new Date().toISOString(),
): WheelPartDraft[] => {
  const { placementByBlock, ringCount, ringsWithChildren } = buildRingLayout(
    wheel.blocks,
    wheel.weekCount,
  );
  const metrics = buildWheelMetrics(ringCount, ringsWithChildren);
  const ringsWithChildrenList = Array.from(ringsWithChildren).sort((a, b) => a - b);

  const drafts: WheelPartDraft[] = [];

  wheel.blocks.forEach((block) => {
    // Block som hamnar helt utanför hjulet saknas i mappen. De ritas inte i
    // hjulet heller, så de ska inte brytas ut.
    const placement = placementByBlock.get(block.instanceId);
    if (!placement) return;

    const content: WheelPartContent = {
      wheelId: wheel.id,
      instanceId: block.instanceId,
      sourceName: wheel.name,
      capturedAt,

      title: block.title,
      color: block.color,
      comment: block.comment,
      parentId: block.parentId,
      areaId: block.areaId,
      milestone: block.milestone,

      // Placeringen tas från layouten, inte från blocket: spannet där är redan
      // beskuret till hjulet och till en eventuell förälder, och ringen är den
      // som faktiskt användes.
      startWeek: placement.startWeek,
      endWeek: placement.endWeek,
      ring: placement.ring,
      lane: placement.lane,
      weekCount: wheel.weekCount,
      ringCount,
      ringsWithChildren: ringsWithChildrenList,
      holidayWeeks: wheel.holidayWeeks ?? [],

      straight: false,
    };

    const { box } = partViewBox(content);
    const center = partCenter(box);

    drafts.push({
      content,
      size: partCardSize(box),
      offset: {
        x: (center.x - metrics.center) * EXPLODE_SPREAD,
        y: (center.y - metrics.center) * EXPLODE_SPREAD,
      },
    });
  });

  return drafts;
};
