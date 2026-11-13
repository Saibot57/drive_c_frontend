import type { MindmapContent, MindmapDir, MindmapNode, MindmapSide } from '@/types/mindmap';
import {
  MINDMAP_METRICS,
  type LaidOutEdge,
  type LaidOutNode,
  type MindmapLayoutResult,
  type MindmapMetrics,
} from '@/utils/mindmap/mindmapLayout';
import { findNode, findParent, normalizeAngle, setOffset, sideOf, updateNode } from '@/utils/mindmap/mindmapTree';

/*
 * Riktningen för nya barn på Mindmap-sidan (docs/plans/mindmap-arrangera.md,
 * del B). Ett barn med `dir` står åt sin vinkel från föräldern, eller i en
 * kolumn på en sida, räknat från förälderns verkliga plats. Solfjädern
 * räknas när ett barn skapas (`placeNewNode`), som vinklar på barnen; då
 * flyttar ingen nod när ett syskon byter storlek. Steget körs på
 * sidans layout efter den delade (`finishMindmapLayout`); den delade
 * layouten och workspace-kortet rörs inte. En karta utan `dir` går inte
 * igenom steget och blir exakt som förut.
 */

type Box = { x: number; y: number; width: number; height: number };

/** Den största öppningen i en solfjäder, i radianer. */
const MAX_FAN = (160 * Math.PI) / 180;
/** Det största steget mellan två syskon i en solfjäder; behövs mer plats går den längre ut. */
const MAX_STEP = (22 * Math.PI) / 180;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Sidan en riktning pekar åt: vänster om den har en del åt vänster. */
export function sideOfDir(dir: MindmapDir): MindmapSide {
  if ('side' in dir) return dir.side;
  return Math.cos(rad(dir.angle)) < -1e-9 ? 'left' : 'right';
}

/** Avståndet från rutans mitt till dess kant åt vinkeln `theta` (radianer). */
function reach(box: Box, theta: number): number {
  const cx = Math.abs(Math.cos(theta));
  const cy = Math.abs(Math.sin(theta));
  const byX = cx > 1e-9 ? box.width / 2 / cx : Infinity;
  const byY = cy > 1e-9 ? box.height / 2 / cy : Infinity;
  return Math.min(byX, byY);
}

/**
 * Hur långt isär två rutor av storleken `size` minst måste stå tvärs över
 * vinkeln `theta` för att inte mötas, med luften `gap`: det räcker att de är
 * isär i sidled eller i höjdled.
 */
function apart(size: { width: number; height: number }, theta: number, gap: number): number {
  const ux = Math.abs(Math.sin(theta));
  const uy = Math.abs(Math.cos(theta));
  return Math.min(ux > 1e-9 ? (size.width + gap) / ux : Infinity, uy > 1e-9 ? (size.height + gap) / uy : Infinity);
}

function hasDirs(node: MindmapNode): boolean {
  return node.dir !== undefined || node.children.some(hasDirs);
}

/**
 * Lägger barnen med `dir` på sina platser och speglar det som växer åt fel
 * håll under dem. Allt flyttas med sin gren; barnens egna förskjutningar
 * står kvar ovanpå platsen. Samma layout tillbaka om ingen nod har `dir`.
 */
