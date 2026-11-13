import type { MindmapContent, MindmapNode } from '@/types/mindmap';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { clearOffsets, findNode, findParent } from '@/utils/mindmap/mindmapTree';
import { dirForNewChild, refan, setDir } from '@/utils/mindmapDirections';
import { clearBranchOffsets, setRootOffset } from '@/utils/mindmapPlacement';

/*
 * Städa upp efter riktningen (docs/plans/mindmap-arrangera.md, del C).
 * Förskjutningarna tas bort som förut, och sedan får varje nod i grenen sin
 * plats uppifrån och ned: barnen till en nod med vald riktning (`childDir`)
 * ställs i en solfjäder åt den, en solfjäder som redan finns läggs om, och
 * ett barn utan vinkel hamnar bort från roten när föräldern står på andra
 * sidan om roten (beslut 19 och 20); annars där layouten sätter det. En karta utan riktningar och utan
 * noder på fel sida städas exakt som förut.
 */

type Layout<T> = (content: T) => MindmapLayoutResult;

const baseOf = (node: MindmapNode): number | null => (node.dir && 'angle' in node.dir ? node.dir.base ?? node.dir.angle : null);

/**
 * Ger barnen `ids` under `parentId` sin plats. `layout` är kartan som den
 * står efter nivån ovanför.
 */
function placeChildren<T extends MindmapContent>(content: T, parentId: string, ids: readonly string[], layout: MindmapLayoutResult): T {
  const parent = findNode(content.root, parentId);
  if (!parent) return content;
  const kids = parent.children.filter((child) => ids.includes(child.id));
  if (kids.length === 0) return content;
  let next = content;
  const bases = new Set<number>();

  if (parent.childDir) {
    // Den valda riktningen: alla barnen i en solfjäder åt den.
    const base = parent.childDir.angle;
    kids.forEach((kid) => {
      next = setDir(next, kid.id, { angle: base, base });
    });
    bases.add(base);
  } else {
    // Barn utan vinkel: arvet, eller bort från roten, med samma regel som för
    // ett nytt barn. En sida (`{ side }`) räknas om: den kom av regeln och
    // gällde där föräldern stod före städningen.
    const loose = kids.filter((kid) => !kid.dir || 'side' in kid.dir);
    const dir = loose.length > 0 ? dirForNewChild(next, parentId, layout) : null;
    const placed = dir && 'angle' in dir ? { angle: dir.angle, base: dir.angle } : dir;
    loose.forEach((kid) => {
      next = setDir(next, kid.id, placed);
    });
    findNode(next.root, parentId)!.children.forEach((child) => {
      const base = ids.includes(child.id) ? baseOf(child) : null;
      if (base !== null) bases.add(base);
    });
  }
  // Solfjädrarna läggs om. Bara nodernas storlek läses ur layouten, och den
  // ändras inte av riktningarna.
  bases.forEach((base) => {
    next = refan(next, parentId, base, layout);
  });
  return next;
}

/**
 * Går igenom grenen nivå för nivå och ger barnen sin plats.
 * `first` är nivån överst: förälder och de barn under den som städas.
 */
function placeLevels<T extends MindmapContent>(content: T, first: { parentId: string; ids: string[] }[], layoutOf: Layout<T>): T {
  let next = content;
  let level = first;
  while (level.length > 0) {
    const layout = layoutOf(next);
    level.forEach(({ parentId, ids }) => {
      next = placeChildren(next, parentId, ids, layout);
    });
    // Nästa nivå: barnen till noderna som just fick sin plats, om de syns.
    level = level.flatMap(({ ids }) => ids
      .map((id) => findNode(next.root, id))
      .filter((node): node is MindmapNode => !!node && !node.collapsed && node.children.length > 0)
      .map((node) => ({ parentId: node.id, ids: node.children.map((child) => child.id) })));
  }
  return next;
}

/** Städa upp grenen: noden och allt under den. På roten städas hela kartan. */
export function tidyBranch<T extends MindmapContent>(content: T, id: string, layoutOf: Layout<T>): T {
  if (id === content.root.id) return tidyAll(content, layoutOf);
  const parent = findParent(content.root, id)?.parent;
  if (!parent) return content;
  return placeLevels(clearBranchOffsets(content, id), [{ parentId: parent.id, ids: [id] }], layoutOf);
}

/** Städa upp hela kartan, också roten. */
export function tidyAll<T extends MindmapContent>(content: T, layoutOf: Layout<T>): T {
  const cleared = setRootOffset(clearOffsets(content) as T, null);
  return placeLevels(cleared, [{ parentId: cleared.root.id, ids: cleared.root.children.map((child) => child.id) }], layoutOf);
}

/** Finns det riktningar i kartan, som Städa upp kan lägga om? */
export function hasDirections(node: MindmapNode): boolean {
  return node.childDir !== undefined || node.dir !== undefined || node.children.some(hasDirections);
}
