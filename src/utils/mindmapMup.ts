import type { MindmapColor, MindmapNode, MindmapSide } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import { IMAGE_WIDTHS } from '@/utils/mindmapImage';
import { cleanMindmapName, sanitizeMindmapDoc } from '@/utils/mindmapDoc';

/*
 * Läser en karta från MindMup (`.mup`, JSON) till sidans dokument.
 *
 * Kontrollerat 2026-11-11 mot MindMups källkod (`mindmup/mapjs`):
 * - `content-upgrade.js`: format 1 hade stilen i `idea.style` (med
 *   `collapsed` i den); format 2 flyttade den till `idea.attr.style` och
 *   `attr.collapsed`. Format 3 lägger ett omslag runt rotidén:
 *   `{ id: 'root', formatVersion: 3, ideas: { 1: rotidén }, attr }`, och
 *   allt annat (`links`, `resources`) blir kvar på omslaget.
 * - `content.js`: `ideas` är ett objekt med rangtal som nycklar
 *   (`parseFloat`); barnen ordnas positiva först och negativa sedan, var för
 *   sig efter absolutvärde. Under roten ligger negativa rangtal till vänster.
 *   En tom grupp (`attr.group` utan barn) tas bort. Länkarna är
 *   `{ ideaIdFrom, ideaIdTo, attr: { style: { color, lineStyle, arrow } } }`;
 *   en ny länk får `arrow: 'to'`, äldre verktyg sätter `true` eller `false`.
 * - `update-node-content.js` och `url-helper.js`: en nods länk är den första
 *   webbadressen i titeln, och titeln visas utan den (utom när titeln bara
 *   är adressen). Ikonen är `attr.icon = { url, width, height, position }`,
 *   och `url` kan vara en intern resurs. Anteckningen är `attr.note`,
 *   bilagan `attr.attachment` med `content`.
 * - `apply-idea-attributes-to-node-theme.js`: färgen är
 *   `attr.style.background`; `'false'` och `'transparent'` betyder ingen.
 *
 * Inte kontrollerat: att `attr.note` har sin text i `note.text` och att
 * bilagan har `contentType: 'text/html'`. Läsaren tar därför en sträng
 * eller `{ text }` som anteckning, och en bilagas `content` som HTML om
 * `contentType` saknas eller nämner html. `position` ignoreras: sidans
 * layout är en annan, och `offset` sätts inte.
 *
 * Resultatet går genom sanitizeMindmapDoc, som all inläsning.
 */

export class MindmapImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MindmapImportError';
  }
}

const NOT_MUP = 'Filen är inte en MindMup-karta.';

/** Djupare än så läses inte; sanitizeMindmap klipper ändå vid 50 nivåer. */
const MAX_DEPTH = 60;

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw => !!value && typeof value === 'object' && !Array.isArray(value);

/* ── Färg ── */

/*
 * Neo-temats markeringsfärger (`--ui-mark-*` i src/styles/tokens.css).
 * Tabellen är data för importen, inte utseende: en ren funktion kan inte
 * läsa CSS, och färgen sparas som ett namn som temat sedan ritar.
 */
const NEO_MARK_COLORS: Record<MindmapColor, string> = {
  green: '#9ccb6b',
  yellow: '#ffd23f',
  blue: '#8fd0ff',
  pink: '#ff9ec4',
  lilac: '#c9b8ff',
  grey: '#e5e7eb',
};

type Rgb = [number, number, number];

function parseCssColor(css: string): Rgb | null {
  const value = css.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split('').map((d) => d + d).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as Rgb;
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/.exec(value);
  if (rgb) {
    const channels = rgb.slice(1, 4).map(Number) as Rgb;
    return channels.every((c) => c <= 255) ? channels : null;
  }
  return null;
}

/** Kulörtonen i grader, och skillnaden mellan största och minsta kanal (0–255). */
function hueOf([r, g, b]: Rgb): { hue: number; chroma: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { hue: 0, chroma: 0 };
  let hue: number;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return { hue: (hue * 60 + 360) % 360, chroma: d };
}

/** Under så här stor skillnad mellan kanalerna är en färg grå. */
const GREY_CHROMA = 24;
/** Alla kanaler minst så här ljusa: vitt eller nästan vitt, alltså ingen färg. */
const NEAR_WHITE = 240;

const CHROMATIC: { color: MindmapColor; hue: number }[] = (Object.keys(NEO_MARK_COLORS) as MindmapColor[])
  .filter((color) => color !== 'grey')
  .map((color) => ({ color, hue: hueOf(parseCssColor(NEO_MARK_COLORS[color])!).hue }));

