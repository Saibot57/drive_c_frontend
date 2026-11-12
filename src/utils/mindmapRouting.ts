import type { MindmapAnchor, MindmapEdgeShape } from '@/types/mindmap';
import type { MindmapDoc, MindmapLines } from '@/types/mindmapDoc';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
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