export function applyDirections(
  layout: MindmapLayoutResult,
  content: Pick<MindmapContent, 'root'>,
  metrics: MindmapMetrics = MINDMAP_METRICS,
): MindmapLayoutResult {
  if (!hasDirs(content.root)) return layout;
  const boxes = new Map<string, LaidOutNode>(layout.nodes.map((n) => [n.id, { ...n }]));
  const edges: LaidOutEdge[] = layout.edges.map((e) => ({ ...e }));
  const moved = new Set<string>();
  const visibleKids = (node: MindmapNode) => (node.collapsed ? [] : node.children.filter((child) => boxes.has(child.id)));

  /** Flyttar noden och allt synligt under den, med linjerna. */
  const shift = (node: MindmapNode, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    const ids = new Set<string>();
    const walk = (n: MindmapNode) => {
      const box = boxes.get(n.id);
      if (!box) return;
      ids.add(n.id);
      box.x += dx;
      box.y += dy;
      visibleKids(n).forEach(walk);
    };
    walk(node);
    edges.forEach((e) => {
      if (ids.has(e.fromId)) {
        e.x1 += dx;
        e.y1 += dy;
      }
      if (ids.has(e.toId)) {
        e.x2 += dx;
        e.y2 += dy;
      }
    });
  };

  /** Flyttar noden så att dess övre vänstra hörn hamnar på (x, y) plus dess förskjutning. */
  const moveTo = (node: MindmapNode, x: number, y: number, side: MindmapSide) => {
    const box = boxes.get(node.id)!;
    shift(node, x + (node.offset?.dx ?? 0) - box.x, y + (node.offset?.dy ?? 0) - box.y);
    box.side = side;
    moved.add(node.id);
  };

  const heights = new Map<string, number>();
  const heightOf = (node: MindmapNode): number => {
    const cached = heights.get(node.id);
    if (cached !== undefined) return cached;
    const kids = visibleKids(node);
    const own = boxes.get(node.id)!.height;
    const total = kids.length === 0
      ? own
      : Math.max(own, kids.reduce((sum, kid) => sum + heightOf(kid), 0) + metrics.vGap * (kids.length - 1));
    heights.set(node.id, total);
    return total;
  };

  const placeColumn = (parent: LaidOutNode, kids: MindmapNode[], side: MindmapSide) => {
    const total = kids.reduce((sum, kid) => sum + heightOf(kid), 0) + metrics.vGap * (kids.length - 1);
    let top = parent.y + parent.height / 2 - total / 2;
    kids.forEach((kid) => {
      const box = boxes.get(kid.id)!;
      const h = heightOf(kid);
      const x = side === 'right' ? parent.x + parent.width + metrics.hGap : parent.x - metrics.hGap - box.width;
      moveTo(kid, x, top + h / 2 - box.height / 2, side);
      top += h + metrics.vGap;
    });
  };

  /** Barnet åt sin vinkel, med luften `hGap` mellan rutorna. */
  const placeRay = (parent: LaidOutNode, kid: MindmapNode, angle: number, gap = metrics.hGap) => {
    const box = boxes.get(kid.id)!;
    const t = rad(angle);
    const r = reach(parent, t) + gap + reach(box, t);
    const x = parent.x + parent.width / 2 + r * Math.cos(t) - box.width / 2;
    const y = parent.y + parent.height / 2 + r * Math.sin(t) - box.height / 2;
    moveTo(kid, x, y, Math.cos(t) < -1e-9 ? 'left' : 'right');
  };

  /** Speglar barnet kring förälderns mitt: det växte åt fel håll. */
  const mirror = (parent: LaidOutNode, kid: MindmapNode, side: MindmapSide) => {
    const box = boxes.get(kid.id)!;
    const ownDx = kid.offset?.dx ?? 0;
    const autoX = box.x - ownDx;
    const x = 2 * (parent.x + parent.width / 2) - (autoX + box.width);
    shift(kid, x + ownDx - box.x, 0);
    box.side = side;
    moved.add(kid.id);
  };

  /** `side`: åt vilket håll grenen växer, ärvt från närmaste `dir` ovanför; `null` följer layouten. */
  const visit = (node: MindmapNode, side: MindmapSide | null) => {
    const parent = boxes.get(node.id)!;
    const kids = visibleKids(node);
    const columns: Record<MindmapSide, MindmapNode[]> = { left: [], right: [] };
    kids.forEach((kid) => {
      if (kid.dir && 'angle' in kid.dir) placeRay(parent, kid, kid.dir.angle, kid.dir.gap);
      else if (kid.dir) columns[kid.dir.side].push(kid);
      else if (side && boxes.get(kid.id)!.side !== side) mirror(parent, kid, side);
    });
    (['left', 'right'] as const).forEach((s) => {
      if (columns[s].length > 0) placeColumn(parent, columns[s], s);
    });
    kids.forEach((kid) => visit(kid, kid.dir ? sideOfDir(kid.dir) : side));
  };
  visit(content.root, null);

  // Linjen till en nod som fått en ny plats går mellan de sidor som vetter mot varandra.
  edges.forEach((e) => {
    if (!moved.has(e.toId)) return;
    const from = boxes.get(e.fromId);
    const to = boxes.get(e.toId);
    if (!from || !to) return;
    const left = to.x + to.width / 2 < from.x + from.width / 2;
    e.x1 = left ? from.x : from.x + from.width;
    e.y1 = from.y + from.height / 2;
    e.x2 = left ? to.x + to.width : to.x;
    e.y2 = to.y + to.height / 2;
  });

  const all = layout.nodes.map((n) => boxes.get(n.id)!);
  const minX = Math.min(...all.map((n) => n.x));
  const minY = Math.min(...all.map((n) => n.y));
  const maxX = Math.max(...all.map((n) => n.x + n.width));
  const maxY = Math.max(...all.map((n) => n.y + n.height));
  const dx = metrics.margin - minX;
  const dy = metrics.margin - minY;
  const nodes = all.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
  return {
    nodes,
    edges: edges.map((e) => ({ ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy })),
    width: Math.ceil(maxX - minX + 2 * metrics.margin),
    height: Math.ceil(maxY - minY + 2 * metrics.margin),
    byId: new Map(nodes.map((n) => [n.id, n])),
  };
}

