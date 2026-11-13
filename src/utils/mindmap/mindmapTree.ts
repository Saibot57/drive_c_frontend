import {
  MINDMAP_ANCHORS,
  MINDMAP_COLORS,
  MINDMAP_EDGE_SHAPE_VALUES,
  MINDMAP_ICONS,
  MINDMAP_MAX_EDGE_POINTS,
  MINDMAP_NOTE_MAX_LENGTH,
  type MindmapAnchor,
  type MindmapColor,
  type MindmapContent,
  type MindmapEdgeShape,
  type MindmapEdgeStyle,
  type MindmapIcon,
  type MindmapImageSource,
  type MindmapLayout,
  type MindmapNode,
  type MindmapSide,
} from '@/types/mindmap';

/*
 * Mindmapens trädoperationer. Allt är rena funktioner som tar ett innehåll och
 * ger ett nytt, så att editorn kan lägga det gamla i sin ångra-historik och
 * testerna kan pröva varje steg utan en DOM.
 *
 * En operation som inte går att utföra (flytta roten, dra in en nod utan
 * föregående syskon) ger `null` i stället för ett oförändrat innehåll. Då kan
 * editorn låta bli att spara och att lägga en tom post i historiken.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

const DEFAULT_ROOT_LABEL = 'Central nod';

/** Djupare än så här blir inte en karta som någon ritat för hand. */
const MAX_DEPTH = 50;

export function newNodeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Etiketten på en rad: radbrytningarna (Mindmap-sidan, Ctrl+Enter) blir ett
 * mellanslag. För det som bara har plats för en rad: dispositionen, namn och
 * filnamn. En etikett utan radbrytning blir bara trimmad.
 */
export function labelOneLine(label: string): string {
  return label.replace(/\s*[\r\n]+\s*/g, ' ').trim();
}

export function createNode(label = ''): MindmapNode {
  return { id: newNodeId(), label, children: [] };
}

export function defaultMindmap(): MindmapContent {
  return { root: { id: '1', label: DEFAULT_ROOT_LABEL, children: [] }, layout: 'right' };
}

/* ── Inläsning ───────────────────────────────────────────────────────────── */

/**
 * Läser ett sparat innehåll defensivt. Gamla kartor har bara id, etikett och
 * barn; allt annat får sitt förval. Saknade eller dubblerade id byts mot nya,
 * men deterministiskt — funktionen körs vid varje rendering, och ett slumpat
 * id hade tappat markeringen varje gång.
 */
