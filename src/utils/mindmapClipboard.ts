import type { MindmapNode } from '@/types/mindmap';
import { cloneWithNewIds, sanitizeMindmap } from '@/utils/mindmap/mindmapTree';

/*
 * En kopierad gren med allt: anteckning, länk, bild, ikon och färg.
 * Dispositionen som läggs på urklipp (en HTML-lista) kan bara bära texten,
 * så grenen följer med som JSON i ett `data-mindmap`-attribut på ett
 * omslutande element. Google Docs och andra program bryr sig inte om
 * attributet; Mindmap-sidan läser det först när något klistras in.
 */

const ATTRIBUTE = 'data-mindmap';

const escapeAttribute = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Dispositionens HTML med grenen i attributet. */
export function withBranchData(outlineHtml: string, node: MindmapNode): string {
  return `<div ${ATTRIBUTE}="${escapeAttribute(JSON.stringify(node))}">${outlineHtml}</div>`;
}

/**
 * Grenen ur inklistrad HTML, tvättad och med nya id, eller `null` om
 * attributet saknas eller är trasigt. Då gäller dispositionen som förut.
 */
export function readBranchData(doc: Document): MindmapNode | null {
  const raw = doc.querySelector(`[${ATTRIBUTE}]`)?.getAttribute(ATTRIBUTE);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const value = parsed as { label?: unknown; children?: unknown; collapsed?: unknown };
  // sanitizeMindmap gör en ny standardkarta av skräp; det ska inte klistras in.
  if (typeof value.label !== 'string' || !Array.isArray(value.children)) return null;
  const { root } = sanitizeMindmap({ root: parsed });
  // Sidan en gren hade under roten hör till kartan den kom från.
  const { side: _side, ...branch } = root;
  // Tvätten fäller ut roten; här är roten en gren som får vara hopfälld.
  if (value.collapsed === true && branch.children.length > 0) branch.collapsed = true;
  return cloneWithNewIds(branch);
}
