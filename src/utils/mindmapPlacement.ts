import type { MindmapContent, MindmapSide } from '@/types/mindmap';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import type { MindmapNode } from '@/types/mindmap';
import { findNode, findParent, hasOffsets, rootChildSides, setOffset, sideOf, updateNode } from '@/utils/mindmap/mindmapTree';
import { topLevelIds } from '@/utils/mindmapSelection';

/*
 * Fri placering på Mindmap-sidan: vad som händer när en nod släpps på tom
 * yta. Noden (och dess gren) får en förskjutning från sin automatiska plats.
 * I layouten `both` får förskjutningen inte bära grenen över roten till
 * andra sidan; en gren direkt under roten byter då sida i stället, och en
 * djupare nod stannar vid rotens mitt.
 *
 * Planen: docs/plans/mindmap-sida.md, steg 5.
 */

type Layout = (content: MindmapContent) => MindmapLayoutResult;

/** Nodens mitt i x-led, räknat från rotens mitt. */
function centerFromRoot(layout: MindmapLayoutResult, rootId: string, id: string): { x: number; left: number; top: number } | null {
  const root = layout.byId.get(rootId);
  const node = layout.byId.get(id);
  if (!root || !node) return null;
  const rootX = root.x + root.width / 2;
  const rootY = root.y + root.height / 2;
  return { x: node.x + node.width / 2 - rootX, left: node.x - rootX, top: node.y - rootY };
}

const withSide = <T extends MindmapContent>(content: T, id: string, side: MindmapSide): T => ({
  ...content,
  root: updateNode(content.root, id, (node) => ({ ...node, side })),
});

/**
 * Flyttar noden `delta` px (vid zoom 1) från där den står nu. Resultatet är
 * en ny förskjutning, avrundad till hela pixlar. `layout` är sidans layout
 * (med dess textmätning), så att sidbytet kan räkna om var noden hamnar.
 * Ger `null` när noden inte går att flytta (roten, eller en nod som inte syns).
 */
export function placeNode<T extends MindmapContent>(
  content: T,
  id: string,
  delta: { dx: number; dy: number },
  layout: Layout,
): T | null {
  const rootId = content.root.id;
  const node = findNode(content.root, id);
  if (!node || id === rootId) return null;
  const before = centerFromRoot(layout(content), rootId, id);
  if (!before) return null;

  const current = node.offset ?? { dx: 0, dy: 0 };
  let next = { dx: current.dx + delta.dx, dy: current.dy + delta.dy };
  let result: MindmapContent = content;

  if (content.layout === 'both') {
    const side = sideOf(content, id);
    const direction = side === 'left' ? -1 : 1;
    const targetX = before.x + delta.dx;
    // Grenen byter sida bara när draget korsar rotens mitt. Med en flyttad
    // rot (del B i docs/plans/mindmap-placering.md) kan en gren redan stå på
    // andra sidan; den får stå kvar där utan att byta.
    if (side && targetX * direction < 0 && before.x * direction >= 0) {
      const isRootChild = findParent(content.root, id)?.parent.id === rootId;
      if (isRootChild) {
        // Grenen byter sida. Syskonen får sin sida sparad först, så att de
        // står kvar, och förskjutningen räknas om från den nya platsen så
        // att noden hamnar där den släpptes.
        const sides = rootChildSides(content);
        let switched: MindmapContent = content;
        content.root.children.forEach((child) => {
          const childSide = sides.get(child.id);
          if (child.id !== id && childSide && child.side !== childSide) switched = withSide(switched, child.id, childSide);
        });
        switched = setOffset(withSide(switched, id, side === 'left' ? 'right' : 'left'), id, null);
        const after = centerFromRoot(layout(switched), rootId, id);
        if (!after) return null;
        result = switched;
        next = { dx: before.left + delta.dx - after.left, dy: before.top + delta.dy - after.top };
      } else {
        // En djupare nod följer sin gren och stannar vid rotens mitt.
        next = { ...next, dx: next.dx - targetX };
      }
    }
  }

  return setOffset(result, id, { dx: Math.round(next.dx), dy: Math.round(next.dy) }) as T;
}

/* ── Del B i docs/plans/mindmap-placering.md ── */

type Delta = { dx: number; dy: number };

const rounded = (d: Delta): Delta => ({ dx: Math.round(d.dx), dy: Math.round(d.dy) });
const add = (a: Delta | undefined, b: Delta): Delta => ({ dx: (a?.dx ?? 0) + b.dx, dy: (a?.dy ?? 0) + b.dy });
const isZero = (d: Delta) => d.dx === 0 && d.dy === 0;