export function sanitizeMindmap(raw: unknown): MindmapContent {
  const value = raw as { root?: unknown; layout?: unknown } | null;
  if (!value || typeof value !== 'object' || !value.root || typeof value.root !== 'object') {
    return defaultMindmap();
  }
  const seen = new Set<string>();
  const root = sanitizeNode(value.root as Record<string, unknown>, seen, 0);
  delete root.side;
  delete root.collapsed;
  // Sidan betyder bara något på rotens barn.
  stripSidesBelow(root.children);
  return { root, layout: value.layout === 'both' ? 'both' : 'right' };
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function sanitizeNode(raw: Record<string, unknown>, seen: Set<string>, depth: number): MindmapNode {
  let id = typeof raw.id === 'string' ? raw.id : typeof raw.id === 'number' ? String(raw.id) : '';
  if (!id) id = `n${seen.size + 1}`;
  while (seen.has(id)) id = `${id}-${seen.size + 1}`;
  seen.add(id);

  const label = typeof raw.label === 'string' ? raw.label : raw.label == null ? '' : String(raw.label);
  const children = depth < MAX_DEPTH && Array.isArray(raw.children)
    ? raw.children
      .filter((child): child is Record<string, unknown> => !!child && typeof child === 'object')
      .map((child) => sanitizeNode(child, seen, depth + 1))
    : [];

  const node: MindmapNode = { id, label, children };
  if (raw.collapsed === true && children.length > 0) node.collapsed = true;
  if (typeof raw.color === 'string' && (MINDMAP_COLORS as string[]).includes(raw.color)) {
    node.color = raw.color as MindmapColor;
  }
  if (raw.side === 'left' || raw.side === 'right') node.side = raw.side;

  // Sidans fält. Fel form tas bort; en nod utan dem blir exakt som förut.
  if (typeof raw.note === 'string' && raw.note.length > 0) {
    node.note = raw.note.slice(0, MINDMAP_NOTE_MAX_LENGTH);
  }
  if (typeof raw.link === 'string' && /^https?:\/\//i.test(raw.link)) node.link = raw.link;
  const image = sanitizeImage(raw.image);
  if (image) node.image = image;
  if (typeof raw.icon === 'string' && (MINDMAP_ICONS as string[]).includes(raw.icon)) {
    node.icon = raw.icon as MindmapIcon;
  }
  const offset = raw.offset as { dx?: unknown; dy?: unknown } | null;
  if (offset && typeof offset === 'object' && isFiniteNumber(offset.dx) && isFiniteNumber(offset.dy)) {
    node.offset = { dx: offset.dx, dy: offset.dy };
  }
  if (isFiniteNumber(raw.textWidth)) node.textWidth = clampTextWidth(raw.textWidth);
  // Högst ett av customColor, color och colorNone, i den ordningen.
  if (typeof raw.customColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.customColor)) {
    node.customColor = raw.customColor.toLowerCase();
    delete node.color;
  } else if (raw.colorNone === true && !node.color) {
    node.colorNone = true;
  }
  const edge = sanitizeEdgeStyle(raw.edge);
  if (edge) node.edge = edge;
  const childDir = raw.childDir as { angle?: unknown } | null;
  if (childDir && typeof childDir === 'object' && isFiniteNumber(childDir.angle)) {
    node.childDir = { angle: normalizeAngle(childDir.angle) };
  }
  const dir = raw.dir as { angle?: unknown; base?: unknown; gap?: unknown; side?: unknown } | null;
  if (dir && typeof dir === 'object') {
    if (isFiniteNumber(dir.angle)) {
      node.dir = { angle: normalizeAngle(dir.angle) };
      if (isFiniteNumber(dir.base)) node.dir.base = normalizeAngle(dir.base);
      if (isFiniteNumber(dir.gap)) node.dir.gap = Math.round(Math.min(2000, Math.max(0, dir.gap)));
    }
    else if (dir.side === 'left' || dir.side === 'right') node.dir = { side: dir.side };
  }
  return node;
}

/** En vinkel i grader till [0, 360), avrundad till en tiondel. */
export function normalizeAngle(angle: number): number {
  const a = Math.round((((angle % 360) + 360) % 360) * 10) / 10;
  return a === 360 ? 0 : a;
}

/** En linjes egna val; okända värden tas bort, och inga val blir inget. */
export function sanitizeEdgeStyle(raw: unknown): MindmapEdgeStyle | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as { shape?: unknown; from?: unknown; to?: unknown; points?: unknown };
  const edge: MindmapEdgeStyle = {};
  if (typeof value.shape === 'string' && (MINDMAP_EDGE_SHAPE_VALUES as readonly string[]).includes(value.shape)) {
    edge.shape = value.shape as MindmapEdgeShape;
  }
  if (typeof value.from === 'string' && (MINDMAP_ANCHORS as readonly string[]).includes(value.from)) {
    edge.from = value.from as MindmapAnchor;
  }
  if (typeof value.to === 'string' && (MINDMAP_ANCHORS as readonly string[]).includes(value.to)) {
    edge.to = value.to as MindmapAnchor;
  }
  if (Array.isArray(value.points)) {
    const points = value.points
      .filter((p): p is { x: number; y: number } => !!p && typeof p === 'object' && isFiniteNumber(p.x) && isFiniteNumber(p.y))
      .slice(0, MINDMAP_MAX_EDGE_POINTS)
      .map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
    if (points.length > 0) edge.points = points;
  }
  return edge.shape || edge.from || edge.to || edge.points ? edge : null;
}

