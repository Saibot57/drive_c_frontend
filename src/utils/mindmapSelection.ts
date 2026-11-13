import type { MindmapContent, MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { findNode, findParent, toggleCollapsed } from '@/utils/mindmap/mindmapTree';
import { routePoints, type EdgePoint } from '@/utils/mindmapEdges';
import type { RoutedEdge } from '@/utils/mindmapRouting';
import { removeNodeFromDoc } from '@/utils/mindmapDoc';

/*
 * Flera markerade noder och linjer på Mindmap-sidan
 * (docs/plans/mindmap-arrangera.md, del A). En linje heter efter noden den
 * går till, som i useMindmapEdgeSelection. Funktionerna här är rena; hooken
 * useMindmapMultiSelect håller markeringen.
 */

export interface MindmapGroup {
  nodes: string[];
  edges: string[];
}

export const EMPTY_GROUP: MindmapGroup = { nodes: [], edges: [] };

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Antal markerade, noder och linjer tillsammans. */
export const groupSize = (group: MindmapGroup): number => group.nodes.length + group.edges.length;

/** Rutan mellan två punkter, med positiv bredd och höjd. */
export function rectBetween(a: EdgePoint, b: EdgePoint): SelectionRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

const overlaps = (a: SelectionRect, b: SelectionRect) =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

const inside = (p: EdgePoint, r: SelectionRect) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

/** Sant om sträckan a–b går genom rutan (Liang–Barsky). */
export function segmentHitsRect(a: EdgePoint, b: EdgePoint, r: SelectionRect): boolean {
  if (inside(a, r) || inside(b, r)) return true;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, a.x - r.x],
    [dx, r.x + r.width - a.x],
    [-dy, a.y - r.y],
    [dy, r.y + r.height - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return true;
}

/** Noderna som ramen nuddar, i layoutens ordning. */
export function nodesInRect(layout: MindmapLayoutResult, rect: SelectionRect): string[] {
  return layout.nodes.filter((node) => overlaps(rect, node)).map((node) => node.id);
}

/** Linjerna som ramen nuddar (linjen provas som en bruten linje längs sin väg). */
export function edgesInRect(routes: RoutedEdge[], rect: SelectionRect): string[] {
  return routes
    .filter((edge) => {
      const points = routePoints(edge.route);
      return points.some((p, i) => (i === 0 ? inside(p, rect) : segmentHitsRect(points[i - 1], p, rect)));
    })
    .map((edge) => edge.toId);
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** Lägger till eller tar bort en nod eller linje. */
export function toggleInGroup(group: MindmapGroup, kind: 'node' | 'edge', id: string): MindmapGroup {
  return kind === 'node' ? { ...group, nodes: toggle(group.nodes, id) } : { ...group, edges: toggle(group.edges, id) };
}

/** Båda markeringarna, utan dubbletter. */
export function mergeGroups(a: MindmapGroup, b: MindmapGroup): MindmapGroup {
  return {
    nodes: [...a.nodes, ...b.nodes.filter((id) => !a.nodes.includes(id))],
    edges: [...a.edges, ...b.edges.filter((id) => !a.edges.includes(id))],
  };
}

/** Bara det som finns i kartan som visas: noder i layouten, linjer bland vägarna. */
export function visibleGroup(group: MindmapGroup, layout: MindmapLayoutResult, routes: RoutedEdge[]): MindmapGroup {
  const nodes = group.nodes.filter((id) => layout.byId.has(id));
  const edges = group.edges.filter((id) => routes.some((edge) => edge.toId === id));
  return nodes.length === group.nodes.length && edges.length === group.edges.length ? group : { nodes, edges };
}

/** Noden och dess syskon i trädets ordning. Roten har inga syskon. */
export function siblingIds(content: MindmapContent, id: string): string[] {
  const location = findParent(content.root, id);
  return location ? location.parent.children.map((child) => child.id) : [id];
}

/**
 * De markerade noder som inte ligger under en annan markerad nod, i trädets
 * ordning. Roten räknas inte som förfader: den flyttas ensam, och grenarna
 * under den står kvar (docs/plans/mindmap-placering.md, beslut 3).
 */
export function topLevelIds(content: MindmapContent, ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  const result: string[] = [];
  const walk = (node: MindmapNode, covered: boolean) => {
    const picked = wanted.has(node.id);
    if (picked && !covered) result.push(node.id);
    const coversChildren = covered || (picked && node.id !== content.root.id);
    node.children.forEach((child) => walk(child, coversChildren));
  };
  walk(content.root, false);
  return result;
}

/** Samma ändring på varje nod. Samma dokument om ingen ändrades. */
export function applyToNodes<T extends MindmapContent>(
  content: T,
  ids: readonly string[],
  update: (current: T, id: string) => MindmapContent | null,
): T {
  return ids.reduce<T>((current, id) => {
    if (!findNode(current.root, id)) return current;
    return (update(current, id) as T | null) ?? current;
  }, content);
}

/**
 * Tar bort de markerade noderna med deras grenar. Roten och `keep` (grenens
 * rot i grenvyn) står kvar. `focusId` är noden som markeras efteråt.
 */
export function removeNodes(doc: MindmapDoc, ids: readonly string[], keep: string | null = null): { doc: MindmapDoc; focusId: string } | null {
  const targets = topLevelIds(doc, ids).filter((id) => id !== doc.root.id && id !== keep);
  if (targets.length === 0) return null;
  let current = doc;
  let focusId = doc.root.id;
  targets.forEach((id) => {
    const removed = removeNodeFromDoc(current, id);
    if (removed) {
      current = removed.doc;
      focusId = removed.focusId;
    }
  });
  // Fokus på en nod som själv togs bort längre fram: gå till närmaste som finns.
  if (!findNode(current.root, focusId)) focusId = keep ?? current.root.id;
  return { doc: current, focusId };
}

/**
 * Fäller ihop alla markerade som har barn; är alla redan hopfällda fälls de
 * ut. Roten fälls aldrig.
 */
export function toggleCollapseNodes<T extends MindmapContent>(content: T, ids: readonly string[]): T {
  const nodes = ids
    .map((id) => findNode(content.root, id))
    .filter((node): node is MindmapNode => !!node && node.id !== content.root.id && node.children.length > 0);
  if (nodes.length === 0) return content;
  const collapse = nodes.some((node) => !node.collapsed);
  return applyToNodes(content, nodes.map((node) => node.id), (current, id) =>
    (!!findNode(current.root, id)?.collapsed === collapse ? null : toggleCollapsed(current, id)));
}

/** Ett värde som är lika för alla, annars `'mixed'`. */
export function commonValue<V>(values: readonly V[]): V | 'mixed' | undefined {
  if (values.length === 0) return undefined;
  return values.every((value) => value === values[0]) ? values[0] : 'mixed';
}
