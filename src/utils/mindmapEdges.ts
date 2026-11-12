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
