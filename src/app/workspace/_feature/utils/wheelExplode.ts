/**
 * Ett temahjul omvandlat till enskilda delar.
 *
 * Två lägen, som medvetet är skilda åt i stället för att det ena är en knapp på
 * det andra:
 *
 *   spräng  — delarna behåller sin krökta form och kastas ut från mitten.
 *   rulla ut — delarna rätas ut och läggs på en tidslinje, veckor åt höger och
 *              ringar nedåt. Terminen läst linjärt i stället för cykliskt.
 *
 * Ett "räta ut alla" på en yta man redan möblerat hade flyttat kort användaren
 * själv placerat, och det är samma övergrepp som en levande koppling gör.
 *
 * Ren funktion: hjul in, ritfärdiga delar ut. Den anropar temakalenderns egna
 * layoutfunktioner men ändrar inget i dem.
 */

import type { ThemeWheel } from '@/types/themeWheel';
import { buildRingLayout } from '@/utils/themeWheelLayout';
import { Point, buildWheelMetrics } from '@/utils/themeWheelGeometry';
import type { WheelPartContent } from '../types/wheelPart.types';
import {
  partCardSize,
  partCenter,
  partViewBox,
  straightSize,
  unrollOffset,
} from './wheelPartGeometry';

export type WheelPartMode = 'explode' | 'unroll';

export interface WheelPartDraft {
  content: WheelPartContent;
  size: { width: number; height: number };
  /** Kortets övre vänstra hörn, relativt satsens egen nollpunkt. */
  offset: Point;
}

/** Satsens sammanlagda yta, för att kunna centrera den i vyn. */
export const partsBounds = (drafts: WheelPartDraft[]) => {
  const xs = drafts.map((d) => d.offset.x);
  const ys = drafts.map((d) => d.offset.y);
  const right = drafts.map((d) => d.offset.x + d.size.width);
  const bottom = drafts.map((d) => d.offset.y + d.size.height);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...right) - x, height: Math.max(...bottom) - y };
};

/**
 * Hur långt delarna kastas ut från mitten vid en sprängning. 1 hade lagt
 * tillbaka hjulet exakt som det var — varje del ligger ju kvar i sin egen ruta
 * ur originalet — så faktorn är det som gör sprängningen synlig. Runt 1,35 ger
 * tydliga glapp utan att formen slutar läsas som ett hjul.
 */
export const EXPLODE_SPREAD = 1.35;

export const buildWheelParts = (
  wheel: ThemeWheel,
  mode: WheelPartMode = 'explode',
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
      wheelStartWeek: wheel.startWeek,
      wheelStartYear: wheel.startYear,
      ringCount,
      ringsWithChildren: ringsWithChildrenList,
      holidayWeeks: wheel.holidayWeeks ?? [],

      straight: mode === 'unroll',
    };

    if (mode === 'unroll') {
      drafts.push({ content, size: straightSize(content), offset: unrollOffset(content) });
      return;
    }

    const { box } = partViewBox(content);
    const center = partCenter(box);
    const size = partCardSize(box);

    drafts.push({
      content,
      size,
      offset: {
        x: (center.x - metrics.center) * EXPLODE_SPREAD - size.width / 2,
        y: (center.y - metrics.center) * EXPLODE_SPREAD - size.height / 2,
      },
    });
  });

  // Delområdena sist. Placeringarna får z-index i den ordning de skickas, och
  // ett delområde ligger inuti sin förälders band — hamnar det under försvinner
  // det. Samma regel som ThemeWheel följer när den ritar childBlocks efter
  // parentBlocks.
  return drafts.sort((a, b) => Number(Boolean(a.content.parentId)) - Number(Boolean(b.content.parentId)));
};
