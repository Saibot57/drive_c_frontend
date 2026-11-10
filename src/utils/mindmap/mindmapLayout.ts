import type { MindmapColor, MindmapContent, MindmapNode, MindmapSide } from '@/types/mindmap';
import { countDescendants, rootChildSides } from './mindmapTree';

/*
 * Var noderna hamnar. Samma layout ritar kartan i kortet och i bilden som
 * exporteras, så att bilden blir det man ser. Textbredden mäts av anroparen —
 * i kortet med typsnittet på skärmen, i testerna med en enkel funktion.
 *
 * Grenarna växer ut från roten åt sidan. Varje gren får den höjd dess
 * synliga noder behöver, och föräldern centreras mot sina barn.
 */

export interface MindmapMetrics {
  nodeHeight: number;
  rootHeight: number;
  /** Luft mellan text och kant. Kanten själv räknas för sig, se border. */
  padX: number;
  rootPadX: number;
  /** Speglar kantbredden i workspace.css (.ws-mindmap__node och --root). */
  border: number;
  rootBorder: number;
  /** Vågrätt avstånd mellan en nod och dess barn. */
  hGap: number;
  /** Lodrätt avstånd mellan två syskongrenar. */
  vGap: number;
  /** Luft runt hela kartan. */
  margin: number;
  /** Plats för "+3" på en hopfälld nod. */
  badgeWidth: number;
  /** En tom nod ska gå att träffa med musen. */
  minLabelWidth: number;
  /** Avrundning i textmätningen ska inte klippa sista bokstaven. */
  slack: number;
}

export const MINDMAP_METRICS: MindmapMetrics = {
  nodeHeight: 26,
  rootHeight: 34,
  padX: 10,
  rootPadX: 14,
  border: 1,
  rootBorder: 2,
  hGap: 32,
  vGap: 6,
  margin: 12,
  badgeWidth: 24,
  minLabelWidth: 28,
  slack: 2,
};

export type MeasureText = (text: string, isRoot: boolean) => number;

export interface LaidOutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Textytans bredd, innanför luft och kant. */
  labelWidth: number;
  depth: number;
  side: MindmapSide | null;
  color?: MindmapColor;
  isRoot: boolean;
  /** Antal gömda noder under en hopfälld nod, annars 0. */
  hiddenCount: number;
}

export interface LaidOutEdge {
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MindmapLayoutResult {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
  byId: Map<string, LaidOutNode>;
}

export function layoutMindmap(
  content: MindmapContent,
  measure: MeasureText,
  metrics: MindmapMetrics = MINDMAP_METRICS,
): MindmapLayoutResult {
  const { root } = content;
  const nodes: LaidOutNode[] = [];
  const edges: LaidOutEdge[] = [];

  const sizeOf = (node: MindmapNode, isRoot: boolean) => {
    const labelWidth = Math.ceil(Math.max(metrics.minLabelWidth, measure(node.label, isRoot) + metrics.slack));
    const pad = isRoot ? metrics.rootPadX : metrics.padX;
    const border = isRoot ? metrics.rootBorder : metrics.border;
    const hiddenCount = node.collapsed && !isRoot ? countDescendants(node) : 0;
    const width = labelWidth + 2 * pad + 2 * border + (hiddenCount > 0 ? metrics.badgeWidth : 0);
    return { width, labelWidth, hiddenCount, height: isRoot ? metrics.rootHeight : metrics.nodeHeight };
  };

  const visibleChildren = (node: MindmapNode) => (node.collapsed ? [] : node.children);

  const heights = new Map<string, number>();
  const subtreeHeight = (node: MindmapNode): number => {
    const cached = heights.get(node.id);
    if (cached !== undefined) return cached;
    const kids = visibleChildren(node);
    const own = metrics.nodeHeight;
    const total = kids.length === 0
      ? own
      : Math.max(own, kids.reduce((sum, kid) => sum + subtreeHeight(kid), 0) + metrics.vGap * (kids.length - 1));
    heights.set(node.id, total);
    return total;
  };

  /**
   * Lägger barnen i en kolumn centrerad på `cy`. `anchorX` är kolumnens kant
   * närmast föräldern: vänsterkanten till höger om roten, högerkanten till
   * vänster om den.
   */
  const placeChildren = (
    parent: { id: string; edgeX: number; cy: number },
    kids: MindmapNode[],
    anchorX: number,
    side: MindmapSide,
    depth: number,
  ) => {
    if (kids.length === 0) return;
    const total = kids.reduce((sum, kid) => sum + subtreeHeight(kid), 0) + metrics.vGap * (kids.length - 1);
    let top = parent.cy - total / 2;
    kids.forEach((kid) => {
      const kidHeight = subtreeHeight(kid);
      const cy = top + kidHeight / 2;
      edges.push({ fromId: parent.id, toId: kid.id, x1: parent.edgeX, y1: parent.cy, x2: anchorX, y2: cy });
      place(kid, anchorX, cy, side, depth);
      top += kidHeight + metrics.vGap;
    });
  };

  const place = (node: MindmapNode, anchorX: number, cy: number, side: MindmapSide, depth: number) => {
    const size = sizeOf(node, false);
    const x = side === 'right' ? anchorX : anchorX - size.width;
    nodes.push({
      id: node.id,
      label: node.label,
      x,
      y: cy - size.height / 2,
      width: size.width,
      height: size.height,
      labelWidth: size.labelWidth,
      depth,
      side,
      color: node.color,
      isRoot: false,
      hiddenCount: size.hiddenCount,
    });
    const edgeX = side === 'right' ? x + size.width : x;
    const childAnchor = side === 'right' ? x + size.width + metrics.hGap : x - metrics.hGap;
    placeChildren({ id: node.id, edgeX, cy }, visibleChildren(node), childAnchor, side, depth + 1);
  };

  // Roten centreras i origo; allt flyttas på plats när måtten är kända.
  const rootSize = sizeOf(root, true);
  nodes.push({
    id: root.id,
    label: root.label,
    x: -rootSize.width / 2,
    y: -rootSize.height / 2,
    width: rootSize.width,
    height: rootSize.height,
    labelWidth: rootSize.labelWidth,
    depth: 0,
    side: null,
    color: root.color,
    isRoot: true,
    hiddenCount: 0,
  });

  const sides = rootChildSides(content);
  (['right', 'left'] as const).forEach((side) => {
    const kids = root.children.filter((child) => sides.get(child.id) === side);
    const edgeX = side === 'right' ? rootSize.width / 2 : -rootSize.width / 2;
    const anchor = side === 'right' ? edgeX + metrics.hGap : edgeX - metrics.hGap;
    placeChildren({ id: root.id, edgeX, cy: 0 }, kids, anchor, side, 1);
  });

  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.width));
  const maxY = Math.max(...nodes.map((n) => n.y + n.height));
  const dx = metrics.margin - minX;
  const dy = metrics.margin - minY;

  const shifted = nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
  return {
    nodes: shifted,
    edges: edges.map((e) => ({ ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy })),
    width: Math.ceil(maxX - minX + 2 * metrics.margin),
    height: Math.ceil(maxY - minY + 2 * metrics.margin),
    byId: new Map(shifted.map((n) => [n.id, n])),
  };
}

/** En mjuk kurva från förälderns kant till barnets. */
export function edgePath(edge: LaidOutEdge): string {
  const mid = (edge.x1 + edge.x2) / 2;
  return `M ${edge.x1} ${edge.y1} C ${mid} ${edge.y1}, ${mid} ${edge.y2}, ${edge.x2} ${edge.y2}`;
}
