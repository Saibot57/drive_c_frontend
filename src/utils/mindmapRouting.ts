import type { MindmapAnchor, MindmapContent, MindmapEdgeShape, MindmapEdgeStyle, MindmapNode } from '@/types/mindmap';
import type { MindmapDoc, MindmapLines } from '@/types/mindmapDoc';
import { MINDMAP_METRICS, type MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { findNode, updateNode } from '@/utils/mindmap/mindmapTree';
import { anchorPoint, nearestSides, routeEdge, traceRoute, type EdgeBox, type EdgePoint, type EdgeRoute } from '@/utils/mindmapEdges';

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
export function routeEdges(
  layout: MindmapLayoutResult,
  doc: Pick<MindmapDoc, 'lines'> & { root?: MindmapNode },
): RoutedEdge[] {
  const { shape, anchor } = resolveLines(doc.lines);
  const styles = doc.root ? edgeStyles(doc.root) : null;
  return layout.edges.map((edge) => {
    const from = layout.byId.get(edge.fromId);
    const to = layout.byId.get(edge.toId);
    const own = styles?.get(edge.toId);
    const edgeShape = own?.shape ?? shape;
    if (from && to && (anchor === 'nearest' || own?.from || own?.to || own?.points)) {
      // Fästen som inte är valda följer kartan: närmaste kant, eller grensidan.
      const points = own?.points ? absolutePoints(from, own.points) : undefined;
      const auto = anchor === 'nearest' ? nearestSidesVia(from, to, points) : sideAnchors(to.side);
      const fromSide = own?.from ?? auto.from;
      const toSide = own?.to ?? auto.to;
      return { fromId: edge.fromId, toId: edge.toId, route: routeBetween(from, fromSide, to, toSide, edgeShape, points) };
    }
    const sides = sideAnchors(to?.side ?? null);
    return {
      fromId: edge.fromId,
      toId: edge.toId,
      route: routeEdge({
        start: { x: edge.x1, y: edge.y1 },
        startSide: sides.from,
        end: { x: edge.x2, y: edge.y2 },
        endSide: sides.to,
        shape: edgeShape,
      }),
    };
  });
}

/** Grensidans fästen: ut från förälderns utåtvända sida, in i barnets inåtvända. */
const sideAnchors = (side: 'left' | 'right' | null): { from: MindmapAnchor; to: MindmapAnchor } =>
  side === 'left' ? { from: 'left', to: 'right' } : { from: 'right', to: 'left' };

/** Nodernas egna linjeval, per nod-id. */
function edgeStyles(root: MindmapNode): Map<string, MindmapEdgeStyle> {
  const map = new Map<string, MindmapEdgeStyle>();
  const walk = (node: MindmapNode) => {
    if (node.edge) map.set(node.id, node.edge);
    node.children.forEach(walk);
  };
  walk(root);
  return map;
}

function routeBetween(
  from: EdgeBox,
  fromSide: MindmapAnchor,
  to: EdgeBox,
  toSide: MindmapAnchor,
  shape: MindmapEdgeShape,
  points?: EdgePoint[],
): EdgeRoute {
  return routeEdge({ start: anchorPoint(from, fromSide), startSide: fromSide, end: anchorPoint(to, toSide), endSide: toSide, shape, points });
}

/**
 * De sidor som vetter mot nästa punkt på vägen: med brytpunkter vetter
 * starten mot den första och änden mot den sista.
 */
export function nearestSidesVia(from: EdgeBox, to: EdgeBox, points?: EdgePoint[]): { from: MindmapAnchor; to: MindmapAnchor } {
  if (!points || points.length === 0) return nearestSides(from, to);
  const dot = (p: EdgePoint): EdgeBox => ({ x: p.x, y: p.y, width: 0, height: 0 });
  return { from: nearestSides(from, dot(points[0])).from, to: nearestSides(dot(points[points.length - 1]), to).to };
}

/** Rutans mitt. */
export const boxCenter = (box: EdgeBox): EdgePoint => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/** Brytpunkterna i layoutens koordinater, från förälderns mitt. */
export function absolutePoints(parent: EdgeBox, points: { x: number; y: number }[]): EdgePoint[] {
  const c = boxCenter(parent);
  return points.map((p) => ({ x: c.x + p.x, y: c.y + p.y }));
}

/** Ritar grenarnas linjer på Canvas med den färg och bredd som är satt. */
export function drawRoutedEdges(
  ctx: CanvasRenderingContext2D,
  layout: MindmapLayoutResult,
  doc: Pick<MindmapDoc, 'lines'> & { root?: MindmapNode },
): void {
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

/* ── Del C: en linjes egna val ── */

function updateEdge<T extends MindmapContent>(content: T, id: string, update: (edge: MindmapEdgeStyle) => MindmapEdgeStyle): T {
  if (id === content.root.id || !findNode(content.root, id)) return content;
  let changed = false;
  const root = updateNode(content.root, id, (node) => {
    const next = update(node.edge ?? {});
    const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)) as MindmapEdgeStyle;
    const was = node.edge ?? {};
    const same = clean.shape === was.shape && clean.from === was.from && clean.to === was.to
      && JSON.stringify(clean.points ?? null) === JSON.stringify(was.points ?? null);
    if (same) return node;
    changed = true;
    if (Object.keys(clean).length > 0) return { ...node, edge: clean };
    const { edge: _edge, ...rest } = node;
    return rest as MindmapNode;
  });
  return changed ? { ...content, root } : content;
}

