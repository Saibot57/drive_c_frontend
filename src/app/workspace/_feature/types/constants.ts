import type { ElementType } from './workspace.types';
import type { HeadingFont, HeadingLevel } from './heading.types';

/**
 * En färg per elementtyp, ur samma pastellfamilj som schemaplanerarens
 * byggstenar och temakalenderns arbetsområden. Ritas som en tunn list överst
 * på kortet, så att man ser på avstånd vad som är en tabell och vad som är en
 * mindmap utan att behöva läsa innehållet.
 */
export const TYPE_COLORS: Record<ElementType, string> = {
  text: '#bae6fd',
  table: '#fde68a',
  mindmap: '#ddd6fe',
  list: '#d9f99d',
  kanban: '#fecdd3',
  sticky: '#fed7aa',
  pdf: '#c7d2fe',
  image: '#a7f3d0',
  link: '#e5e7eb',
  wheel_ref: '#f5d0fe',
  wheel_part: '#f5d0fe',
  schedule_day: '#fde68a',
  heading: '#fca5a5',
};

/**
 * Elementtyper som inte listas i bibliotekspanelen.
 *
 * En sprängning ger en del per block, och fjorton anonyma fragment hade gjort
 * listan oläslig. Raderna finns kvar och hämtas som vanligt — filtreringen sker
 * först när listan ritas, så att `placeFromLibrary` fortfarande hittar en del
 * som ligger på en annan yta.
 */
export const LIBRARY_HIDDEN_TYPES: ReadonlySet<ElementType> = new Set<ElementType>([
  'wheel_part',
  // Rubriker är ytmöbler, inte återanvändbart innehåll. Tjugo stycken
  // "AVDELNING 2" i biblioteket hade dränkt allt man faktiskt vill dra ut.
  // De går fortfarande att spegla till en annan yta via högerklick.
  'heading',
]);

/**
 * Typer med ett innehåll man kan sätta markören i, och därmed de enda där
 * högerklickets "Redigera" har något att göra. De övriga korten visar en källa
 * — ett hjul, en utbruten hjuldel, en schemadag, en PDF, en bild — och den byts
 * genom kortets egna reglage, inte genom att börja skriva. Menyvalet finns kvar
 * men gråat för dem, så att menyn ser likadan ut på alla element.
 */
export const EDITABLE_TYPES: ReadonlySet<ElementType> = new Set<ElementType>([
  'text',
  'sticky',
  'table',
  'list',
  'kanban',
  'mindmap',
  'heading',
  'link',
]);

/**
 * Speglar MAX_BULK_PLACE i workspace_routes.py. Kontrollen finns här bara för
 * att kunna säga det på svenska innan anropet går iväg — servern håller gränsen.
 */
export const MAX_EXPLODE_PARTS = 100;

export const GRID_SIZE = 16;

/* ── Tangentbordsstyrning av canvasen ────────────────────────────────────── */

/**
 * Ett piltryck kör vyn så här långt, i skärmpixlar — fyra rutor vid full zoom.
 * Skärmpixlar och inte canvaspixlar, så att farten känns lika oavsett zoom.
 * Håller man tangenten nere sköter tangentbordets repetition resten.
 */
export const PAN_STEP_PX = 64;

/** Shift ger ett längre kliv, både för vyn och för ett markerat kort. */
export const KEYBOARD_FAST_FACTOR = 4;

/** Luft mellan innehållets kant och skärmkanten efter ett Alt-hopp. */
export const EMPTY_JUMP_MARGIN_PX = 32;

/**
 * Så länge efter det sista piltrycket läggs ångra-posten för en tangentflytt.
 * En post per tryck hade fyllt stacken — en serie tryck är en förflyttning.
 */
export const KEYBOARD_MOVE_COMMIT_MS = 600;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.5;
export const DEFAULT_ZOOM = 1;
export const CANVAS_EXTEND = 1.5;

export const DEFAULT_ELEMENT_WIDTH = 320;
export const DEFAULT_ELEMENT_HEIGHT = 200;
export const MIN_ELEMENT_WIDTH = 160;
export const MIN_ELEMENT_HEIGHT = 80;

/**
 * Hjulet är runt och tappar sina etiketter långt före de andra typerna. Under
 * det här måttet är det inte längre läsbart, så det får ett eget golv.
 */
export const MIN_WHEEL_REF_SIZE = 280;

/**
 * Under den här canvas-zoomen ritas hjulet utan text. Motsvarar TEXT_MIN_EXTENT
 * i temakalendern, som löser samma sak inuti hjulet: hellre ren färg än
 * bokstäver som ändå inte går att läsa.
 */
export const WHEEL_REF_TEXT_MIN_ZOOM = 0.7;