/** Gränserna för en nods egen textbredd, i px vid zoom 1. */
export const MINDMAP_TEXT_WIDTH = { min: 80, max: 600 } as const;

/** En textbredd avrundad och inom gränserna. */
export function clampTextWidth(width: number): number {
  return Math.round(Math.min(MINDMAP_TEXT_WIDTH.max, Math.max(MINDMAP_TEXT_WIDTH.min, width)));
}

function sanitizeImage(raw: unknown): MindmapNode['image'] | null {
  const value = raw as { source?: unknown; width?: unknown; aspect?: unknown } | null;
  if (!value || typeof value !== 'object') return null;
  const source = sanitizeImageSource(value.source);
  if (!source) return null;
  const image: NonNullable<MindmapNode['image']> = { source };
  if (isFiniteNumber(value.width) && value.width > 0) image.width = value.width;
  if (isFiniteNumber(value.aspect) && value.aspect > 0) image.aspect = value.aspect;
  return image;
}

function sanitizeImageSource(raw: unknown): MindmapImageSource | null {
  const value = raw as { kind?: unknown; url?: unknown; fileId?: unknown } | null;
  if (!value || typeof value !== 'object') return null;
  if (value.kind === 'url' && typeof value.url === 'string' && /^https?:\/\//i.test(value.url)) {
    return { kind: 'url', url: value.url };
  }
  if (value.kind === 'gdrive' && typeof value.fileId === 'string' && value.fileId.length > 0) {
    return { kind: 'gdrive', fileId: value.fileId };
  }
  return null;
}

function stripSidesBelow(nodes: MindmapNode[]) {
  nodes.forEach((node) => {
    node.children.forEach((child) => {
      delete child.side;
    });
    stripSidesBelow(node.children);
  });
}

/* ── Uppslag ─────────────────────────────────────────────────────────────── */

