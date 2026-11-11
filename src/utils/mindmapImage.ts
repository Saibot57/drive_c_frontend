import type { MindmapIcon, MindmapImageSource, MindmapNode } from '@/types/mindmap';
import { MINDMAP_ICONS } from '@/types/mindmap';

/*
 * Mindmap-sidans tillägg på noderna: bild, länk, och tangenterna som öppnar
 * panelen för dem. Rena funktioner. Planen: docs/plans/mindmap-sida.md, steg 4.
 */

/* ── Bildkälla ── */

/** En delningslänk till OneDrive eller SharePoint. Den ger en HTML-sida, inte bilden. */
const isOneDriveLink = (input: string): boolean =>
  /^https?:\/\/(1drv\.ms|[\w.-]*onedrive\.live\.com|[\w.-]+\.sharepoint\.com)\//i.test(input);

/**
 * En inklistrad länk till en bildkälla som bildproxyn tar emot. Samma regler
 * som Workspace (`parseSource` i pdfProxyService): Google Drive-länkar blir
 * ett fil-id, andra http(s)-adresser går som de är, OneDrive avvisas.
 */
export function parseImageSource(rawInput: string): MindmapImageSource | null {
  const input = rawInput.trim();
  if (!input) return null;
  const file = input.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if (file) return { kind: 'gdrive', fileId: file[1] };
  const open = input.match(/drive\.google\.com\/(?:open|uc)\?.*?id=([^&#]+)/i);
  if (open) return { kind: 'gdrive', fileId: open[1] };
  if (isOneDriveLink(input)) return null;
  if (/^https?:\/\//i.test(input)) return { kind: 'url', url: input };
  return null;
}

/** Texten när länken inte går att använda som bild. */
export function imageLinkError(rawInput: string): string {
  if (isOneDriveLink(rawInput.trim())) {
    return 'OneDrive stöds inte. Använd en bild i Google Drive eller en direktlänk.';
  }
  return 'Okänt länkformat. Klistra in en Google Drive-länk eller en direkt bildlänk.';
}

/** En nyckel per källa: samma bild på två noder hämtas en gång. */
export const imageSourceKey = (source: MindmapImageSource): string =>
  source.kind === 'gdrive' ? `gdrive:${source.fileId}` : `url:${source.url}`;

/** Källan som användaren känner igen den, till panelen. */
export const imageSourceLabel = (source: MindmapImageSource): string =>
  source.kind === 'gdrive' ? 'Google Drive-fil' : source.url;

export interface MindmapImageRef {
  nodeId: string;
  key: string;
  source: MindmapImageSource;
}

/** Alla bilder i kartan, också i hopfällda grenar: de behövs i exporten när grenen fälls ut. */
export function collectImages(root: MindmapNode): MindmapImageRef[] {
  const found: MindmapImageRef[] = [];
  const walk = (node: MindmapNode) => {
    if (node.image) found.push({ nodeId: node.id, key: imageSourceKey(node.image.source), source: node.image.source });
    node.children.forEach(walk);
  };
  walk(root);
  return found;
}

/** Bredderna man väljer mellan i panelen, i px vid zoom 1. */
export const IMAGE_WIDTHS: { label: string; width: number }[] = [
  { label: 'Liten', width: 96 },
  { label: 'Mellan', width: 160 },
  { label: 'Stor', width: 280 },
];

/* ── Länk ── */

/**
 * Det användaren skrev i länkfältet till en länk som går att spara.
 * `www.exempel.se` får https:// framför sig. `null` betyder att texten inte
 * är en webbadress; en tom text är inget fel utan tar bort länken (`''`).
 */
export function normalizeLink(rawInput: string): string | null {
  const input = rawInput.trim();
  if (!input) return '';
  if (/\s/.test(input)) return null;
  if (/^https?:\/\/[^/]+/i.test(input)) return input;
  // Ett annat schema (javascript:, mailto:, file:) sparas inte som länk.
  if (/^[a-z][a-z0-9+.-]*:/i.test(input)) return null;
  return /^[^/]+\.[^/.]{2,}(\/.*)?$/.test(input) ? `https://${input}` : null;
}

/* ── Tangenterna ── */

export type NodeExtraKeyAction =
  | { type: 'panel'; field: 'note' | 'link' | 'image' }
  | { type: 'icon'; icon: MindmapIcon | null };

export interface NodeExtraKeyInput {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const PANEL_KEYS: Record<string, 'note' | 'link' | 'image'> = { KeyN: 'note', KeyL: 'link', KeyI: 'image' };

/**
 * Alt+N, Alt+L och Alt+I öppnar panelen på anteckning, länk och bild;
 * Alt+Shift+1–8 sätter ikon och Alt+Shift+9 tar bort den. Läses med `code`:
 * Alt ger specialtecken på Mac. Måste prövas före resolveMindmapKey, som
 * annars tar Alt+Shift+siffra för en färg.
 */
export function resolveNodeExtraKey(e: NodeExtraKeyInput): NodeExtraKeyAction | null {
  if (!e.altKey || e.ctrlKey || e.metaKey) return null;
  if (!e.shiftKey) {
    const field = PANEL_KEYS[e.code];
    return field ? { type: 'panel', field } : null;
  }
  const digit = /^Digit([1-9])$/.exec(e.code);
  if (!digit) return null;
  const index = Number(digit[1]) - 1;
  if (index === 8) return { type: 'icon', icon: null };
  return { type: 'icon', icon: MINDMAP_ICONS[index] };
}
