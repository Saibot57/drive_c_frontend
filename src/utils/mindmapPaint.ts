import type { MindmapColor, MindmapNode } from '@/types/mindmap';
import type { MindmapDoc, MindmapShading } from '@/types/mindmapDoc';
import type { MindmapNodePaint, MindmapPalette } from '@/utils/mindmap/mindmapDraw';
import { updateNode } from '@/utils/mindmap/mindmapTree';
import { contrastRatio, TEXT_ON_DARK } from '@/utils/readableTextColor';

/*
 * Mindmap-sidans nodfärger: egna färger och nyanser nedåt i en färgad gren
 * (docs/plans/mindmap-farger.md). Rena funktioner utan DOM.
 *
 * Färgen sparas bara på noden man färgade (`color` eller `customColor`).
 * Noderna under får nyanser av den när kartan ritas, efter avståndet, och
 * längst ned bara en kant. `colorNone` stoppar arvet för en gren. Med
 * nyanserna `off` (alla kartor från före nyanserna) är bara noder med sparad
 * färg färgade, som förut.
 *
 * Färgerna räknas till färdiga `#rrggbb` ur temats värden, som anroparen
 * läser ur CSS. Då blir skärmen, minikartan och bildexporten lika, och
 * Canvas behöver inte förstå `color-mix()`.
 */

/** Hur mycket av färgen varje nivå under den färgade noden får. Djupare: bara kant. */
export const SHADING_STEPS: Record<MindmapShading, readonly number[]> = {
  off: [],
  short: [0.55, 0.25],
  medium: [0.7, 0.45, 0.25],
  soft: [0.8, 0.6, 0.4],
};

export const SHADING_LABELS: Record<MindmapShading, string> = {
  off: 'Av',
  short: 'Korta',
  medium: 'Mellan',
  soft: 'Mjuka',
};

/** Kanten längst ned: så mycket av färgen, resten textfärgen, så att ljusa färger syns. */
const OUTLINE_MIX = 0.7;
/** Under så låg kontrast mot temats text väljs ljus text, om den är bättre. */
const MIN_TEXT_CONTRAST = 4.5;

/** Temats värden, lästa ur CSS. */
export interface MindmapPaintTheme {
  colors: Record<MindmapColor, string>;
  /** Nodens vanliga bakgrund; nyanserna blandas mot den. */
  nodeBg: string;
  text: string;
  /** Andel av en egen färg som visas (1 i Neo, 0,54 i Kronberg). */
  customMix: number;
  /** Basen en egen färg dämpas mot. */
  customBase: string;
}

export function paintThemeOf(palette: MindmapPalette): MindmapPaintTheme {
  return {
    colors: palette.colors,
    nodeBg: palette.nodeBg,
    text: palette.text,
    customMix: palette.customMix ?? 1,
    customBase: palette.customBase || palette.nodeBg,
  };
}

/* ── Färgmatematik ── */

/** "54%" som 0,54, till exempel `--ui-course-mix`; det som inte går att läsa som 1. */
export function parsePercent(value: string): number {
  const match = /^(\d+(?:\.\d+)?)%$/.exec(value.trim());
  return match ? Math.min(1, Math.max(0, Number(match[1]) / 100)) : 1;
}

