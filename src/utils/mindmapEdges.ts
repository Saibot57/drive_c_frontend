import type { MindmapAnchor, MindmapEdgeShape } from '@/types/mindmap';

/*
 * Linjernas form på Mindmap-sidan: var en linje fäster på en nod och hur den
 * går mellan ändarna. En linje är en lista med ritkommandon, som både SVG på
 * skärmen och Canvas i bilden ritar, så att bilden blir det man ser.
 *
 * Planen: docs/plans/mindmap-placering.md, del A.
 */

export interface EdgePoint {
  x: number;
  y: number;
}

export interface EdgeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RouteCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; c1x: number; c1y: number; c2x: number; c2y: number; x: number; y: number };

export type EdgeRoute = RouteCommand[];

const horizontal = (side: MindmapAnchor) => side === 'left' || side === 'right';

/** Mitten av rutans sida. */
export function anchorPoint(box: EdgeBox, side: MindmapAnchor): EdgePoint {
  switch (side) {
    case 'top':
      return { x: box.x + box.width / 2, y: box.y };
    case 'bottom':
      return { x: box.x + box.width / 2, y: box.y + box.height };
    case 'left':
      return { x: box.x, y: box.y + box.height / 2 };
    default:
      return { x: box.x + box.width, y: box.y + box.height / 2 };
  }
}

/**
 * De sidor av två rutor som vetter mot varandra. Står rutorna isär i x-led
 * blir det höger och vänster; layouten lägger alltid ett barn `hGap` från
 * föräldern, så en orörd karta fäster som förut. Överlappar de i x-led (en
 * nod rakt ovanför eller under en annan) blir det upp och ned.
 */
export function nearestSides(from: EdgeBox, to: EdgeBox): { from: MindmapAnchor; to: MindmapAnchor } {
  if (from.x + from.width <= to.x) return { from: 'right', to: 'left' };
  if (to.x + to.width <= from.x) return { from: 'left', to: 'right' };
  const below = to.y + to.height / 2 >= from.y + from.height / 2;
  return below ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' };
}

export interface RouteInput {
  start: EdgePoint;
  startSide: MindmapAnchor;
  end: EdgePoint;
  endSide: MindmapAnchor;
  shape: MindmapEdgeShape;
}

/**
 * Linjen mellan två ändar.
 *
 * - Kurva: varje styrpunkt ligger ut från sin ände längs sidans riktning,
 *   halvvägs mot den andra änden i den ledden. Höger mot vänster blir exakt
 *   kurvan som `edgePath` ritar.
 * - Rak: en rak linje.
 * - Vinklad: rätvinkliga sträckor, ut från startsidan och in i ändsidan.
 */
export function routeEdge({ start, startSide, end, endSide, shape }: RouteInput): EdgeRoute {
  const move: RouteCommand = { type: 'M', x: start.x, y: start.y };
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const startH = horizontal(startSide);
  const endH = horizontal(endSide);

  if (shape === 'straight') return [move, { type: 'L', x: end.x, y: end.y }];

  if (shape === 'elbow') {
    let corners: EdgePoint[];
    if (startH && endH) corners = [{ x: midX, y: start.y }, { x: midX, y: end.y }];
    else if (!startH && !endH) corners = [{ x: start.x, y: midY }, { x: end.x, y: midY }];
    else if (startH) corners = [{ x: end.x, y: start.y }];
    else corners = [{ x: start.x, y: end.y }];
    return [move, ...corners.map((p): RouteCommand => ({ type: 'L', x: p.x, y: p.y })), { type: 'L', x: end.x, y: end.y }];
  }

  const c1 = startH ? { x: midX, y: start.y } : { x: start.x, y: midY };
  const c2 = endH ? { x: midX, y: end.y } : { x: end.x, y: midY };
  return [move, { type: 'C', c1x: c1.x, c1y: c1.y, c2x: c2.x, c2y: c2.y, x: end.x, y: end.y }];
}

/** Linjen som SVG-väg, i samma form som `edgePath`. */
export function routeToSvg(route: EdgeRoute): string {
  return route
    .map((cmd) => {
      if (cmd.type === 'C') return `C ${cmd.c1x} ${cmd.c1y}, ${cmd.c2x} ${cmd.c2y}, ${cmd.x} ${cmd.y}`;
      return `${cmd.type} ${cmd.x} ${cmd.y}`;
    })
    .join(' ');
}