/** Linjens egen form; `null` följer kartan. */
export function setEdgeShape<T extends MindmapContent>(content: T, id: string, shape: MindmapEdgeShape | null): T {
  return updateEdge(content, id, (edge) => ({ ...edge, shape: shape ?? undefined }));
}

/** Var linjen fäster vid en ände; `null` följer kartan. */
export function setEdgeAnchor<T extends MindmapContent>(content: T, id: string, end: 'from' | 'to', side: MindmapAnchor | null): T {
  return updateEdge(content, id, (edge) => ({ ...edge, [end]: side ?? undefined }));
}

/** Linjens brytpunkter, från förälderns mitt; en tom lista eller `null` tar bort dem. */
export function setEdgePoints<T extends MindmapContent>(content: T, id: string, points: { x: number; y: number }[] | null): T {
  const clean = points && points.length > 0 ? points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })) : undefined;
  return updateEdge(content, id, (edge) => ({ ...edge, points: clean }));
}

/** Återställ linje: tar bort alla linjens egna val. */
export function resetEdgeStyle<T extends MindmapContent>(content: T, id: string): T {
  return updateEdge(content, id, () => ({}));
}

/**
 * Tar bort fästena och brytpunkterna på en nod som fått en annan förälder: de gällde linjen
 * till den gamla. Linjens egen form står kvar. Samma dokument när inget
 * behöver ändras.
 */
export function pruneEdgeAnchors<T extends MindmapContent>(prev: MindmapContent, next: T): T {
  const anchored: string[] = [];
  const walkNext = (node: MindmapNode) => {
    if (node.edge?.from || node.edge?.to || node.edge?.points) anchored.push(node.id);
    node.children.forEach(walkNext);
  };
  walkNext(next.root);
  if (anchored.length === 0) return next;
  const parentsOf = (root: MindmapNode) => {
    const map = new Map<string, string>();
    const walk = (node: MindmapNode) => node.children.forEach((child) => {
      map.set(child.id, node.id);
      walk(child);
    });
    walk(root);
    return map;
  };
  const before = parentsOf(prev.root);
  const after = parentsOf(next.root);
  let result = next;
  anchored.forEach((id) => {
    if (!before.has(id) || before.get(id) === after.get(id)) return;
    result = updateEdge(result, id, (edge) => ({ shape: edge.shape }));
  });
  return result;
}

/* ── Del D: kartans mått med brytpunkterna ── */

/**
 * Brytpunkterna i layoutens koordinater: grenarnas från förälderns mitt,
 * tvärlänkarnas från punkten mitt emellan nodernas mitt. Bara de som har
 * båda sina noder synliga.
 */
export function waypointsInLayout(layout: MindmapLayoutResult, doc: Pick<MindmapDoc, 'root' | 'crossLinks'>): EdgePoint[] {
  const out: EdgePoint[] = [];
  const styles = edgeStyles(doc.root);
  layout.edges.forEach((edge) => {
    const points = styles.get(edge.toId)?.points;
    const parent = layout.byId.get(edge.fromId);
    if (points && parent) out.push(...absolutePoints(parent, points));
  });
  (doc.crossLinks ?? []).forEach((link) => {
    const a = layout.byId.get(link.from);
    const b = layout.byId.get(link.to);
    if (!link.points || !a || !b) return;
    out.push(...crossLinkPointsAbsolute(a, b, link.points));
  });
  return out;
}

