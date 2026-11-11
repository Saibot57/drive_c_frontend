import type { MindmapContent, MindmapSide } from '@/types/mindmap';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { findNode, findParent, rootChildSides, setOffset, sideOf, updateNode } from '@/utils/mindmap/mindmapTree';

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
    if (side && targetX * direction < 0) {
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