/** Ritar linjen som en ny väg på Canvas; anroparen stryker den. */
export function traceRoute(ctx: Pick<CanvasRenderingContext2D, 'moveTo' | 'lineTo' | 'bezierCurveTo'>, route: EdgeRoute): void {
  route.forEach((cmd) => {
    if (cmd.type === 'M') ctx.moveTo(cmd.x, cmd.y);
    else if (cmd.type === 'L') ctx.lineTo(cmd.x, cmd.y);
    else ctx.bezierCurveTo(cmd.c1x, cmd.c1y, cmd.c2x, cmd.c2y, cmd.x, cmd.y);
  });
}

/* ── Del C: fästen som väljs, och tvärlänkarnas pilar och etikett ── */

/** Mitten av rutans sida, `gap` px utanför den. */
export function anchorPointOut(box: EdgeBox, side: MindmapAnchor, gap: number): EdgePoint {
  const p = anchorPoint(box, side);
  if (side === 'top') return { x: p.x, y: p.y - gap };
  if (side === 'bottom') return { x: p.x, y: p.y + gap };
  if (side === 'left') return { x: p.x - gap, y: p.y };
  return { x: p.x + gap, y: p.y };
}

/**
 * Den sida av rutan som en punkt ligger närmast, räknat mot rutans mått: en
 * punkt rakt ovanför en bred nod ger `top`, också när den ligger långt åt
 * sidan i px. Handtagen på en linjes ändar dras med den.
 */
export function nearestSideTo(box: EdgeBox, point: EdgePoint): MindmapAnchor {
  const dx = (point.x - (box.x + box.width / 2)) / Math.max(1, box.width / 2);
  const dy = (point.y - (box.y + box.height / 2)) / Math.max(1, box.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

const bezierAt = (p0: EdgePoint, c1: EdgePoint, c2: EdgePoint, p3: EdgePoint, t: number): EdgePoint => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
  };
};

/** Linjen som en bruten linje, med kurvorna delade i 16 bitar. */
function routePoints(route: EdgeRoute): EdgePoint[] {
  const points: EdgePoint[] = [];
  let at: EdgePoint = { x: 0, y: 0 };
  route.forEach((cmd) => {
    if (cmd.type === 'M' || cmd.type === 'L') {
      at = { x: cmd.x, y: cmd.y };
      points.push(at);
      return;
    }
    const from = at;
    const c1 = { x: cmd.c1x, y: cmd.c1y };
    const c2 = { x: cmd.c2x, y: cmd.c2y };
    const to = { x: cmd.x, y: cmd.y };
    for (let i = 1; i <= 16; i += 1) points.push(bezierAt(from, c1, c2, to, i / 16));
    at = to;
  });
  return points;
}

/** Punkten halvvägs längs linjen, där en etikett står. */
export function routeMidpoint(route: EdgeRoute): EdgePoint {
  const points = routePoints(route);
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let left = lengths.reduce((sum, l) => sum + l, 0) / 2;
  for (let i = 0; i < lengths.length; i += 1) {
    if (left <= lengths[i] && lengths[i] > 0) {
      const t = left / lengths[i];
      return { x: points[i].x + (points[i + 1].x - points[i].x) * t, y: points[i].y + (points[i + 1].y - points[i].y) * t };
    }
    left -= lengths[i];
  }
  return points[points.length - 1];
}

/**
 * Var linjen kommer ifrån vid varje ände, för att rikta en pil: en punkt en
 * bit in på linjen från änden.
 */
export function routeEnds(route: EdgeRoute): { start: EdgePoint; startFrom: EdgePoint; end: EdgePoint; endFrom: EdgePoint } {
  const points = routePoints(route);
  const start = points[0] ?? { x: 0, y: 0 };
  const end = points[points.length - 1] ?? start;
  const startFrom = points.find((p) => p.x !== start.x || p.y !== start.y) ?? end;
  const endFrom = [...points].reverse().find((p) => p.x !== end.x || p.y !== end.y) ?? start;
  return { start, startFrom, end, endFrom };
}
