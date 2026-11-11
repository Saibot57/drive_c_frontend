import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { findNode, findParent } from '@/utils/mindmap/mindmapTree';
import type { MindmapRect, MindmapSize, MindmapView } from '@/utils/mindmapViewport';

/*
 * Presentationsläget på Mindmap-sidan: kartan stegas fram gren för gren.
 * Allt här är rena funktioner över trädet. Läget har en egen, lokal
 * hopfällning (`expanded`); dokumentet ändras aldrig.
 *
 * Ett steg fäller ut nästa gren i läsordning (djupet först). Noder utan barn
 * stegas inte en och en: de kommer fram med sin förälder. Rotens barn syns
 * från början.
 *
 * Planen: docs/plans/mindmap-presentation.md, del 8b.
 */

export interface PresentState {
  /** Noderna vars barn visas, i den ordning de fälldes ut. Roten står inte här; dess barn syns alltid. */
  expanded: string[];
  /** Noden som pekas ut. */
  current: string;
}

/** Alla noder i läsordning: en nod, sedan dess barn, uppifrån och ned. */
function preorder(root: MindmapNode): MindmapNode[] {
  const result: MindmapNode[] = [];
  const walk = (node: MindmapNode) => {
    result.push(node);
    node.children.forEach(walk);
  };
  walk(root);
  return result;
}

/** Noderna som går att fälla ut: alla med barn utom roten, i läsordning. */
function branchIds(root: MindmapNode): string[] {
  return preorder(root).filter((node) => node.id !== root.id && node.children.length > 0).map((node) => node.id);
}

/** Förfäderna som behöver vara utfällda för att noden ska synas (roten räknas inte). */
function ancestorsOf(root: MindmapNode, id: string): string[] {
  const result: string[] = [];
  let at = findParent(root, id)?.parent;
  while (at && at.id !== root.id) {
    result.push(at.id);
    at = findParent(root, at.id)?.parent;
  }
  return result;
}

const withExpanded = (root: MindmapNode, state: PresentState, id: string): string[] => {
  const next = [...state.expanded];
  [...ancestorsOf(root, id).reverse(), id].forEach((item) => {
    if (!next.includes(item)) next.push(item);
  });
  return next;
};

const withoutBranch = (root: MindmapNode, state: PresentState, id: string): string[] => {
  const node = findNode(root, id);
  const gone = new Set(node ? preorder(node).map((item) => item.id) : [id]);
  return state.expanded.filter((item) => !gone.has(item));
};

export function presentStart(root: MindmapNode): PresentState {
  return { expanded: [], current: root.id };
}

/**
 * Nästa steg: fäller ut nästa gren efter den utpekade noden och pekar ut
 * den. Är allt efter redan utfällt tas den första som är kvar. När allt är
 * utfällt kommer samma läge tillbaka.
 */
export function presentNext(root: MindmapNode, state: PresentState): PresentState {
  const order = preorder(root).map((node) => node.id);
  const at = Math.max(0, order.indexOf(state.current));
  const left = branchIds(root).filter((id) => !state.expanded.includes(id));
  if (left.length === 0) return state;
  const target = left.find((id) => order.indexOf(id) >= at) ?? left[0];
  return { expanded: withExpanded(root, state, target), current: target };
}

/**
 * Ett steg tillbaka: fäller ihop den utpekade grenen (eller den senaste före
 * den) och pekar ut grenen före. Motsatsen till presentNext när man stegat
 * rakt fram.
 */
export function presentPrev(root: MindmapNode, state: PresentState): PresentState {
  const order = preorder(root).map((node) => node.id);
  const index = (id: string) => order.indexOf(id);
  const open = state.expanded.filter((id) => index(id) >= 0);
  if (open.length === 0) return state.current === root.id && state.expanded.length === 0 ? state : presentStart(root);

  const at = Math.max(0, index(state.current));
  const latest = (ids: string[]) => ids.reduce<string | null>((best, id) => (best === null || index(id) > index(best) ? id : best), null);
  const target = open.includes(state.current)
    ? state.current
    : latest(open.filter((id) => index(id) <= at)) ?? latest(open)!;

  const expanded = withoutBranch(root, { ...state, expanded: open }, target);
  const before = latest(expanded.filter((id) => index(id) < index(target)));
  return { expanded, current: before ?? root.id };
}

/**
 * Hoppar till nästa (1) eller föregående (-1) syskon och fäller ut det.
 * Från roten går det till första eller sista grenen. Finns inget syskon åt
 * det hållet kommer samma läge tillbaka.
 */
export function presentSibling(root: MindmapNode, state: PresentState, delta: 1 | -1): PresentState {
  let target: MindmapNode | undefined;
  if (state.current === root.id || !findNode(root, state.current)) {
    target = delta > 0 ? root.children[0] : root.children[root.children.length - 1];
  } else {
    const found = findParent(root, state.current);
    target = found?.parent.children[found.index + delta];
  }
  if (!target) return state;
  return {
    expanded: target.children.length > 0 ? withExpanded(root, state, target.id) : state.expanded,
    current: target.id,
  };
}

/** Ett klick på en nod: den pekas ut, och har den barn fälls den ut eller ihop. */
export function presentToggle(root: MindmapNode, state: PresentState, id: string): PresentState {
  const node = findNode(root, id);
  if (!node) return state;
  if (id === root.id || node.children.length === 0) return { ...state, current: id };
  return {
    expanded: state.expanded.includes(id) ? withoutBranch(root, state, id) : withExpanded(root, state, id),
    current: id,
  };
}