/* ── Nya barn ── */

/**
 * Var ett nytt barn till `parentId` ska stå (planens avsnitt 2.1): bara
 * nästa barn (`once`), förälderns inställning, närmaste riktning ovanför
 * (arvet), och annars bort från roten när föräldern står på andra sidan om
 * roten än sin gren. `null`: där layouten sätter det, som förut.
 * `content` och `layout` är det som visas (i grenvyn är grenens rot roten).
 */
export function dirForNewChild(
  content: MindmapContent,
  parentId: string,
  layout: MindmapLayoutResult,
  once: number | null = null,
): MindmapDir | null {
  if (once !== null) return { angle: normalizeAngle(once) };
  const parent = findNode(content.root, parentId);
  if (!parent) return null;
  if (parent.childDir) return { angle: parent.childDir.angle };
  const rootId = content.root.id;
  if (parentId === rootId) return null;
  for (let node: MindmapNode | null = parent; node && node.id !== rootId; node = findParent(content.root, node.id)?.parent ?? null) {
    if (node.dir) return 'angle' in node.dir ? { angle: node.dir.base ?? node.dir.angle } : { side: node.dir.side };
  }
  const box = layout.byId.get(parentId);
  const root = layout.byId.get(rootId);
  const side = sideOf(content, parentId);
  if (!box || !root || !side) return null;
  const offCenter = box.x + box.width / 2 - (root.x + root.width / 2);
  if (side === 'right' && offCenter < 0) return { side: 'left' };
  if (side === 'left' && offCenter > 0) return { side: 'right' };
  return null;
}

/** Nodens `dir`; `null` tar bort den. */
export function setDir<T extends MindmapContent>(content: T, id: string, dir: MindmapDir | null): T {
  if (!findNode(content.root, id) || id === content.root.id) return content;
  return {
    ...content,
    root: updateNode(content.root, id, (node) => {
      if (dir) return { ...node, dir };
      if (node.dir === undefined) return node;
      const { dir: _dir, ...rest } = node;
      return rest as MindmapNode;
    }),
  };
}

/** Riktningen för nodens nya barn, i grader; `null` tar bort den. */
export function setChildDir<T extends MindmapContent>(content: T, id: string, angle: number | null): T {
  if (!findNode(content.root, id)) return content;
  return {
    ...content,
    root: updateNode(content.root, id, (node) => {
      if (angle !== null) return { ...node, childDir: { angle: normalizeAngle(angle) } };
      if (node.childDir === undefined) return node;
      const { childDir: _childDir, ...rest } = node;
      return rest as MindmapNode;
    }),
  };
}

/**
 * En solfjäder med `boxes` åt `base` (grader): vinklarna, symmetriskt kring
 * riktningen och medurs i ordningen, och luften `gap` mellan föräldern och
 * barnen. Steget är högst 22° och hela solfjädern högst 160°; behöver
 * rutorna mer plats går solfjädern längre ut, så att de inte möts.
 */
export function fanAngles(parent: Box, boxes: Box[], base: number, metrics: MindmapMetrics = MINDMAP_METRICS): { angles: number[]; gap: number } {
  if (boxes.length <= 1) return { angles: boxes.map(() => normalizeAngle(base)), gap: metrics.hGap };
  const theta = rad(base);
  const size = { width: Math.max(...boxes.map((box) => box.width)), height: Math.max(...boxes.map((box) => box.height)) };
  const inner = reach(parent, theta) + Math.max(...boxes.map((box) => reach(box, theta)));
  const step = Math.min(MAX_STEP, MAX_FAN / (boxes.length - 1));
  const at = (i: number) => theta + (i - (boxes.length - 1) / 2) * step;
  // Två grannar på bågen står 2r·sin(steg/2) isär, tvärs över vinkeln mitt
  // emellan dem; det ska räcka för att rutorna inte möts.
  const needed = Math.max(...boxes.slice(1).map((_, i) => apart(size, (at(i) + at(i + 1)) / 2, metrics.vGap)));
  const radius = Math.max(inner + metrics.hGap, needed / (2 * Math.sin(step / 2)));
  return {
    angles: boxes.map((_, i) => normalizeAngle((at(i) * 180) / Math.PI)),
    gap: Math.round(radius - inner),
  };
}

