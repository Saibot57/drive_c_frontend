import type { MindmapCrossLink, MindmapDoc, MindmapMap, MindmapSummary } from '@/types/mindmapDoc';
import { MAX_CROSS_LINK_LABEL_LENGTH, MAX_MINDMAP_NAME_LENGTH } from '@/types/mindmapDoc';
import { MINDMAP_COLORS, type MindmapColor } from '@/types/mindmap';
import { defaultMindmap, findNode, findParent, newNodeId, removeNode, sanitizeMindmap } from '@/utils/mindmap/mindmapTree';

/*
 * Mindmap-sidans dokument: tvätt av det som läses från servern, och det som
 * trädet inte vet om (tvärlänkarna). Rena funktioner, som i mindmapTree.
 *
 * Tvärlänkarna följer MindMups regler: inte till sig själv, inte mellan
 * förälder och barn, och högst en per par. En länk vars ändar inte finns tas
 * bort, också när en nod tas bort.
 */

export const DEFAULT_MINDMAP_NAME = 'Ny karta';

export function defaultMindmapDoc(): MindmapDoc {
  return { ...defaultMindmap() };
}

const ARROWS = ['none', 'to', 'both'] as const;

/** Sant om en tvärlänk mellan noderna är tillåten i dokumentet. */
export function crossLinkAllowed(doc: MindmapDoc, from: string, to: string): boolean {
  if (from === to) return false;
  if (!findNode(doc.root, from) || !findNode(doc.root, to)) return false;
  if (findParent(doc.root, from)?.parent.id === to) return false;
  if (findParent(doc.root, to)?.parent.id === from) return false;
  return !(doc.crossLinks ?? []).some((link) =>
    (link.from === from && link.to === to) || (link.from === to && link.to === from));
}

/** Tar bort tvärlänkar som inte längre är tillåtna. Samma objekt om inget ändrats. */
export function pruneCrossLinks(doc: MindmapDoc): MindmapDoc {
  const links = doc.crossLinks;
  if (!links || links.length === 0) return doc;
  const kept: MindmapCrossLink[] = [];
  for (const link of links) {
    if (crossLinkAllowed({ ...doc, crossLinks: kept }, link.from, link.to)) kept.push(link);
  }
  return kept.length === links.length ? doc : { ...doc, crossLinks: kept };
}

/** Läser ett sparat dokument defensivt; se sanitizeMindmap för trädet. */
export function sanitizeMindmapDoc(raw: unknown): MindmapDoc {
  const content = sanitizeMindmap(raw);
  const value = raw as { crossLinks?: unknown } | null;
  const rawLinks = value && typeof value === 'object' && Array.isArray(value.crossLinks) ? value.crossLinks : [];
  const seen = new Set<string>();
  const links: MindmapCrossLink[] = [];
  rawLinks.forEach((item: unknown, index: number) => {
    const link = item as Record<string, unknown> | null;
    if (!link || typeof link !== 'object') return;
    if (typeof link.from !== 'string' || typeof link.to !== 'string') return;
    let id = typeof link.id === 'string' && link.id ? link.id : `l${index + 1}`;
    while (seen.has(id)) id = `${id}-${seen.size + 1}`;
    seen.add(id);
    const clean: MindmapCrossLink = { id, from: link.from, to: link.to };
    if (typeof link.label === 'string' && link.label) clean.label = link.label.slice(0, MAX_CROSS_LINK_LABEL_LENGTH);
    if (typeof link.color === 'string' && (MINDMAP_COLORS as string[]).includes(link.color)) {
      clean.color = link.color as MindmapColor;
    }
    if (typeof link.arrow === 'string' && (ARROWS as readonly string[]).includes(link.arrow) && link.arrow !== 'to') {
      clean.arrow = link.arrow as MindmapCrossLink['arrow'];
    }
    links.push(clean);
  });
  const doc: MindmapDoc = links.length ? { ...content, crossLinks: links } : content;
  return pruneCrossLinks(doc);
}

/* ── Tvärlänkar ── */

/** En ny tvärlänk mellan två noder, eller `null` när reglerna inte tillåter den. */
export function addCrossLink(doc: MindmapDoc, from: string, to: string): { doc: MindmapDoc; id: string } | null {
  if (!crossLinkAllowed(doc, from, to)) return null;
  const id = newNodeId();
  return { doc: { ...doc, crossLinks: [...(doc.crossLinks ?? []), { id, from, to }] }, id };
}

/** Byter ut en tvärlänk. Samma dokument om länken inte finns. */
function updateCrossLink(
  doc: MindmapDoc,
  id: string,
  update: (link: MindmapCrossLink) => MindmapCrossLink,
): MindmapDoc {
  const links = doc.crossLinks ?? [];
  if (!links.some((link) => link.id === id)) return doc;
  return { ...doc, crossLinks: links.map((link) => (link.id === id ? update(link) : link)) };
}