/** Tvärlänkens brytpunkter i layoutens koordinater. */
export function crossLinkPointsAbsolute(from: EdgeBox, to: EdgeBox, points: { x: number; y: number }[]): EdgePoint[] {
  const a = boxCenter(from);
  const b = boxCenter(to);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return points.map((p) => ({ x: mid.x + p.x, y: mid.y + p.y }));
}

/**
 * Kartans mått så att också brytpunkterna ryms, med marginalen runt. Allt
 * flyttas lika mycket, så att linjerna (som räknas ur rutorna) följer med.
 * Utan punkter utanför kommer samma layout tillbaka.
 */
export function includeWaypoints(
  layout: MindmapLayoutResult,
  doc: Pick<MindmapDoc, 'root' | 'crossLinks'>,
  margin = MINDMAP_METRICS.margin,
): MindmapLayoutResult {
  const points = waypointsInLayout(layout, doc);
  if (points.length === 0) return layout;
  const minX = Math.min(margin, ...points.map((p) => p.x)) - margin;
  const minY = Math.min(margin, ...points.map((p) => p.y)) - margin;
  const maxX = Math.max(layout.width - margin, ...points.map((p) => p.x)) + margin;
  const maxY = Math.max(layout.height - margin, ...points.map((p) => p.y)) + margin;
  const dx = -Math.min(0, minX);
  const dy = -Math.min(0, minY);
  const width = Math.ceil(Math.max(layout.width, maxX) + dx);
  const height = Math.ceil(Math.max(layout.height, maxY) + dy);
  if (dx === 0 && dy === 0 && width === layout.width && height === layout.height) return layout;
  const nodes = layout.nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
  return {
    nodes,
    edges: layout.edges.map((e) => ({ ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy })),
    width,
    height,
    byId: new Map(nodes.map((n) => [n.id, n])),
  };
}

/** Sidans layout färdig: rotens förskjutning och brytpunkterna. */
export function finishMindmapLayout(
  layout: MindmapLayoutResult,
  doc: Pick<MindmapDoc, 'root' | 'crossLinks'>,
): MindmapLayoutResult {
  return includeWaypoints(placeRootInLayout(layout, doc), doc);
}

/** Punkter i layoutens koordinater till det som sparas på en gren: från förälderns mitt. */
export function edgePointsToRelative(parent: EdgeBox, points: EdgePoint[]): { x: number; y: number }[] {
  const c = boxCenter(parent);
  return points.map((p) => ({ x: Math.round(p.x - c.x), y: Math.round(p.y - c.y) }));
}

/** Punkter i layoutens koordinater till det som sparas på en tvärlänk: från mitten mellan noderna. */
export function linkPointsToRelative(from: EdgeBox, to: EdgeBox, points: EdgePoint[]): { x: number; y: number }[] {
  const a = boxCenter(from);
  const b = boxCenter(to);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return points.map((p) => ({ x: Math.round(p.x - mid.x), y: Math.round(p.y - mid.y) }));
}

/**
 * Dokumentet med brytpunkterna som dras (del D), för ritningen medan
 * punkten flyttas. `key` är `edge:<nod-id>` eller `link:<länk-id>`; punkterna
 * är i layoutens koordinater.
 */
export function previewEdgePoints(doc: MindmapDoc, layout: MindmapLayoutResult, preview: { key: string; points: EdgePoint[] } | null): MindmapDoc {
  if (!preview?.key.startsWith('edge:')) return doc;
  const id = preview.key.slice(5);
  const edge = layout.edges.find((e) => e.toId === id);
  const parent = edge ? layout.byId.get(edge.fromId) : undefined;
  return parent ? setEdgePoints(doc, id, edgePointsToRelative(parent, preview.points)) : doc;
}

export function previewLinkPoints(doc: MindmapDoc, layout: MindmapLayoutResult, preview: { key: string; points: EdgePoint[] } | null): MindmapDoc {
  if (!preview?.key.startsWith('link:')) return doc;
  const id = preview.key.slice(5);
  const link = (doc.crossLinks ?? []).find((l) => l.id === id);
  const from = link ? layout.byId.get(link.from) : undefined;
  const to = link ? layout.byId.get(link.to) : undefined;
  if (!link || !from || !to) return doc;
  const points = linkPointsToRelative(from, to, preview.points);
  return { ...doc, crossLinks: (doc.crossLinks ?? []).map((l) => (l.id === id ? { ...l, points } : l)) };
}
