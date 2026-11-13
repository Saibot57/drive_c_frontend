import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapAction } from '@/utils/mindmap/mindmapKeys';
import { findNode, findParent, setOffset, sideOf } from '@/utils/mindmap/mindmapTree';

/*
 * "Visa bara grenen" på Mindmap-sidan: en nod visas som rot och resten av
 * kartan göms. Det är ett läge i vyn; dokumentet rörs inte.
 *
 * Allt som ritar (layouten, tvärlänkarnas geometri, minikartan, exporten)
 * får grenens dokument från `branchDoc`. Allt som ändrar kartan arbetar på
 * hela dokumentet med nodens id, som förut.
 *
 * Planen: docs/plans/mindmap-presentation.md, del 8a.
 */

/**
 * Grenens rot, om grenvyn gäller: noden finns och är inte kartans rot.
 * Annars `null`, och hela kartan visas.
 */
export function branchRootId(doc: MindmapDoc, wanted: string | null): string | null {
  if (!wanted || wanted === doc.root.id) return null;
  return findNode(doc.root, wanted) ? wanted : null;
}

/** Roten i det som visas: grenens rot, eller kartans. */
export function viewRootOf(doc: MindmapDoc, branchId: string | null): MindmapNode {
  const id = branchRootId(doc, branchId);
  return (id && findNode(doc.root, id)) || doc.root;
}

/** Sant om noden finns i det som visas. */
export function inBranch(doc: MindmapDoc, branchId: string | null, id: string): boolean {
  return findNode(viewRootOf(doc, branchId), id) !== null;
}

/** Noden själv om den visas, annars rotens id i det som visas. */
export function clampToBranch(doc: MindmapDoc, branchId: string | null, id: string | null): string {
  const root = viewRootOf(doc, branchId);
  return id && findNode(root, id) ? id : root.id;
}

/** Sant om noden är ett barn direkt under roten i det som visas. */
export function isViewRootChild(doc: MindmapDoc, branchId: string | null, id: string): boolean {
  return findParent(doc.root, id)?.parent.id === viewRootOf(doc, branchId).id;
}

/**
 * Dokumentet som ritas när bara grenen visas. Grenen ligger kvar på sin
 * sida om kartans rot, så att förskjutningar och pilar betyder samma sak som
 * i hela kartan: barnen får grenens sida och layouten blir `both`, där sidan
 * gäller. Rotens egen förskjutning, hopfällning, sida och plats (`dir`) tas
 * bort; som rot har den ingen av dem. Bara tvärlänkar med båda ändar i grenen följer med.
 *
 * Finns noden inte, eller är den kartans rot, kommer samma dokument tillbaka.
 */
export function branchDoc(doc: MindmapDoc, branchId: string | null): MindmapDoc {
  const id = branchRootId(doc, branchId);
  if (!id) return doc;
  const node = findNode(doc.root, id);
  if (!node) return doc;

  const side = sideOf(doc, id) ?? 'right';
  // Grenens rot har ingen förälder i vyn: platsen (`dir`) gäller inte där.
  const { offset: _offset, collapsed: _collapsed, side: _side, dir: _dir, ...rest } = node;
  const root: MindmapNode = { ...rest, children: node.children.map((child) => ({ ...child, side })) };

  const result: MindmapDoc = { ...doc, root, layout: 'both' };
  const links = (doc.crossLinks ?? []).filter((link) => findNode(root, link.from) && findNode(root, link.to));
  if (links.length > 0) result.crossLinks = links;
  else delete result.crossLinks;
  return result;
}

/* ── Tangenter och handlingar ── */

export interface BranchKeyInput {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/**
 * Alt+Enter växlar grenvyn för den markerade noden. Esc visar hela kartan
 * igen, men bara när en gren visas; annars är Esc kartans egen ("lämna").
 */
export function resolveBranchKey(e: BranchKeyInput, active: boolean): 'toggle' | 'exit' | null {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return null;
  if (e.altKey) return e.key === 'Enter' ? 'toggle' : null;
  return active && e.key === 'Escape' ? 'exit' : null;
}

/**
 * Vad en handling blir när den markerade noden är grenens rot. Den beter sig
 * som kartans rot: Enter ger ett barn, och den går inte att flytta, dra in,
 * fälla ihop, ta bort eller klippa ut. Det görs i hela kartan.
 *
 * `ignore`: gör ingenting. `refuse`: gör ingenting och säg varför.
 */
export function branchRootAction(action: MindmapAction): MindmapAction | 'ignore' | 'refuse' {
  switch (action.type) {
    case 'addSibling':
      return { type: 'addChild' };
    case 'indent':
    case 'outdent':
    case 'move':
    case 'toggleCollapse':
      return 'ignore';
    case 'remove':
    case 'cut':
      return 'refuse';
    default:
      return action;
  }
}

export const BRANCH_ROOT_REFUSAL = 'Det är grenens rot. Visa hela kartan (Esc) för att ta bort eller klippa ut den.';

/**
 * Flyttar noden `delta` px från där den står, utan hela kartans regler om
 * sidor. Används i grenvyn när noden inte syns i hela kartan (en förfader är
 * hopfälld) och placeNode därför inte kan räkna.
 */
export function offsetBy(doc: MindmapDoc, id: string, delta: { dx: number; dy: number }): MindmapDoc | null {
  const node = findNode(doc.root, id);
  if (!node || id === doc.root.id) return null;
  const current = node.offset ?? { dx: 0, dy: 0 };
  return setOffset(doc, id, {
    dx: Math.round(current.dx + delta.dx),
    dy: Math.round(current.dy + delta.dy),
  }) as MindmapDoc;
}