/** Riktningen syskonen i en solfjäder delar. */
const baseOf = (dir: MindmapDir | undefined): number | null => (dir && 'angle' in dir ? dir.base ?? dir.angle : null);

/**
 * Lägger syskonen åt `base` under `parentId` i en solfjäder igen: de som
 * står på sin plats (ingen förskjutning) och `include`, som alltid räknas.
 * Ett draget syskon behåller sin vinkel och står kvar (beslut 14).
 */
export function refan<T extends MindmapContent>(
  content: T,
  parentId: string,
  base: number,
  layout: MindmapLayoutResult,
  include: readonly string[] = [],
): T {
  const parent = findNode(content.root, parentId);
  const parentBox = layout.byId.get(parentId);
  if (!parent || !parentBox) return content;
  const group = parent.children.filter((child) =>
    layout.byId.has(child.id) && baseOf(child.dir) === base && (!child.offset || include.includes(child.id)));
  const fan = fanAngles(parentBox, group.map((child) => layout.byId.get(child.id)!), base);
  return group.reduce<T>((c, child, i) =>
    setDir(c, child.id, group.length > 1 ? { angle: fan.angles[i], base, gap: fan.gap } : { angle: fan.angles[i], base }), content);
}

/**
 * En ny nod `id` (i `after`) får sin riktning. Åt en vinkel fördelas
 * solfjädern om; åt en sida står syskon som man själv dragit (de har en
 * förskjutning) kvar där de stod (beslut 14). `layoutOf` är sidans layout.
 */
export function placeNewNode<T extends MindmapContent>(
  before: T,
  after: T,
  id: string,
  dir: MindmapDir | null,
  layoutOf: (content: T) => MindmapLayoutResult,
): T {
  if (!dir) return after;
  const parent = findParent(after.root, id)?.parent;
  if ('angle' in dir) {
    const base = normalizeAngle(dir.base ?? dir.angle);
    const next = setDir(after, id, { angle: base, base });
    return parent ? refan(next, parent.id, base, layoutOf(next)) : next;
  }
  let next = setDir(after, id, dir);
  const dragged = parent?.children.filter((child) => child.id !== id && child.offset) ?? [];
  if (dragged.length === 0) return next;
  // Lägena räknas från rotens automatiska mitt: kartans marginal flyttar allt när kartan växer.
  const at = (layout: MindmapLayoutResult, content: T, nodeId: string) => {
    const box = layout.byId.get(nodeId);
    const root = layout.byId.get(content.root.id);
    if (!box || !root) return null;
    const off = content.root.offset ?? { dx: 0, dy: 0 };
    return { x: box.x - (root.x + root.width / 2 - off.dx), y: box.y - (root.y + root.height / 2 - off.dy) };
  };
  const was = layoutOf(before);
  const now = layoutOf(next);
  const placed = next;
  dragged.forEach((child) => {
    const a = at(was, before, child.id);
    const b = at(now, placed, child.id);
    if (!a || !b || (a.x === b.x && a.y === b.y)) return;
    const offset = child.offset!;
    next = setOffset(next, child.id, { dx: Math.round(offset.dx + a.x - b.x), dy: Math.round(offset.dy + a.y - b.y) }) as T;
  });
  return next;
}

/**
 * Tar bort `dir` på noder som fått en annan förälder: platsen gällde den
 * gamla. Nodens `childDir` står kvar. Samma dokument när inget ändras.
 */
export function pruneDirs<T extends MindmapContent>(prev: MindmapContent, next: T): T {
  const parents = new Map<string, string>();
  const collect = (node: MindmapNode) => node.children.forEach((child) => {
    parents.set(child.id, node.id);
    collect(child);
  });
  collect(prev.root);
  let result = next;
  const walk = (node: MindmapNode) => node.children.forEach((child) => {
    const was = parents.get(child.id);
    if (child.dir && was !== undefined && was !== node.id) result = setDir(result, child.id, null);
    walk(child);
  });
  walk(next.root);
  return result;
}

/** Vinkeln från `from` mot `to` i grader, 0 åt höger och 90 nedåt. */
export function angleTo(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return normalizeAngle((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);
}

export type MindmapDirectionKey = 'set' | 'once';

/**
 * Alt+R väljer riktning för nodens nya barn, Alt+Shift+R bara för nästa.
 * Läses med `e.code`: Alt+R ger ett specialtecken på Mac.
 */
export function resolveDirectionKey(e: { code: string; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): MindmapDirectionKey | null {
  if (e.code !== 'KeyR' || !e.altKey || e.ctrlKey || e.metaKey) return null;
  return e.shiftKey ? 'once' : 'set';
}
