import type { MindmapContent, MindmapNode } from '@/types/mindmap';
import { MINDMAP_METRICS, type LaidOutNode, type MindmapLayoutResult, type MindmapMetrics } from '@/utils/mindmap/mindmapLayout';
import { findNode, findParent, setOffset } from '@/utils/mindmap/mindmapTree';
import { apart, reach } from '@/utils/mindmapDirections';
import { placeRoot } from '@/utils/mindmapPlacement';
import { topLevelIds, type SelectionRect } from '@/utils/mindmapSelection';

/*
 * Arrangera de markerade noderna (docs/plans/mindmap-arrangera.md, del D).
 * Noderna grupperas efter förälder, och varje grupp ställs i ett mönster
 * runt sin förälder: hörn, cirkel, två sidor eller en sida. "Inom ett
 * område" ställer alla markerade i ett område man drar upp. Resultatet är
 * förskjutningar, så grenarna följer med och allt går att dra fritt efteråt.
 * Arrangemanget sätter ingen riktning för nya barn (beslut 22).
 */

export type MindmapArrangePattern = 'corners' | 'circle' | 'sides' | 'right' | 'left' | 'above' | 'below' | 'area';

export const MINDMAP_ARRANGE_PATTERNS: readonly MindmapArrangePattern[] = ['corners', 'circle', 'sides', 'right', 'left', 'above', 'below', 'area'];

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };

const centerOf = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/** Avståndet mellan föräldern och de arrangerade, i luftsteg (`hGap`). */
const RING = 2;

/** Rutan runt noden och allt synligt under den. */
function branchBox(node: MindmapNode, layout: MindmapLayoutResult): Box {
  const own = layout.byId.get(node.id)!;
  let minX = own.x;
  let minY = own.y;
  let maxX = own.x + own.width;
  let maxY = own.y + own.height;
  const walk = (n: MindmapNode) => {
    if (n.collapsed) return;
    n.children.forEach((child) => {
      const box = layout.byId.get(child.id);
      if (!box) return;
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
      walk(child);
    });
  };
  walk(node);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

interface Member {
  node: MindmapNode;
  box: LaidOutNode;
  branch: Box;
  /** Mitten där noden står nu. */
  at: Point;
}

/** Var varje nods mitt ska hamna. */
type Targets = Map<string, Point>;

/**
 * Lägger noderna i en kolumn (`vertical`) eller en rad, i ordning, med
 * grenarnas storlek, centrerad på `center` längs kolumnen. `edge` sätter
 * nodens läge tvärs över: dess vänsterkant, högerkant, överkant eller underkant.
 */
function stack(members: Member[], vertical: boolean, center: number, edge: { side: 'start' | 'end'; at: number }, gap: number, targets: Targets) {
  const length = (m: Member) => (vertical ? m.branch.height : m.branch.width);
  const total = members.reduce((sum, m) => sum + length(m), 0) + gap * Math.max(0, members.length - 1);
  let cursor = center - total / 2;
  members.forEach((m) => {
    // Nodens läge i sin gren längs kolumnen.
    const within = vertical ? m.box.y - m.branch.y : m.box.x - m.branch.x;
    const along = cursor + within + (vertical ? m.box.height : m.box.width) / 2;
    const size = vertical ? m.box.width : m.box.height;
    const across = edge.side === 'start' ? edge.at + size / 2 : edge.at - size / 2;
    targets.set(m.node.id, vertical ? { x: across, y: along } : { x: along, y: across });
    cursor += length(m) + gap;
  });
}

/** Vinkeln från `c` mot `p` i radianer, 0 åt höger och medurs. */
const angleOf = (c: Point, p: Point) => Math.atan2(p.y - c.y, p.x - c.x);

/** Skillnaden mellan två vinklar, i [0, π]. */
const angleDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
};

/**
 * Ger varje nod en plats, så att den närmaste förflyttningen väljs först.
 * `cost(i, j)` är kostnaden för nod i på plats j.
 */
function assignGreedy(count: number, slots: number, cost: (i: number, j: number) => number): number[] {
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < count; i += 1) for (let j = 0; j < slots; j += 1) pairs.push([cost(i, j), i, j]);
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const result = new Array<number>(count).fill(-1);
  const taken = new Set<number>();
  pairs.forEach(([, i, j]) => {
    if (result[i] !== -1 || taken.has(j)) return;
    result[i] = j;
    taken.add(j);
  });
  return result;
}

