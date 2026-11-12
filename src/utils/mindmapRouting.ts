import type { MindmapAnchor, MindmapContent, MindmapEdgeShape } from '@/types/mindmap';
import type { MindmapDoc, MindmapLines } from '@/types/mindmapDoc';
import { MINDMAP_METRICS, type MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { anchorPoint, nearestSides, routeEdge, traceRoute, type EdgeBox, type EdgeRoute } from '@/utils/mindmapEdges';

/*
 * Grenarnas linjer på Mindmap-sidan, räknade ur den färdiga layouten och
 * kartans val (`lines`). Skärmen, presentationen, minikartan och bilden
 * läser alla härifrån. Den delade layouten och `edgePath` rörs inte, så
 * workspace-kortet ritar som förut.
 *
 * Planen: docs/plans/mindmap-placering.md, del A.
 */

export interface RoutedEdge {
  fromId: string;
  toId: string;
  route: EdgeRoute;
}

/** Kartans val med förvalen ifyllda. Saknas fältet gäller dagens geometri. */
export function resolveLines(lines: MindmapLines | undefined): Required<MindmapLines> {
  return { shape: lines?.shape ?? 'curve', anchor: lines?.anchor ?? 'side' };
}

/**
 * Linjen till varje synligt barn. Med fästet `side` går linjen från
 * förälderns utåtvända kant till barnets inåtvända, som i layouten; med
 * `nearest` från de sidor av nodernas rutor som vetter mot varandra.
 */
export function routeEdges(layout: MindmapLayoutResult, doc: Pick<MindmapDoc, 'lines'>): RoutedEdge[] {
  const { shape, anchor } = resolveLines(doc.lines);
  return layout.edges.map((edge) => {
    const from = layout.byId.get(edge.fromId);
    const to = layout.byId.get(edge.toId);
    if (anchor === 'nearest' && from && to) {
      const sides = nearestSides(from, to);
      return { fromId: edge.fromId, toId: edge.toId, route: routeBetween(from, sides.from, to, sides.to, shape) };
    }
    const left = to?.side === 'left';
    return {
      fromId: edge.fromId,
      toId: edge.toId,
      route: routeEdge({
        start: { x: edge.x1, y: edge.y1 },
        startSide: left ? 'left' : 'right',
        end: { x: edge.x2, y: edge.y2 },
        endSide: left ? 'right' : 'left',
        shape,
      }),
    };
  });
}

function routeBetween(from: EdgeBox, fromSide: MindmapAnchor, to: EdgeBox, toSide: MindmapAnchor, shape: MindmapEdgeShape): EdgeRoute {
  return routeEdge({ start: anchorPoint(from, fromSide), startSide: fromSide, end: anchorPoint(to, toSide), endSide: toSide, shape });
}

/** Ritar grenarnas linjer på Canvas med den färg och bredd som är satt. */
export function drawRoutedEdges(ctx: CanvasRenderingContext2D, layout: MindmapLayoutResult, doc: Pick<MindmapDoc, 'lines'>): void {
  routeEdges(layout, doc).forEach(({ route }) => {
    ctx.beginPath();
    traceRoute(ctx, route);
    ctx.stroke();
  });
}

/** Byter kartans val. Det som inte ändras sparas med sitt nuvarande värde. */
export function setLines(doc: MindmapDoc, patch: MindmapLines): MindmapDoc {
  const lines = resolveLines(doc.lines);
  return { ...doc, lines: { shape: patch.shape ?? lines.shape, anchor: patch.anchor ?? lines.anchor } };
}

/**
 * Rotens förskjutning (del B). Den delade layouten läser den inte, så att
 * kortet står som förut; sidan flyttar roten här, och bara roten. Linjerna
 * från roten följer med, och kartans mått räknas om så att allt ryms.
 * Utan förskjutning kommer samma layout tillbaka.
 */
export function placeRootInLayout(
  layout: MindmapLayoutResult,
  content: Pick<MindmapContent, 'root'>,
  margin = MINDMAP_METRICS.margin,
): MindmapLayoutResult {
  const offset = content.root.offset;
  if (!offset || (offset.dx === 0 && offset.dy === 0)) return layout;
  const rootId = content.root.id;
  const moved = layout.nodes.map((n) => (n.id === rootId ? { ...n, x: n.x + offset.dx, y: n.y + offset.dy } : n));
  const edges = layout.edges.map((e) => (e.fromId === rootId ? { ...e, x1: e.x1 + offset.dx, y1: e.y1 + offset.dy } : e));
  const minX = Math.min(...moved.map((n) => n.x));
  const minY = Math.min(...moved.map((n) => n.y));
  const maxX = Math.max(...moved.map((n) => n.x + n.width));
  const maxY = Math.max(...moved.map((n) => n.y + n.height));
  const dx = margin - minX;
  const dy = margin - minY;
  const nodes = moved.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
  return {
    nodes,
    edges: edges.map((e) => ({ ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy })),
    width: Math.ceil(maxX - minX + 2 * margin),
    height: Math.ceil(maxY - minY + 2 * margin),
    byId: new Map(nodes.map((n) => [n.id, n])),
  };
}

/**
 * Rotens automatiska mitt i layouten: där den hade stått utan förskjutning.
 * Kartans lager och rutnätet utgår från den, så att resten av kartan står
 * still på skärmen när roten flyttas.
 */
export function rootOrigin(layout: MindmapLayoutResult, content: Pick<MindmapContent, 'root'>): { x: number; y: number } {
  const root = layout.byId.get(content.root.id) ?? layout.nodes.find((n) => n.isRoot);
  if (!root) return { x: 0, y: 0 };
  const offset = content.root.offset ?? { dx: 0, dy: 0 };
  return { x: root.x + root.width / 2 - offset.dx, y: root.y + root.height / 2 - offset.dy };
}

/** Slår på eller av rutnätet. Av sparas som att fältet saknas. */
export function setGrid(doc: MindmapDoc, grid: boolean): MindmapDoc {
  if (grid) return doc.grid ? doc : { ...doc, grid: true };
  if (!doc.grid) return doc;
  const { grid: _grid, ...rest } = doc;
  return rest;
}