/** Tar bort en tvärlänk. Fältet försvinner med den sista. */
export function removeCrossLink(doc: MindmapDoc, id: string): MindmapDoc {
  const links = doc.crossLinks ?? [];
  const kept = links.filter((link) => link.id !== id);
  if (kept.length === links.length) return doc;
  if (kept.length > 0) return { ...doc, crossLinks: kept };
  const { crossLinks: _crossLinks, ...rest } = doc;
  return rest;
}

/** Länkens etikett. En tom text tar bort den. */
export function setCrossLinkLabel(doc: MindmapDoc, id: string, label: string): MindmapDoc {
  return updateCrossLink(doc, id, (link) => {
    const { label: _label, ...rest } = link;
    const text = label.slice(0, MAX_CROSS_LINK_LABEL_LENGTH);
    return text.trim() ? { ...rest, label: text } : rest;
  });
}

/** Var pilen sitter. `to` är förvalet och sparas inte. */
export function setCrossLinkArrow(doc: MindmapDoc, id: string, arrow: NonNullable<MindmapCrossLink['arrow']>): MindmapDoc {
  return updateCrossLink(doc, id, (link) => {
    const { arrow: _arrow, ...rest } = link;
    return arrow === 'to' ? rest : { ...rest, arrow };
  });
}

/** Vänder länken: den går från den nod den gick till. */
export function reverseCrossLink(doc: MindmapDoc, id: string): MindmapDoc {
  return updateCrossLink(doc, id, (link) => ({ ...link, from: link.to, to: link.from }));
}

export function setCrossLinkColor(doc: MindmapDoc, id: string, color: MindmapColor | null): MindmapDoc {
  return updateCrossLink(doc, id, (link) => {
    const { color: _color, ...rest } = link;
    return color ? { ...rest, color } : rest;
  });
}

/**
 * Tar bort en nod med gren och de tvärlänkar som pekade in i grenen.
 * `null` när noden inte går att ta bort (roten), som removeNode.
 */
export function removeNodeFromDoc(doc: MindmapDoc, id: string): { doc: MindmapDoc; focusId: string } | null {
  const removed = removeNode(doc, id);
  if (!removed) return null;
  return { doc: pruneCrossLinks({ ...doc, ...removed.content }), focusId: removed.focusId };
}

/* ── Listan ── */

/** Ett namn som servern tar emot: trimmat, inte tomt, högst 150 tecken. */
export function cleanMindmapName(raw: string, fallback = DEFAULT_MINDMAP_NAME): string {
  const trimmed = raw.trim().slice(0, MAX_MINDMAP_NAME_LENGTH);
  return trimmed || fallback;
}

/** "Kopia av X", eller "Kopia av X (2)" om det redan finns. */
export function copyName(name: string, existing: readonly string[]): string {
  const base = cleanMindmapName(`Kopia av ${name}`);
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base} (${n})`)) n += 1;
  return cleanMindmapName(`${base} (${n})`);
}

/** Läser en rad i listan defensivt. `null` om den inte går att använda. */
export function sanitizeSummary(raw: unknown): MindmapSummary | null {
  const value = raw as Record<string, unknown> | null;
  if (!value || typeof value !== 'object') return null;
  if (typeof value.id !== 'string' || !value.id) return null;
  const version = typeof value.version === 'number' && Number.isInteger(value.version) ? value.version : null;
  if (version === null) return null;
  return {
    id: value.id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : DEFAULT_MINDMAP_NAME,
    version,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : null,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
  };
}

export function sanitizeMap(raw: unknown): MindmapMap | null {
  const summary = sanitizeSummary(raw);
  if (!summary) return null;
  return { ...summary, doc: sanitizeMindmapDoc((raw as { doc?: unknown }).doc) };
}

/** Senast ändrad först, som servern sorterar. */
export function sortSummaries<T extends MindmapSummary>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.name.localeCompare(b.name, 'sv'));
}

export function upsertSummary<T extends MindmapSummary>(items: readonly T[], item: T): T[] {
  return sortSummaries([...items.filter((x) => x.id !== item.id), item]);
}

/** "30 sep", utan punkten som `sv-SE` sätter efter månaden. */
const shortDate = (date: Date): string =>
  new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(date).replace(/\.$/, '');

/** "Ändrad 14:32" i dag, annars "Ändrad 28 sep". Servern skickar UTC utan tidszon. */
export function changedLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return '';
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? `Ändrad ${date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
    : `Ändrad ${shortDate(date)}`;
}

/** Det senast öppnade kart-id:t i localStorage: ett id av serverns form, annars inget. */
export const LAST_OPEN_KEY = 'mindmap.lastOpen.v1';
export function sanitizeLastOpen(raw: unknown): string | null {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{1,36}$/.test(raw) ? raw : null;
}
