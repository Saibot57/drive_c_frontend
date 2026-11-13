import type { MindmapAnchor, MindmapEdgeShape, MindmapIcon } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapAction } from '@/utils/mindmap/mindmapKeys';
import { setIcon, setOffset } from '@/utils/mindmap/mindmapTree';
import { setBranchPaint, setNodePaint, type MindmapPaintChoice } from '@/utils/mindmapPaint';
import { clearBranchOffsets, setRootOffset } from '@/utils/mindmapPlacement';
import { resetEdgeStyle, setEdgeAnchor, setEdgeShape } from '@/utils/mindmapRouting';
import { applyToNodes, removeNodes, toggleCollapseNodes, topLevelIds } from '@/utils/mindmapSelection';

/*
 * Det som går att göra med flera markerade på en gång
 * (docs/plans/mindmap-arrangera.md, beslut 5 och 6). Varje handling ger
 * ett nytt dokument, som kartan sparar som ett ångra-steg.
 */

export type MindmapGroupNodeAction =
  | { type: 'paint'; choice: MindmapPaintChoice | null; wholeBranch: boolean }
  | { type: 'icon'; icon: MindmapIcon | null }
  | { type: 'toggleCollapse' }
  | { type: 'tidy' }
  | { type: 'resetOffset' }
  | { type: 'remove' };

export type MindmapGroupEdgeAction =
  | { type: 'shape'; shape: MindmapEdgeShape | null }
  | { type: 'anchor'; end: 'from' | 'to'; side: MindmapAnchor | null }
  | { type: 'reset' };

/**
 * En handling på de markerade noderna. `keep` är grenens rot i grenvyn, som
 * inte tas bort. `focusId` sätts när markerade noder försvunnit.
 */
export function groupNodeAction(
  doc: MindmapDoc,
  ids: readonly string[],
  action: MindmapGroupNodeAction,
  keep: string | null = null,
): { doc: MindmapDoc; focusId?: string } | null {
  let next: MindmapDoc;
  switch (action.type) {
    case 'paint':
      next = applyToNodes(doc, ids, (d, id) =>
        (action.wholeBranch ? setBranchPaint(d as MindmapDoc, id, action.choice) : setNodePaint(d as MindmapDoc, id, action.choice)));
      break;
    case 'icon':
      next = applyToNodes(doc, ids, (d, id) => setIcon(d, id, action.icon));
      break;
    case 'toggleCollapse':
      next = toggleCollapseNodes(doc, ids);
      break;
    case 'tidy':
      next = topLevelIds(doc, ids).reduce<MindmapDoc>((d, id) => clearBranchOffsets(d, id), doc);
      break;
    case 'resetOffset':
      next = applyToNodes(doc, ids, (d, id) => (id === d.root.id ? setRootOffset(d, null) : setOffset(d, id, null)));
      break;
    case 'remove':
      return removeNodes(doc, ids, keep);
  }
  return next === doc ? null : { doc: next };
}

/** En handling på de markerade linjerna. Linjen heter efter noden den går till. */
export function groupEdgeAction(doc: MindmapDoc, ids: readonly string[], action: MindmapGroupEdgeAction): MindmapDoc | null {
  const next = applyToNodes(doc, ids, (d, id) => {
    if (action.type === 'shape') return setEdgeShape(d, id, action.shape);
    if (action.type === 'anchor') return setEdgeAnchor(d, id, action.end, action.side);
    return resetEdgeStyle(d, id);
  });
  return next === doc ? null : next;
}

/**
 * Kartans tangenthandlingar som gäller alla markerade: färg (Alt+siffra),
 * ta bort och fäll ihop. Allt annat gäller den markerade noden.
 */
export function groupActionFor(action: MindmapAction): MindmapGroupNodeAction | null {
  if (action.type === 'color') return { type: 'paint', choice: action.color ? { color: action.color } : null, wholeBranch: false };
  if (action.type === 'remove' || action.type === 'toggleCollapse') return { type: action.type };
  return null;
}
