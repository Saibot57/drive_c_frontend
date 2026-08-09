/**
 * Geometri för en utbruten hjuldel.
 *
 * Temakalendern ritar varje tårtbit med `describeSector()` i hjulets eget
 * koordinatsystem, centrerat på `metrics.center`. En del som ska ligga för sig
 * själv på en workspace-yta behöver därför veta vilken bit av det systemet den
 * upptar — resten löser SVG:ns viewBox. Pathen skrivs alltså aldrig om; den
 * beskärs.
 *
 * Filen importerar från `themeWheelGeometry` men ändrar ingenting där. Schema
 * och Temakalendern står på de modulerna och används skarpt.
 */

import {
  Point,
  WheelMetrics,
  blockRadii,
  buildWheelMetrics,
  insetAngles,
  polar,
  weekSpanAngles,
  CHILD_INSET_PX,
} from '@/utils/themeWheelGeometry';
import type { BlockLane } from '@/utils/themeWheelLayout';
import type { WheelPartContent } from '../types/wheelPart.types';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Riktningarna där en båge vidrör sitt omslutande rätblock. I hjulets
 * koordinatsystem är 0° klockan tolv och vinkeln växer medurs, så bågen når
 * längst upp vid 0°, längst till höger vid 90°, och så vidare.
 */
const AXIS_DEGREES = [0, 90, 180, 270];

/**
 * Det omslutande rätblocket för en tårtbit.
 *
 * Att räkna på de fyra hörnen räcker inte: passerar bågen en av axlarna buktar
 * den utanför hörnen, och delen hade kapats där. Ytterbågens axelpunkter måste
 * därför läggas till.
 *
 * Innerbågen behöver däremot ingen egen kontroll. Varje punkt på den är samma
 * punkt som på ytterbågen fast skalad mot mitten, så i varje riktning där en
 * axel korsas ligger ytterbågens punkt alltid längre ut. Korsas ingen axel är
 * det hörnen som avgör, och de är redan med.
 */
export const sectorBoundingBox = (
  metrics: WheelMetrics,
  innerRadius: number,
  outerRadius: number,
  startDegrees: number,
  endDegrees: number,
): Box => {
  const points: Point[] = [
    polar(metrics, outerRadius, startDegrees),
    polar(metrics, outerRadius, endDegrees),
    polar(metrics, innerRadius, startDegrees),
    polar(metrics, innerRadius, endDegrees),
  ];

  AXIS_DEGREES.forEach((degrees) => {
    if (degrees >= startDegrees && degrees <= endDegrees) {
      points.push(polar(metrics, outerRadius, degrees));
    }
  });

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
};

/** Måtten som `WheelBlock` skulle ha ritat delen med, återskapade ur content. */
export const partMetrics = (content: WheelPartContent): WheelMetrics =>
  buildWheelMetrics(content.ringCount, new Set(content.ringsWithChildren));

/**
 * Vinkelspannet delen faktiskt ritas över. Ett delområde dras in i sidled så
 * att förälderns färg syns runt om det, precis som i hjulet.
 */
export const partAngles = (content: WheelPartContent, metrics: WheelMetrics) => {
  const shape = blockRadii(metrics, content.ring, content.lane as BlockLane);
  const span = weekSpanAngles(content.startWeek, content.endWeek, content.weekCount);
  const angles = content.lane === 'child'
    ? insetAngles(span, (shape.inner + shape.outer) / 2, CHILD_INSET_PX)
    : span;
  return { shape, ...angles };
};

/**
 * Luft runt delen i viewBox:en. Ramen ritas centrerad på kanten och skulle
 * annars kapas på mitten.
 */
export const PART_STROKE_PADDING = 4;

/** viewBox-strängen som beskär hjulet till just den här delen. */
export const partViewBox = (content: WheelPartContent): { viewBox: string; box: Box } => {
  const metrics = partMetrics(content);
  const { shape, start, end } = partAngles(content, metrics);
  const box = sectorBoundingBox(metrics, shape.inner, shape.outer, start, end);

  const pad = PART_STROKE_PADDING;
  return {
    box,
    viewBox: [
      (box.x - pad).toFixed(2),
      (box.y - pad).toFixed(2),
      (box.width + pad * 2).toFixed(2),
      (box.height + pad * 2).toFixed(2),
    ].join(' '),
  };
};

/** Under det här går en del inte att träffa med pekaren. */
export const MIN_PART_EXTENT = 72;

/**
 * Kortets mått. Delen behåller sina proportioner ur hjulet, så att en bred båge
 * ser bred ut och en smal remsa smal — annars tappar sprängningen kopplingen
 * till originalet. En riktigt tunn remsa skalas ändå upp tills den går att ta i.
 */
export const partCardSize = (box: Box): { width: number; height: number } => {
  const width = box.width + PART_STROKE_PADDING * 2;
  const height = box.height + PART_STROKE_PADDING * 2;
  const scale = Math.max(1, MIN_PART_EXTENT / Math.min(width, height));
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
};

/** Delens mittpunkt i hjulets koordinatsystem. Underlag för sprängningen. */
export const partCenter = (box: Box): Point => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});