/** Hur långt presentationen kommit: utfällda grenar av alla. */
export function presentProgress(root: MindmapNode, state: PresentState): { done: number; total: number } {
  const all = branchIds(root);
  return { done: all.filter((id) => state.expanded.includes(id)).length, total: all.length };
}

/**
 * Dokumentet som ritas: varje nod med barn är hopfälld om den inte står i
 * `expanded`. Det sparade `collapsed` gäller inte här, och roten rörs inte.
 */
export function presentDoc(doc: MindmapDoc, state: PresentState): MindmapDoc {
  const open = new Set(state.expanded);
  const apply = (node: MindmapNode, isRoot: boolean): MindmapNode => {
    const children = node.children.map((child) => apply(child, false));
    if (isRoot) return { ...node, children };
    const { collapsed: _collapsed, ...rest } = node;
    return node.children.length > 0 && !open.has(node.id) ? { ...rest, children, collapsed: true } : { ...rest, children };
  };
  return { ...doc, root: apply(doc.root, true) };
}

/* ── Vyn ── */

/** Luft mellan kartan och skärmens kant. */
export const PRESENT_MARGIN = 48;
/** Ryms allt som syns i minst den här zoomen visas allt. */
export const PRESENT_WHOLE_MIN_ZOOM = 1.2;
/** En liten karta förstoras inte mer än så här. */
export const PRESENT_MAX_ZOOM = 2.4;
/** Zoomen när bara en del visas: texten en och en halv gång så stor. */
export const PRESENT_ZOOM = 1.5;

/**
 * Det vyn ska visa när allt inte ryms: den utpekade noden med sin förälder
 * och sina synliga barn, i layoutens koordinater.
 */
export function presentFocus(layout: MindmapLayoutResult, root: MindmapNode, state: PresentState): MindmapRect | null {
  const node = findNode(root, state.current);
  if (!node) return null;
  const ids = [node.id, ...node.children.map((child) => child.id)];
  const parent = findParent(root, node.id)?.parent;
  if (parent) ids.push(parent.id);
  const boxes = ids.map((id) => layout.byId.get(id)).filter((box): box is NonNullable<typeof box> => !!box);
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((box) => box.x + box.width)) - x,
    height: Math.max(...boxes.map((box) => box.y + box.height)) - y,
  };
}

/**
 * Var lagret ska stå. Ryms allt som syns i läsbar storlek visas allt,
 * centrerat. Annars visas `focus` i PRESENT_ZOOM, eller mindre om det inte
 * ryms, och kartans kant lämnar aldrig mer luft än marginalen.
 */
export function presentView(content: MindmapSize, focus: MindmapRect | null, size: MindmapSize): MindmapView {
  if (size.width <= 0 || size.height <= 0 || content.width <= 0 || content.height <= 0) return { x: 0, y: 0, zoom: 1 };
  const roomX = Math.max(1, size.width - 2 * PRESENT_MARGIN);
  const roomY = Math.max(1, size.height - 2 * PRESENT_MARGIN);
  const fit = (width: number, height: number) => Math.min(roomX / Math.max(1, width), roomY / Math.max(1, height));
  const whole = fit(content.width, content.height);

  const showAll = whole >= PRESENT_WHOLE_MIN_ZOOM || !focus;
  const zoom = showAll
    ? Math.min(PRESENT_MAX_ZOOM, whole)
    : Math.max(whole, Math.min(PRESENT_ZOOM, fit(focus.width, focus.height)));
  const target = showAll || !focus ? { x: 0, y: 0, width: content.width, height: content.height } : focus;

  const axis = (center: number, total: number, room: number): number => {
    const scaled = total * zoom;
    // Hela kartan ryms på ledden: den centreras, vad som än pekas ut.
    if (scaled <= room - 2 * PRESENT_MARGIN) return (room - scaled) / 2;
    const wanted = room / 2 - center * zoom;
    return Math.min(PRESENT_MARGIN, Math.max(room - PRESENT_MARGIN - scaled, wanted));
  };
  return {
    zoom,
    x: Math.round(axis(target.x + target.width / 2, content.width, size.width)),
    y: Math.round(axis(target.y + target.height / 2, content.height, size.height)),
  };
}

/* ── Tangenter ── */

export interface PresentKeyInput {
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/** Alt+P startar presentationen. `e.code`: Alt+P ger ett specialtecken på Mac. */
export function isPresentKey(e: PresentKeyInput): boolean {
  return e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyP';
}

export type PresentKeyAction = 'next' | 'prev' | 'down' | 'up' | 'home' | 'exit';

/**
 * Tangenterna i presentationen. PageDown och PageUp är vad en
 * presentationsfjärr skickar; Shift+mellanslag backar, som i ett bildspel.
 */
export function resolvePresentKey(e: PresentKeyInput): PresentKeyAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case ' ':
      return e.shiftKey ? 'prev' : 'next';
    case 'ArrowRight':
    case 'Enter':
    case 'PageDown':
      return 'next';
    case 'ArrowLeft':
    case 'Backspace':
    case 'PageUp':
      return 'prev';
    case 'ArrowDown':
      return 'down';
    case 'ArrowUp':
      return 'up';
    case 'Home':
      return 'home';
    case 'Escape':
      return 'exit';
    default:
      return null;
  }
}