function withOffset(node: MindmapNode, offset: Delta): MindmapNode {
  if (!isZero(offset)) return { ...node, offset };
  if (node.offset === undefined) return node;
  const { offset: _offset, ...rest } = node;
  return rest as MindmapNode;
}

/**
 * Rotens förskjutning. Den delade `setOffset` vägrar roten (kortets
 * beteende); sidan flyttar roten ensam, och grenarna står kvar.
 */
export function setRootOffset<T extends MindmapContent>(content: T, offset: Delta | null): T {
  const next = withOffset(content.root, offset ? rounded(offset) : { dx: 0, dy: 0 });
  return next === content.root ? content : { ...content, root: next };
}

/** Flyttar roten `delta` px från där den står. */
export function placeRoot<T extends MindmapContent>(content: T, delta: Delta): T {
  return setRootOffset(content, add(content.root.offset, delta));
}

/**
 * Alt+dra: flyttar bara noden. Barnen får samma flytt åt andra hållet, så
 * att de står kvar där de stod. Grenen byter inte sida. Ger `null` för
 * roten och för en nod som inte finns.
 */
export function placeNodeAlone<T extends MindmapContent>(content: T, id: string, delta: Delta): T | null {
  if (id === content.root.id || !findNode(content.root, id)) return null;
  const d = rounded(delta);
  const back = { dx: -d.dx, dy: -d.dy };
  return {
    ...content,
    root: updateNode(content.root, id, (node) => ({
      ...withOffset(node, add(node.offset, d)),
      children: node.children.map((child) => withOffset(child, add(child.offset, back))),
    })),
  };
}

/** Det som ritas medan noden dras: samma regler som släppet, utan sidbyte. */
export function previewMove<T extends MindmapContent>(content: T, id: string, delta: Delta, alone: boolean): T {
  if (id === content.root.id) return placeRoot(content, delta);
  if (alone) return placeNodeAlone(content, id, delta) ?? content;
  const node = findNode(content.root, id);
  return node ? (setOffset(content, id, add(node.offset, delta)) as T) : content;
}

/** Rutnätets steg i px vid zoom 1. */
export const MINDMAP_GRID = 20;

/**
 * Den flytt som lägger nodens övre vänstra hörn på rutnätet. `from` är
 * hörnet före draget, räknat från rotens automatiska mitt, som rutnätet
 * utgår från.
 */
export function snapDelta(from: { x: number; y: number }, delta: Delta, size = MINDMAP_GRID): Delta {
  const snap = (value: number) => Math.round(value / size) * size;
  return { dx: snap(from.x + delta.dx) - from.x, dy: snap(from.y + delta.dy) - from.y };
}

/** Städa upp en gren: tar bort förskjutningen på noden och alla under den. */
export function clearBranchOffsets<T extends MindmapContent>(content: T, id: string): T {
  const target = findNode(content.root, id);
  if (!target) return content;
  const clear = (node: MindmapNode): MindmapNode => {
    const children = node.children.map(clear);
    const changed = children.some((child, i) => child !== node.children[i]);
    const base = withOffset(node, { dx: 0, dy: 0 });
    return changed ? { ...base, children } : base;
  };
  const cleared = clear(target);
  if (cleared === target) return content;
  return { ...content, root: id === content.root.id ? cleared : updateNode(content.root, id, () => cleared) };
}

/**
 * Finns det något att städa i kartan? Den delade `hasOffsets` räknar inte
 * roten, som kortet aldrig flyttar; sidan gör det.
 */
export function hasPlacement(content: MindmapContent): boolean {
  return content.root.offset !== undefined || hasOffsets(content);
}

/* ── Del A i docs/plans/mindmap-arrangera.md ── */

/**
 * Flyttar flera noder lika långt, var och en med sin gren. En nod under en
 * annan markerad flyttas inte två gånger. Roten flyttas ensam, som när den
 * dras. Ingen byter sida eller förälder.
 */
export function placeNodes<T extends MindmapContent>(content: T, ids: readonly string[], delta: Delta): T {
  const d = rounded(delta);
  if (isZero(d)) return content;
  return topLevelIds(content, ids).reduce<T>((current, id) => {
    if (id === current.root.id) return placeRoot(current, d);
    const node = findNode(current.root, id);
    return node ? (setOffset(current, id, add(node.offset, d)) as T) : current;
  }, content);
}

/** Det som ritas medan en eller flera noder dras. */
export function previewDrag<T extends MindmapContent>(
  content: T,
  move: { id: string; dx: number; dy: number; alone: boolean; group?: readonly string[] },
): T {
  return move.group ? placeNodes(content, move.group, move) : previewMove(content, move.id, move, move.alone);
}