/**
 * Närmaste av de sex nodfärgerna. Sidans färger är pasteller, så avståndet
 * räknas i kulörton och inte i RGB: rött ska bli rosa, inte gult. En grå
 * färg blir grå. Vitt, nästan vitt, genomskinligt och det som inte går att
 * läsa blir ingen färg.
 */
export function nearestMindmapColor(css: unknown): MindmapColor | null {
  if (typeof css !== 'string') return null;
  const rgb = parseCssColor(css);
  if (!rgb) return null;
  if (rgb.every((c) => c >= NEAR_WHITE)) return null;
  const { hue, chroma } = hueOf(rgb);
  if (chroma < GREY_CHROMA) return 'grey';
  let best = CHROMATIC[0];
  let bestDistance = Infinity;
  CHROMATIC.forEach((candidate) => {
    const diff = Math.abs(candidate.hue - hue);
    const distance = Math.min(diff, 360 - diff);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  });
  return best.color;
}

/* ── Text ── */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });

/** HTML till ren text: inga taggar, en radbrytning per stycke, rad och listpunkt. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(text)
    .replace(/ /g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/* ── Titel och länk (som MindMups url-helper) ── */

const URL_PATTERN = /(https?:\/\/|www\.)[\w-]+(\.[\w-]+)+([\w()\u0080-ÿ.,!@?^=%&:/~+#-]*[\w()\u0080-ÿ!@?^=%&/~+#-])?/i;

function titleAndLink(rawTitle: unknown): { label: string; link?: string } {
  const title = (typeof rawTitle === 'string' ? rawTitle : typeof rawTitle === 'number' ? String(rawTitle) : '')
    // Sidans noder är en rad.
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F\u0080-\u009F]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const match = URL_PATTERN.exec(title);
  if (!match) return { label: title };
  const url = /^https?:\/\//i.test(match[0]) ? match[0] : `http://${match[0]}`;
  const stripped = title.replace(URL_PATTERN, '').replace(/\s+/g, ' ').trim();
  return { label: stripped || title, link: url };
}

/* ── Noderna ── */

/** Barnen i MindMups ordning: positiva rangtal först, sedan negativa, var för sig efter absolutvärde. */
function sortedIdeas(ideas: unknown): { rank: number; idea: Raw }[] {
  if (!isObject(ideas)) return [];
  const entries = Object.entries(ideas)
    .map(([key, idea]) => ({ rank: parseFloat(key), idea }))
    .filter((entry): entry is { rank: number; idea: Raw } => Number.isFinite(entry.rank) && isObject(entry.idea));
  const positive = entries.filter((e) => e.rank > 0).sort((a, b) => Math.abs(a.rank) - Math.abs(b.rank));
  const rest = entries.filter((e) => e.rank <= 0).sort((a, b) => Math.abs(a.rank) - Math.abs(b.rank));
  return [...positive, ...rest];
}

/** Format 1 hade stilen direkt på idén. */
function attrOf(idea: Raw): Raw {
  if (isObject(idea.attr)) return idea.attr;
  if (isObject(idea.style)) {
    const { collapsed, ...style } = idea.style;
    return { style, ...(collapsed ? { collapsed } : {}) };
  }
  return {};
}

function noteOf(attr: Raw): string | undefined {
  const parts: string[] = [];
  const note = attr.note;
  if (typeof note === 'string') parts.push(note.trim());
  else if (isObject(note) && typeof note.text === 'string') parts.push(note.text.trim());
  const attachment = attr.attachment;
  if (isObject(attachment) && typeof attachment.content === 'string') {
    const type = typeof attachment.contentType === 'string' ? attachment.contentType.toLowerCase() : '';
    parts.push(!type || type.includes('html') ? htmlToText(attachment.content) : attachment.content.trim());
  }
  const text = parts.filter(Boolean).join('\n\n');
  return text || undefined;
}

const nearestWidth = (width: number): number =>
  IMAGE_WIDTHS.reduce((best, option) =>
    Math.abs(option.width - width) < Math.abs(best - width) ? option.width : best, IMAGE_WIDTHS[0].width);

/** En ikon blir bild bara med en webbadress; data-adresser och interna resurser hoppas över. */
function imageOf(attr: Raw): MindmapNode['image'] | undefined {
  const icon = attr.icon;
  if (!isObject(icon) || typeof icon.url !== 'string' || !/^https?:\/\//i.test(icon.url)) return undefined;
  const image: NonNullable<MindmapNode['image']> = { source: { kind: 'url', url: icon.url } };
  const width = typeof icon.width === 'number' && Number.isFinite(icon.width) && icon.width > 0 ? icon.width : null;
  const height = typeof icon.height === 'number' && Number.isFinite(icon.height) && icon.height > 0 ? icon.height : null;
  if (width) image.width = nearestWidth(width);
  if (width && height) image.aspect = height / width;
  return image;
}

const idOf = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

function toNode(idea: Raw, depth: number): MindmapNode {
  const attr = attrOf(idea);
  const { label, link } = titleAndLink(idea.title);
  const children = depth < MAX_DEPTH
    ? sortedIdeas(idea.ideas)
      .filter(({ idea: child }) => {
        // En tom grupp är bara en ram i MindMup; den tas bort där också.
        const childAttr = attrOf(child);
        return !(childAttr.group && sortedIdeas(child.ideas).length === 0);
      })
      .map(({ idea: child }) => toNode(child, depth + 1))
    : [];
  const node: MindmapNode = { id: idOf(idea.id), label, children };
  if (attr.collapsed === true && children.length > 0) node.collapsed = true;
  const style = isObject(attr.style) ? attr.style : {};
  const color = nearestMindmapColor(style.background);
  if (color) node.color = color;
  if (link) node.link = link;
  const note = noteOf(attr);
  if (note) node.note = note;
  const image = imageOf(attr);
  if (image) node.image = image;
  return node;
}

const isIdea = (value: unknown): value is Raw =>
  isObject(value) && (typeof value.title === 'string' || typeof value.title === 'number' || isObject(value.ideas));

/* ── Länkarna ── */

function toCrossLink(raw: unknown): Raw {
  if (!isObject(raw)) return {};
  const style = isObject(raw.attr) && isObject(raw.attr.style) ? raw.attr.style : {};
  let from = idOf(raw.ideaIdFrom);
  let to = idOf(raw.ideaIdTo);
  const arrow = style.arrow;
  const link: Raw = {};
  if (arrow === 'from') [from, to] = [to, from];
  else if (arrow === 'both') link.arrow = 'both';
  else if (arrow !== true && arrow !== 'to') link.arrow = 'none';
  link.from = from;
  link.to = to;
  // MindMups grå förvalsfärg blir sidans förval, inte en grå markering.
  const color = nearestMindmapColor(style.color);
  if (color && color !== 'grey') link.color = color;
  if (isObject(raw.attr) && typeof raw.attr.label === 'string' && raw.attr.label.trim()) link.label = raw.attr.label.trim();
  return link;
}

/* ── Hela kartan ── */

/**
 * Läser MindMups JSON (redan tolkad). `fallbackName` används när rotidén
 * saknar titel och när filen har flera rotidéer. Kastar MindmapImportError
 * med en svensk text när formen inte känns igen; ger aldrig en halv karta.
 */
export function parseMindmup(raw: unknown, fallbackName = 'Importerad karta'): { name: string; doc: MindmapDoc } {
  if (!isObject(raw)) throw new MindmapImportError(NOT_MUP);
  const version = raw.formatVersion;
  if (version !== undefined && (typeof version !== 'number' || !Number.isFinite(version))) {
    throw new MindmapImportError(NOT_MUP);
  }
  if (typeof version === 'number' && version > 3) {
    throw new MindmapImportError('Kartan är sparad i ett nyare MindMup-format, som sidan inte kan läsa än.');
  }
  if (raw.ideas !== undefined && !isObject(raw.ideas)) throw new MindmapImportError(NOT_MUP);

  const wrapped = (typeof version === 'number' && version >= 3) || raw.id === 'root';
  const roots = wrapped ? sortedIdeas(raw.ideas).map(({ idea }) => idea).filter(isIdea) : [raw];
  if (wrapped && roots.length === 0) throw new MindmapImportError('MindMup-filen har ingen rotidé.');
  if (!wrapped && !isIdea(raw)) throw new MindmapImportError(NOT_MUP);

  let root: MindmapNode;
  let layout: 'right' | 'both' = 'right';
  if (roots.length === 1) {
    root = toNode(roots[0], 0);
    // Under roten är ett negativt rangtal vänster sida. Utan sådana räcker `right`.
    const sideById = new Map<string, MindmapSide>(
      sortedIdeas(roots[0].ideas).map(({ rank, idea }) => [idOf(idea.id), rank < 0 ? 'left' : 'right']),
    );
    if (Array.from(sideById.values()).includes('left')) {
      layout = 'both';
      root.children.forEach((child) => {
        const side = sideById.get(child.id);
        if (side) child.side = side;
      });
    }
  } else {
    // Sidan har en rot. Flera rotidéer blir grenar under en ny.
    root = { id: 'mup-root', label: cleanMindmapName(fallbackName), children: roots.map((idea) => toNode(idea, 1)) };
  }

  const rawLinks = Array.isArray(raw.links) ? raw.links : [];
  const doc = sanitizeMindmapDoc({ root, layout, crossLinks: rawLinks.map(toCrossLink) });
  const name = cleanMindmapName(doc.root.label, cleanMindmapName(fallbackName));
  return { name, doc };
}