/** `#rgb` eller `#rrggbb`, med eller utan brädgård; annars `null`. */
export function parseHexColor(color: string): [number, number, number] | null {
  const value = color.trim().replace(/^#/, '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function toOklab([r8, g8, b8]: [number, number, number]): [number, number, number] {
  const r = toLinear(r8);
  const g = toLinear(g8);
  const b = toLinear(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, A, B]: [number, number, number]): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb
    .map((c) => Math.round(Math.min(1, Math.max(0, fromLinear(c))) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Som `color-mix(in oklab, a p, b)`: `p` = 1 ger `a`, 0 ger `b`. Går en färg
 * inte att läsa blir det den som väger mest, oförändrad.
 */
export function mixOklab(a: string, b: string, p: number): string {
  const x = parseHexColor(a);
  const y = parseHexColor(b);
  if (!x || !y) return p >= 0.5 ? a : b;
  const ox = toOklab(x);
  const oy = toOklab(y);
  return fromOklab([0, 1, 2].map((i) => ox[i] * p + oy[i] * (1 - p)) as [number, number, number]);
}

/** Temats text, eller ljus text när den syns bättre och temats text syns för dåligt. */
function textOn(fill: string, theme: MindmapPaintTheme): string {
  if (!parseHexColor(fill) || !parseHexColor(theme.text)) return theme.text;
  const own = contrastRatio(fill, theme.text);
  if (own >= MIN_TEXT_CONTRAST) return theme.text;
  return contrastRatio(fill, TEXT_ON_DARK) > own ? TEXT_ON_DARK : theme.text;
}

/* ── Färgerna i kartan ── */

/** Nodens egen färg, dämpad efter temat; `null` utan sparad färg. */
function ownBase(node: MindmapNode, theme: MindmapPaintTheme): string | null {
  if (node.customColor) return mixOklab(node.customColor, theme.customBase, theme.customMix);
  if (node.color) return theme.colors[node.color] ?? null;
  return null;
}

/**
 * Färgerna per nod-id i hela trädet. En nod utan färg finns inte i kartan
 * och ritas som vanligt. Räknas på hela kartan också i grenvyn, så att en
 * gren har samma nyanser ensam.
 */
export function resolveMindmapPaint(
  root: MindmapNode,
  shading: MindmapShading | undefined,
  theme: MindmapPaintTheme,
): Map<string, MindmapNodePaint> {
  const steps = SHADING_STEPS[shading ?? 'off'];
  const inherit = (shading ?? 'off') !== 'off';
  const paints = new Map<string, MindmapNodePaint>();

  const walk = (node: MindmapNode, base: string | null, level: number) => {
    let nodeBase = ownBase(node, theme);
    let nodeLevel = 0;
    if (!nodeBase && !node.colorNone && inherit && base) {
      nodeBase = base;
      nodeLevel = level + 1;
    }
    if (nodeBase) {
      if (nodeLevel === 0) {
        paints.set(node.id, { fill: nodeBase, text: textOn(nodeBase, theme) });
      } else if (nodeLevel <= steps.length) {
        const fill = mixOklab(nodeBase, theme.nodeBg, steps[nodeLevel - 1]);
        paints.set(node.id, { fill, text: textOn(fill, theme) });
      } else {
        paints.set(node.id, {
          fill: theme.nodeBg,
          text: theme.text,
          border: mixOklab(nodeBase, theme.text, OUTLINE_MIX),
          outline: true,
        });
      }
    }
    node.children.forEach((child) => walk(child, nodeBase, nodeLevel));
  };
  walk(root, null, 0);
  return paints;
}

/* ── Att sätta färg ── */

/** En färg att sätta: en av de sex, eller en egen `#rrggbb`. */
export type MindmapPaintChoice = { color: MindmapColor } | { customColor: string };

function withoutPaint(node: MindmapNode): MindmapNode {
  const { color: _c, customColor: _cc, colorNone: _cn, ...rest } = node;
  return rest;
}

function painted(node: MindmapNode, choice: MindmapPaintChoice): MindmapNode {
  const clean = withoutPaint(node);
  if ('color' in choice) return { ...clean, color: choice.color };
  const hex = parseHexColor(choice.customColor);
  if (!hex) return node;
  return { ...clean, customColor: `#${hex.map((c) => c.toString(16).padStart(2, '0')).join('')}` };
}

/** Vägen från roten till noden, båda medräknade; tom om noden inte finns. */
function pathTo(root: MindmapNode, id: string): MindmapNode[] {
  if (root.id === id) return [root];
  for (const child of root.children) {
    const path = pathTo(child, id);
    if (path.length) return [root, ...path];
  }
  return [];
}

/** Sant om noden hade fått en nyans av en förfader, utan egen färg. */
export function inheritsColor(doc: MindmapDoc, id: string): boolean {
  if ((doc.shading ?? 'off') === 'off') return false;
  const path = pathTo(doc.root, id);
  for (let i = path.length - 2; i >= 0; i -= 1) {
    const ancestor = path[i];
    if (ancestor.colorNone) return false;
    if (ancestor.color || ancestor.customColor) return true;
  }
  return false;
}

/**
 * Sätter färgen på en nod. `null` är "Ingen färg": den sparade färgen tas
 * bort, och hade noden då ärvt en nyans sparas i stället `colorNone`, så att
 * den blir ofärgad som man bett om.
 */
export function setNodePaint(doc: MindmapDoc, id: string, choice: MindmapPaintChoice | null): MindmapDoc {
  const inherits = choice === null && inheritsColor(doc, id);
  const root = updateNode(doc.root, id, (node) => {
    if (choice) return painted(node, choice);
    return inherits ? { ...withoutPaint(node), colorNone: true } : withoutPaint(node);
  });
  return { ...doc, root };
}

/**
 * "Hela grenen". Med nyanser: färgen på noden och sparade färger under tas
 * bort, så att grenen får nyanser. Utan (`off`): samma färg på alla, som
 * förut (`setColorDeep`).
 */
export function setBranchPaint(doc: MindmapDoc, id: string, choice: MindmapPaintChoice | null): MindmapDoc {
  const shaded = (doc.shading ?? 'off') !== 'off';
  const below = (node: MindmapNode): MindmapNode => {
    const children = node.children.map(below);
    if (shaded || !choice) return { ...withoutPaint(node), children };
    return { ...painted(node, choice), children };
  };
  const top = setNodePaint(doc, id, choice);
  const root = updateNode(top.root, id, (node) => ({ ...node, children: node.children.map(below) }));
  return { ...top, root };
}

/**
 * Färgen en ny nod under `parentId` ska spara. Med nyanser ingen: den ärver.
 * Utan (`off`) förälderns, som förut.
 */
export function colorForNewNode(doc: MindmapDoc, parentId: string): MindmapPaintChoice | null {
  if ((doc.shading ?? 'off') !== 'off') return null;
  const parent = pathTo(doc.root, parentId).pop();
  if (parent?.customColor) return { customColor: parent.customColor };
  if (parent?.color) return { color: parent.color };
  return null;
}

/** Nodens sparade färg som ett val, för att visa den i menyn; `null` utan. */
export function paintChoiceOf(node: MindmapNode | null | undefined): MindmapPaintChoice | null {
  if (node?.customColor) return { customColor: node.customColor };
  if (node?.color) return { color: node.color };
  return null;
}

/** Sant om valet är nodens sparade färg. Egna färger jämförs utan hänsyn till versaler. */
export function isPaintChoice(current: MindmapPaintChoice | null, choice: MindmapPaintChoice): boolean {
  if (!current) return false;
  if ('color' in choice) return 'color' in current && current.color === choice.color;
  return 'customColor' in current && current.customColor.toLowerCase() === choice.customColor.toLowerCase();
}

/** De senaste egna färgerna ur lagringen: bara `#rrggbb`, med gemener, utan dubbletter. */
export function sanitizeRecentColors(raw: readonly unknown[]): string[] {
  const seen = new Set<string>();
  raw.forEach((value) => {
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) seen.add(value.toLowerCase());
  });
  return Array.from(seen);
}

/** Sätter nyanserna för kartan. */
export function setShading(doc: MindmapDoc, shading: MindmapShading): MindmapDoc {
  return { ...doc, shading };
}