function aroundParent(parent: LaidOutNode, members: Member[], pattern: Exclude<MindmapArrangePattern, 'area'>, metrics: MindmapMetrics, targets: Targets) {
  const c = centerOf(parent);
  const gap = RING * metrics.hGap;
  const right = parent.x + parent.width + gap;
  const left = parent.x - gap;
  const byY = (list: Member[]) => [...list].sort((a, b) => a.at.y - b.at.y);
  const byX = (list: Member[]) => [...list].sort((a, b) => a.at.x - b.at.x);

  switch (pattern) {
    case 'right':
      return stack(byY(members), true, c.y, { side: 'start', at: right }, metrics.vGap * 2, targets);
    case 'left':
      return stack(byY(members), true, c.y, { side: 'end', at: left }, metrics.vGap * 2, targets);
    case 'above':
      return stack(byX(members), false, c.x, { side: 'end', at: parent.y - gap }, metrics.hGap, targets);
    case 'below':
      return stack(byX(members), false, c.x, { side: 'start', at: parent.y + parent.height + gap }, metrics.hGap, targets);
    case 'sides': {
      // Sida efter var noderna står; den större sidan lämnar över dem som står närmast mitten.
      const leftSide = members.filter((m) => m.at.x < c.x);
      const rightSide = members.filter((m) => m.at.x >= c.x);
      while (Math.abs(leftSide.length - rightSide.length) > 1) {
        const [from, to] = leftSide.length > rightSide.length ? [leftSide, rightSide] : [rightSide, leftSide];
        from.sort((a, b) => Math.abs(b.at.x - c.x) - Math.abs(a.at.x - c.x));
        to.push(from.pop()!);
      }
      stack(byY(leftSide), true, c.y, { side: 'end', at: left }, metrics.vGap * 2, targets);
      stack(byY(rightSide), true, c.y, { side: 'start', at: right }, metrics.vGap * 2, targets);
      return;
    }
    case 'corners': {
      // Hörnen medurs från uppe till vänster. Färre än fyra fyller hörnen i
      // den ordningen; fler fördelas jämnt (sex blir 2+1+2+1).
      const corners = [
        { sx: -1, sy: -1 },
        { sx: 1, sy: -1 },
        { sx: 1, sy: 1 },
        { sx: -1, sy: 1 },
      ];
      const used = corners.slice(0, Math.min(4, members.length));
      const capacity = used.map((_, k) => Math.floor(members.length / used.length) + (k < members.length % used.length ? 1 : 0));
      const point = (k: number) => ({ x: c.x + used[k].sx * (parent.width / 2 + gap), y: c.y + used[k].sy * (parent.height / 2 + gap) });
      const slots = used.flatMap((_, k) => Array.from({ length: capacity[k] }, () => k));
      const pick = assignGreedy(members.length, slots.length, (i, j) => {
        const p = point(slots[j]);
        return Math.hypot(members[i].at.x - p.x, members[i].at.y - p.y);
      });
      used.forEach((corner, k) => {
        const inCorner = byY(members.filter((_, i) => slots[pick[i]] === k));
        if (inCorner.length === 0) return;
        const height = inCorner.reduce((sum, m) => sum + m.branch.height, 0) + metrics.vGap * 2 * (inCorner.length - 1);
        // Stapeln står ovanför (eller under) föräldern, och i sidled utanför den.
        const along = corner.sy < 0 ? parent.y - gap - height / 2 : parent.y + parent.height + gap + height / 2;
        stack(inCorner, true, along, corner.sx < 0 ? { side: 'end', at: left } : { side: 'start', at: right }, metrics.vGap * 2, targets);
      });
      return;
    }
    case 'circle': {
      // Jämnt runt föräldern från rakt upp och medurs. Ordningen runt
      // cirkeln följer var noderna står, vriden så att de flyttas minst.
      const n = members.length;
      const slots = Array.from({ length: n }, (_, j) => -Math.PI / 2 + (j * 2 * Math.PI) / n);
      const size = { width: Math.max(...members.map((m) => m.box.width)), height: Math.max(...members.map((m) => m.box.height)) };
      const chord = n > 1
        ? Math.max(...slots.map((t, j) => apart(size, t + Math.PI / n, metrics.vGap * 2))) / (2 * Math.sin(Math.PI / n))
        : 0;
      const sorted = [...members].sort((a, b) => angleOf(c, a.at) - angleOf(c, b.at));
      let best = 0;
      let bestCost = Infinity;
      for (let k = 0; k < n; k += 1) {
        const cost = sorted.reduce((sum, m, i) => sum + angleDiff(angleOf(c, m.at), slots[(i + k) % n]), 0);
        if (cost < bestCost - 1e-9) {
          best = k;
          bestCost = cost;
        }
      }
      sorted.forEach((m, i) => {
        const t = slots[(i + best) % n];
        const r = Math.max(chord, reach(parent, t) + gap + reach(m.box, t));
        targets.set(m.node.id, { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) });
      });
      return;
    }
  }
}

