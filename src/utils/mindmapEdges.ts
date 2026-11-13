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
  /** Brytpunkter som linjen går igenom, i ordning (del D). */
  points?: EdgePoint[];
}

/**
 * Linjen mellan två ändar.
 *
 * - Kurva: varje styrpunkt ligger ut från sin ände längs sidans riktning,
 *   halvvägs mot den andra änden i den ledden. Höger mot vänster blir exakt
 *   kurvan som `edgePath` ritar.
 * - Rak: en rak linje.
 * - Vinklad: rätvinkliga sträckor, ut från startsidan och in i ändsidan.
 *
 * Med brytpunkter går linjen genom dem: rak som en bruten linje, vinklad
 * rätvinkligt genom var och en, och kurvan mjukt genom dem.
 */
export function routeEdge(input: RouteInput): EdgeRoute {
  if (input.points && input.points.length > 0) return routeThrough(input, input.points);
  const { start, startSide, end, endSide, shape } = input;
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

const NORMALS: Record<MindmapAnchor, EdgePoint> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

function routeThrough({ start, startSide, end, endSide, shape }: RouteInput, points: EdgePoint[]): EdgeRoute {
  const chain = [start, ...points, end];
  const move: RouteCommand = { type: 'M', x: start.x, y: start.y };
  const line = (p: EdgePoint): RouteCommand => ({ type: 'L', x: p.x, y: p.y });

  if (shape === 'straight') return [move, ...chain.slice(1).map(line)];

  if (shape === 'elbow') {
    // Varje sträcka har ett hörn. Den första går ut längs startsidan, den
    // sista in längs ändsidan, och de andra vågrätt först.
    const out: RouteCommand[] = [move];
    for (let i = 0; i < chain.length - 1; i += 1) {
      const a = chain[i];
      const b = chain[i + 1];
      const last = i === chain.length - 2;
      let horizontalFirst = true;
      if (i === 0) horizontalFirst = horizontal(startSide);
      if (last) horizontalFirst = !horizontal(endSide);
      const corner = horizontalFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
      if ((corner.x !== a.x || corner.y !== a.y) && (corner.x !== b.x || corner.y !== b.y)) out.push(line(corner));
      out.push(line(b));
    }
    return out;
  }

  // Kurvan: Catmull-Rom genom punkterna, med ändarnas riktning längs sidorna.
  const tangents = chain.map((p, i) => {
    if (i === 0) {
      const reach = Math.hypot(chain[1].x - p.x, chain[1].y - p.y);
      return { x: NORMALS[startSide].x * reach, y: NORMALS[startSide].y * reach };
    }
    if (i === chain.length - 1) {
      const prev = chain[i - 1];
      const reach = Math.hypot(p.x - prev.x, p.y - prev.y);
      return { x: -NORMALS[endSide].x * reach, y: -NORMALS[endSide].y * reach };
    }
    return { x: (chain[i + 1].x - chain[i - 1].x) / 2, y: (chain[i + 1].y - chain[i - 1].y) / 2 };
  });
  const out: RouteCommand[] = [move];
  for (let i = 0; i < chain.length - 1; i += 1) {
    const a = chain[i];
    const b = chain[i + 1];
    out.push({
      type: 'C',
      c1x: a.x + tangents[i].x / 3,
      c1y: a.y + tangents[i].y / 3,
      c2x: b.x - tangents[i + 1].x / 3,
      c2y: b.y - tangents[i + 1].y / 3,
      x: b.x,
      y: b.y,
    });
  }
  return out;
}

/** Avståndet från en punkt till en sträcka. */
function distanceToSegment(p: EdgePoint, a: EdgePoint, b: EdgePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Var en ny brytpunkt vid `at` ska stå i listan: mellan de två punkter (eller
 * ändar) vars sträcka ligger närmast.
 */
export function waypointInsertIndex(start: EdgePoint, points: EdgePoint[], end: EdgePoint, at: EdgePoint): number {
  const chain = [start, ...points, end];
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < chain.length - 1; i += 1) {
    const d = distanceToSegment(at, chain[i], chain[i + 1]);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/** Mitten av den längsta sträckan: där en brytpunkt läggs från knappen i raden. */
export function longestSegmentMiddle(start: EdgePoint, points: EdgePoint[], end: EdgePoint): { index: number; at: EdgePoint } {
  const chain = [start, ...points, end];
  let index = 0;
  let longest = -1;
  for (let i = 0; i < chain.length - 1; i += 1) {
    const length = Math.hypot(chain[i + 1].x - chain[i].x, chain[i + 1].y - chain[i].y);
    if (length > longest) {
      longest = length;
      index = i;
    }
  }
  return { index, at: { x: (chain[index].x + chain[index + 1].x) / 2, y: (chain[index].y + chain[index + 1].y) / 2 } };
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
export function routePoints(route: EdgeRoute): EdgePoint[] {
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