export function findNode(root: MindmapNode, id: string): MindmapNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findParent(root: MindmapNode, id: string): { parent: MindmapNode; index: number } | null {
  const index = root.children.findIndex((child) => child.id === id);
  if (index >= 0) return { parent: root, index };
  for (const child of root.children) {
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

/** Sant om `id` är noden själv eller ligger någonstans under den. */
export function isInSubtree(node: MindmapNode, id: string): boolean {
  return findNode(node, id) !== null;
}

export function countDescendants(node: MindmapNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

/** Sidan varje barn till roten ritas på. Gamla barn utan sida varvas. */
export function rootChildSides(content: MindmapContent): Map<string, MindmapSide> {
  const sides = new Map<string, MindmapSide>();
  content.root.children.forEach((child, index) => {
    sides.set(
      child.id,
      content.layout === 'both' ? child.side ?? (index % 2 === 0 ? 'right' : 'left') : 'right',
    );
  });
  return sides;
}

/** Sidan noden ligger på. Roten har ingen sida. */
export function sideOf(content: MindmapContent, id: string): MindmapSide | null {
  if (content.root.id === id) return null;
  const sides = rootChildSides(content);
  const branch = content.root.children.find((child) => isInSubtree(child, id));
  return branch ? sides.get(branch.id) ?? 'right' : null;
}

function sideForNewRootChild(content: MindmapContent): MindmapSide {
  let left = 0;
  let right = 0;
  rootChildSides(content).forEach((side) => {
    if (side === 'left') left += 1;
    else right += 1;
  });
  return left < right ? 'left' : 'right';
}

/**
 * Syskonen som ligger på samma sida som noden, i ordning. Under roten i
 * layouten `both` är det bara grenarna på samma sida som räknas som grannar.
 */
function sameSideSiblings(content: MindmapContent, parent: MindmapNode, id: string): MindmapNode[] {
  if (parent.id !== content.root.id || content.layout !== 'both') return parent.children;
  const sides = rootChildSides(content);
  const side = sides.get(id);
  return parent.children.filter((child) => sides.get(child.id) === side);
}

/* ── Ändringar ───────────────────────────────────────────────────────────── */

/** Byter ut en nod. Grenar som inte berörs behåller sin identitet. */
export function updateNode(
  root: MindmapNode,
  id: string,
  updater: (node: MindmapNode) => MindmapNode,
): MindmapNode {
  if (root.id === id) return updater(root);
  let changed = false;
  const children = root.children.map((child) => {
    const updated = updateNode(child, id, updater);
    if (updated !== child) changed = true;
    return updated;
  });
  return changed ? { ...root, children } : root;
}

function withRoot(content: MindmapContent, root: MindmapNode): MindmapContent {
  return { ...content, root };
}

function withoutSide(node: MindmapNode): MindmapNode {
  if (node.side === undefined) return node;
  const { side: _side, ...rest } = node;
  return rest;
}

function expanded(node: MindmapNode): MindmapNode {
  if (!node.collapsed) return node;
  const { collapsed: _collapsed, ...rest } = node;
  return rest;
}

export function setLabel(content: MindmapContent, id: string, label: string): MindmapContent {
  return withRoot(content, updateNode(content.root, id, (node) => ({ ...node, label })));
}

export function setColor(content: MindmapContent, id: string, color: MindmapColor | null): MindmapContent {
  return withRoot(content, updateNode(content.root, id, (node) => {
    if (color) return { ...node, color };
    const { color: _color, ...rest } = node;
    return rest;
  }));
}

/** Sätter eller tar bort (`null`) ett valfritt fält på en nod. */
function setField<K extends 'note' | 'link' | 'image' | 'icon' | 'textWidth'>(
  content: MindmapContent,
  id: string,
  key: K,
  value: MindmapNode[K] | null,
): MindmapContent {
  return withRoot(content, updateNode(content.root, id, (node) => {
    if (value !== null && value !== undefined) return { ...node, [key]: value };
    if (node[key] === undefined) return node;
    const rest = { ...node };
    delete rest[key];
    return rest;
  }));
}

/** Anteckningen bakom noden. Tom text eller `null` tar bort den. */
export function setNote(content: MindmapContent, id: string, note: string | null): MindmapContent {
  return setField(content, id, 'note', note ? note.slice(0, MINDMAP_NOTE_MAX_LENGTH) : null);
}

/** Nodens länk. Anroparen ser till att den börjar med http:// eller https://. */
export function setLink(content: MindmapContent, id: string, link: string | null): MindmapContent {
  return setField(content, id, 'link', link || null);
}

export function setImage(
  content: MindmapContent,
  id: string,
  image: NonNullable<MindmapNode['image']> | null,
): MindmapContent {
  return setField(content, id, 'image', image);
}

/** Nodens egen textbredd, inom gränserna. `null` ger standardbredden igen. */
export function setTextWidth(content: MindmapContent, id: string, width: number | null): MindmapContent {
  return setField(content, id, 'textWidth', width === null || !Number.isFinite(width) ? null : clampTextWidth(width));
}

export function setIcon(content: MindmapContent, id: string, icon: MindmapIcon | null): MindmapContent {
  return setField(content, id, 'icon', icon);
}

/**
 * Nodens manuella förskjutning från den automatiska platsen. `null`, eller
 * en förskjutning på noll, tar bort den. Roten har ingen: den är kartans mitt.
 */
export function setOffset(
  content: MindmapContent,
  id: string,
  offset: { dx: number; dy: number } | null,
): MindmapContent {
  if (id === content.root.id) return content;
  const keep = offset && Number.isFinite(offset.dx) && Number.isFinite(offset.dy) && (offset.dx !== 0 || offset.dy !== 0);
  return withRoot(content, updateNode(content.root, id, (node) => {
    if (keep) return { ...node, offset: { dx: offset.dx, dy: offset.dy } };
    if (node.offset === undefined) return node;
    const { offset: _offset, ...rest } = node;
    return rest;
  }));
}

/** Finns det någon manuell förskjutning i kartan? */
export function hasOffsets(content: MindmapContent): boolean {
  const any = (node: MindmapNode): boolean => node.offset !== undefined || node.children.some(any);
  return content.root.children.some(any);
}

/** Tar bort alla manuella förskjutningar. Grenar utan någon behåller sin identitet. */
export function clearOffsets(content: MindmapContent): MindmapContent {
  const clear = (node: MindmapNode): MindmapNode => {
    let changed = node.offset !== undefined;
    const children = node.children.map((child) => {
      const cleared = clear(child);
      if (cleared !== child) changed = true;
      return cleared;
    });
    if (!changed) return node;
    const { offset: _offset, ...rest } = node;
    return { ...rest, children };
  };
  const root = clear(content.root);
  return root === content.root ? content : withRoot(content, root);
}

/** Sätter färgen på noden och alla under den, också i hopfällda grenar. */
export function setColorDeep(content: MindmapContent, id: string, color: MindmapColor | null): MindmapContent {
  const paint = (node: MindmapNode): MindmapNode => {
    const children = node.children.map(paint);
    if (color) return { ...node, color, children };
    const { color: _color, ...rest } = node;
    return { ...rest, children };
  };
  return withRoot(content, updateNode(content.root, id, paint));
}

/**
 * En kopia av grenen där varje nod har ett nytt id. Allt annat följer med
 * (anteckning, länk, bild, ikon, färg), så att en inklistrad gren inte
 * krockar med den den kopierades från.
 */
export function cloneWithNewIds(node: MindmapNode): MindmapNode {
  return { ...node, id: newNodeId(), children: node.children.map(cloneWithNewIds) };
}

export function toggleCollapsed(content: MindmapContent, id: string): MindmapContent | null {
  const node = findNode(content.root, id);
  if (!node || node.children.length === 0 || id === content.root.id) return null;
  return withRoot(content, updateNode(content.root, id, (current) =>
    current.collapsed ? expanded(current) : { ...current, collapsed: true }));
}

/**
 * Byter layout. Vid `both` får alla rotens barn en sparad sida, så att en ny
 * gren inte flyttar runt de befintliga. Sidorna ligger kvar vid `right` och
 * används igen om man byter tillbaka.
 */
export function setLayout(content: MindmapContent, layout: MindmapLayout): MindmapContent {
  if (layout === 'right') return { ...content, layout };
  const both = { ...content, layout };
  const sides = rootChildSides(both);
  return {
    ...both,
    root: {
      ...content.root,
      children: content.root.children.map((child) => ({ ...child, side: sides.get(child.id) })),
    },
  };
}

/** Lägger till ett barn sist och fäller ut föräldern. */
export function addChild(
  content: MindmapContent,
  parentId: string,
  child: MindmapNode = createNode(),
): { content: MindmapContent; id: string } | null {
  if (!findNode(content.root, parentId)) return null;
  const placed = parentId === content.root.id && content.layout === 'both'
    ? { ...child, side: sideForNewRootChild(content) }
    : withoutSide(child);
  const root = updateNode(content.root, parentId, (parent) => ({
    ...expanded(parent),
    children: [...parent.children, placed],
  }));
  return { content: withRoot(content, root), id: placed.id };
}

/** Lägger till flera barn i ett svep, t.ex. en inklistrad disposition. */
export function addChildren(
  content: MindmapContent,
  parentId: string,
  children: MindmapNode[],
): MindmapContent | null {
  let next = content;
  for (const child of children) {
    const result = addChild(next, parentId, child);
    if (!result) return null;
    next = result.content;
  }
  return children.length > 0 ? next : null;
}

/** Ett nytt syskon före eller efter noden. På roten blir det ett barn. */
export function addSibling(
  content: MindmapContent,
  id: string,
  where: 'before' | 'after',
  sibling: MindmapNode = createNode(),
): { content: MindmapContent; id: string } | null {
  if (id === content.root.id) return addChild(content, id, sibling);
  const location = findParent(content.root, id);
  if (!location) return null;
  const { parent, index } = location;
  const placed = parent.id === content.root.id && content.layout === 'both'
    ? { ...sibling, side: sideOf(content, id) ?? 'right' }
    : withoutSide(sibling);
  const at = where === 'after' ? index + 1 : index;
  const root = updateNode(content.root, parent.id, (current) => ({
    ...current,
    children: [...current.children.slice(0, at), placed, ...current.children.slice(at)],
  }));
  return { content: withRoot(content, root), id: placed.id };
}

/**
 * Tar bort noden med hela sin gren. Markeringen hamnar på syskonet ovanför,
 * annars det nedanför, annars föräldern — på samma sida om roten.
 */
export function removeNode(
  content: MindmapContent,
  id: string,
): { content: MindmapContent; focusId: string } | null {
  if (id === content.root.id) return null;
  const location = findParent(content.root, id);
  if (!location) return null;
  const { parent } = location;
  const siblings = sameSideSiblings(content, parent, id);
  const at = siblings.findIndex((child) => child.id === id);
  const focusId = siblings[at - 1]?.id ?? siblings[at + 1]?.id ?? parent.id;
  const root = updateNode(content.root, parent.id, (current) => {
    const children = current.children.filter((child) => child.id !== id);
    const next = { ...current, children };
    return children.length === 0 ? expanded(next) : next;
  });
  return { content: withRoot(content, root), focusId };
}

/** Flyttar noden ett steg upp eller ned bland syskonen på samma sida. */
export function moveAmongSiblings(
  content: MindmapContent,
  id: string,
  delta: -1 | 1,
): MindmapContent | null {
  const location = findParent(content.root, id);
  if (!location) return null;
  const { parent } = location;
  const siblings = sameSideSiblings(content, parent, id);
  const at = siblings.findIndex((child) => child.id === id);
  const neighbour = siblings[at + delta];
  if (!neighbour) return null;

  const from = parent.children.findIndex((child) => child.id === id);
  const to = parent.children.findIndex((child) => child.id === neighbour.id);
  const children = [...parent.children];
  [children[from], children[to]] = [children[to], children[from]];
  return withRoot(content, updateNode(content.root, parent.id, (current) => ({ ...current, children })));
}

/** Noden blir sista barnet till syskonet ovanför. */
export function indent(content: MindmapContent, id: string): MindmapContent | null {
  const location = findParent(content.root, id);
  if (!location) return null;
  const siblings = sameSideSiblings(content, location.parent, id);
  const at = siblings.findIndex((child) => child.id === id);
  const target = siblings[at - 1];
  if (!target) return null;
  return moveNode(content, id, target.id);
}

/**
 * Noden lyfts upp en nivå och hamnar direkt efter sin förälder. Ett barn till
 * roten kan inte lyftas högre, men i layouten `both` byter det sida i stället:
 * att trycka "mot roten" för det över till andra sidan.
 */
export function outdent(content: MindmapContent, id: string): MindmapContent | null {
  const location = findParent(content.root, id);
  if (!location) return null;
  const { parent } = location;

  if (parent.id === content.root.id) {
    if (content.layout !== 'both') return null;
    const side = sideOf(content, id) === 'left' ? 'right' : 'left';
    return withRoot(content, updateNode(content.root, id, (node) => ({ ...node, side })));
  }

  const grand = findParent(content.root, parent.id);
  if (!grand) return null;
  const node = findNode(content.root, id) as MindmapNode;
  const placed = grand.parent.id === content.root.id && content.layout === 'both'
    ? { ...node, side: sideOf(content, parent.id) ?? 'right' }
    : withoutSide(node);

  let root = updateNode(content.root, parent.id, (current) => {
    const next = { ...current, children: current.children.filter((child) => child.id !== id) };
    return next.children.length === 0 ? expanded(next) : next;
  });
  root = updateNode(root, grand.parent.id, (current) => {
    const at = current.children.findIndex((child) => child.id === parent.id) + 1;
    return { ...current, children: [...current.children.slice(0, at), placed, ...current.children.slice(at)] };
  });
  return withRoot(content, root);
}

/** Om noden kan dras till `targetId`. Inte till sig själv, sin egen gren eller sin förälder. */
export function canMoveNode(content: MindmapContent, id: string, targetId: string): boolean {
  if (id === content.root.id || id === targetId) return false;
  const node = findNode(content.root, id);
  if (!node || !findNode(content.root, targetId) || isInSubtree(node, targetId)) return false;
  return findParent(content.root, id)?.parent.id !== targetId;
}

/** Flyttar noden med sin gren och lägger den sist under `targetId`. */
export function moveNode(content: MindmapContent, id: string, targetId: string): MindmapContent | null {
  if (!canMoveNode(content, id, targetId)) return null;
  const node = findNode(content.root, id) as MindmapNode;
  const location = findParent(content.root, id) as { parent: MindmapNode; index: number };

  const root = updateNode(content.root, location.parent.id, (current) => {
    const next = { ...current, children: current.children.filter((child) => child.id !== id) };
    return next.children.length === 0 ? expanded(next) : next;
  });
  return addChild(withRoot(content, root), targetId, node)?.content ?? null;
}

/* ── Förflyttning med piltangenterna ─────────────────────────────────────── */

/**
 * Synliga noder på ett visst djup och en viss sida, uppifrån och ned. Det är
 * grannarna man når med upp och ned: finns inget syskon går pilen vidare till
 * kusinen, som i MindMup.
 */
function visibleAtDepth(content: MindmapContent, side: MindmapSide, depth: number): string[] {
  const sides = rootChildSides(content);
  const result: string[] = [];
  const walk = (node: MindmapNode, level: number) => {
    if (level === depth) {
      result.push(node.id);
      return;
    }
    if (node.collapsed) return;
    node.children.forEach((child) => walk(child, level + 1));
  };
  content.root.children
    .filter((child) => sides.get(child.id) === side)
    .forEach((child) => walk(child, 1));
  return result;
}

function depthOf(root: MindmapNode, id: string, level = 0): number {
  if (root.id === id) return level;
  for (const child of root.children) {
    const found = depthOf(child, id, level + 1);
    if (found >= 0) return found;
  }
  return -1;
}

/** Noden pilen leder till, eller `null` om det inte finns någon åt det hållet. */
export function navigate(content: MindmapContent, id: string, direction: Direction): string | null {
  const { root } = content;
  const sides = rootChildSides(content);

  if (id === root.id) {
    if (direction === 'up' || direction === 'down') return null;
    const side: MindmapSide = direction;
    return root.children.find((child) => sides.get(child.id) === side)?.id ?? null;
  }

  const side = sideOf(content, id);
  const node = findNode(root, id);
  if (!side || !node) return null;
  const outward: Direction = side === 'right' ? 'right' : 'left';

  if (direction === 'up' || direction === 'down') {
    const row = visibleAtDepth(content, side, depthOf(root, id));
    const at = row.indexOf(id);
    return row[at + (direction === 'up' ? -1 : 1)] ?? null;
  }
  if (direction === outward) {
    return node.collapsed ? null : node.children[0]?.id ?? null;
  }
  return findParent(root, id)?.parent.id ?? null;
}