/** Platserna i området: en rad, en kolumn eller ett rutnät efter områdets form. */
export function areaSlots(area: SelectionRect, count: number): Point[] {
  if (count === 0) return [];
  const aspect = area.width / Math.max(1, area.height);
  let cols: number;
  if (aspect >= 2.5) cols = count;
  else if (aspect <= 0.4) cols = 1;
  else cols = Math.min(count, Math.max(1, Math.round(Math.sqrt(count * aspect))));
  const rows = Math.ceil(count / cols);
  const slots: Point[] = [];
  for (let r = 0; r < rows; r += 1) {
    const inRow = r === rows - 1 ? count - cols * (rows - 1) : cols;
    for (let k = 0; k < inRow; k += 1) {
      slots.push({ x: area.x + ((k + 0.5) * area.width) / inRow, y: area.y + ((r + 0.5) * area.height) / rows });
    }
  }
  return slots;
}

/**
 * Var de markerade nodernas mitt ska hamna, i layoutens koordinater. Roten
 * följer bara med i ett område; en nod under en annan markerad följer sin gren.
 */
export function arrangeTargets(
  content: MindmapContent,
  ids: readonly string[],
  pattern: MindmapArrangePattern,
  layout: MindmapLayoutResult,
  area: SelectionRect | null = null,
  metrics: MindmapMetrics = MINDMAP_METRICS,
): Targets {
  const targets: Targets = new Map();
  const member = (id: string): Member | null => {
    const node = findNode(content.root, id);
    const box = layout.byId.get(id);
    return node && box ? { node, box, branch: branchBox(node, layout), at: centerOf(box) } : null;
  };
  const top = topLevelIds(content, ids);

  if (pattern === 'area') {
    if (!area) return targets;
    const members = top.map(member).filter((m): m is Member => !!m);
    const slots = areaSlots(area, members.length);
    const pick = assignGreedy(members.length, slots.length, (i, j) => Math.hypot(members[i].at.x - slots[j].x, members[i].at.y - slots[j].y));
    members.forEach((m, i) => targets.set(m.node.id, slots[pick[i]]));
    return targets;
  }

  const groups = new Map<string, Member[]>();
  top.forEach((id) => {
    if (id === content.root.id) return;
    const parentId = findParent(content.root, id)?.parent.id;
    const m = member(id);
    if (!parentId || !m || !layout.byId.has(parentId)) return;
    groups.set(parentId, [...(groups.get(parentId) ?? []), m]);
  });
  groups.forEach((members, parentId) => aroundParent(layout.byId.get(parentId)!, members, pattern, metrics, targets));
  return targets;
}

/**
 * Arrangerar de markerade: varje nod får den förskjutning som flyttar dess
 * mitt till platsen, och grenen följer med. `layout` är kartan som den står
 * (sidans layout). Samma dokument om ingen flyttas.
 */
export function arrange<T extends MindmapContent>(
  content: T,
  ids: readonly string[],
  pattern: MindmapArrangePattern,
  layout: MindmapLayoutResult,
  area: SelectionRect | null = null,
): T {
  let next = content;
  arrangeTargets(content, ids, pattern, layout, area).forEach((target, id) => {
    const box = layout.byId.get(id);
    if (!box) return;
    const at = centerOf(box);
    const delta = { dx: Math.round(target.x - at.x), dy: Math.round(target.y - at.y) };
    if (delta.dx === 0 && delta.dy === 0) return;
    if (id === next.root.id) {
      next = placeRoot(next, delta);
      return;
    }
    const node = findNode(next.root, id);
    if (!node) return;
    next = setOffset(next, id, { dx: (node.offset?.dx ?? 0) + delta.dx, dy: (node.offset?.dy ?? 0) + delta.dy }) as T;
  });
  return next;
}