/* ── Rubriker ────────────────────────────────────────────────────────────── */

/**
 * Tre nivåer, tre fasta storlekar. Rubriken går att dra bredare så att texten
 * bryter där man vill, men aldrig större — det är nivån som bestämmer, annars
 * slutar rubrikerna vara jämförbara mellan ytorna.
 */
export const HEADING_SIZES: Record<HeadingLevel, number> = { 1: 48, 2: 32, 3: 22 };

/** Nivåns förval. Archivo Black har ingen egen nivå och väljs för hand. */
export const HEADING_LEVEL_FONT: Record<HeadingLevel, HeadingFont> = {
  1: 'bangers',
  2: 'monument',
  3: 'redhat',
};

/**
 * Optisk utjämning, mätt och inte gissad. Versalhöjden vid 100 px är
 * Bangers 74, Monument 70, Archivo 68,8, Red Hat 70 — alltså nästan lika.
 * Det som ser ut som en storleksskillnad mellan typsnitten är bredden
 * (Monument tar 63 % mer plats per tecken än Red Hat, Bangers 19 % mindre),
 * och bredd löses med bredd, inte med teckenstorlek.
 *
 * Kvar blir därför bara Bangers, som dessutom är versalt hela vägen och får
 * mer massa än sin versalhöjd antyder.
 */
export const HEADING_FONT_OPTICAL: Record<HeadingFont, number> = {
  bangers: 0.95,
  monument: 1,
  archivo: 1,
  redhat: 1,
};

/** Variablerna sätts på body av RootLayoutBase via next/font. */
export const HEADING_FONT_STACK: Record<HeadingFont, string> = {
  bangers: 'var(--font-bangers), system-ui, sans-serif',
  monument: 'var(--font-monument), system-ui, sans-serif',
  archivo: 'var(--font-archivo), system-ui, sans-serif',
  redhat: 'var(--font-redhat), system-ui, sans-serif',
};

export const HEADING_FONT_LABELS: Record<HeadingFont, string> = {
  bangers: 'Bangers',
  monument: 'Monument',
  archivo: 'Archivo',
  redhat: 'Red Hat',
};

export const HEADING_FONT_ORDER: HeadingFont[] = ['bangers', 'monument', 'archivo', 'redhat'];

export const HEADING_DEFAULT_COLOR = '#000000';

/**
 * Textfärger, inte bakgrundsfärger. Pastellerna som fungerar under en
 * notislapp är oläsliga som bokstäver mot den ljusa canvasen, så den här
 * paletten är mörka varianter av samma familj.
 */
export const HEADING_COLORS: string[] = [
  '#000000', '#374151', '#7f1d1d', '#9a3412', '#854d0e',
  '#166534', '#115e59', '#1e3a8a', '#5b21b6', '#831843',
];

/** Egna färger sparas separat från schemaplanerarens — de är inte utbytbara. */
export const HEADING_RECENT_COLORS_KEY = 'app.ws_heading_colors.v1';
export const HEADING_RECENT_COLORS_MAX = 6;

/**
 * Tilltaget så att en normallång rubrik ryms på en rad även i Monument, som är
 * det bredaste av de fyra. Bredden går att dra ner för den som vill bryta.
 */
export const HEADING_DEFAULT_WIDTH = 520;
/** Bara en startgissning. Höjden mäts och skrivs tillbaka så fort den ritats. */
export const HEADING_INITIAL_HEIGHT = 64;
export const MIN_HEADING_WIDTH = 80;

export const DEBOUNCE_POSITION_MS = 300;
export const DEBOUNCE_CONTENT_MS = 500;

/**
 * Notiser med en Ångra-knapp ligger kvar längre än vanliga bekräftelser —
 * standardtiden på 2,6 s räcker inte för att hinna läsa och klicka.
 */
export const UNDO_NOTICE_MS = 8000;

/** Vyn sparas trögare än geometrin — den är billig att förlora. */
export const DEBOUNCE_VIEWPORT_MS = 700;

/** Marginal runt innehållet när man zoomar till allt. */
export const FIT_PADDING_PX = 64;

/** Marginal runt innehållet i en export. */
export const EXPORT_PADDING_PX = 32;
/** Uppskalning vid rastrering. 2x räcker för skärm och tryck i A4. */
export const EXPORT_SCALE = 2;

// Ctrl-assisted resize: screen-pixel distance from an edge that counts as "near".
export const CTRL_RESIZE_THRESHOLD_PX = 24;
// Fraction of the element's smaller dimension kept as a center "drag" zone,
// so very small elements can still be dragged with Ctrl held.
export const CTRL_RESIZE_CENTER_FRACTION = 0.3;
