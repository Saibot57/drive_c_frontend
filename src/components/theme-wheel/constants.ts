import type { ThemeWheel } from '@/types/themeWheel';

// Speglar gränserna i backendens theme_routes.py.
export const MIN_WEEK_COUNT = 4;
export const MAX_WEEK_COUNT = 24;
export const DEFAULT_WEEK_COUNT = 8;
export const MIN_START_WEEK = 1;
export const MAX_START_WEEK = 53;

/** Samma pastellfamilj som schemaplanerarens byggstenar, utan vitt. */
export const THEME_AREA_PALETTE = [
  '#fde68a',
  '#bae6fd',
  '#d9f99d',
  '#fecdd3',
  '#c7d2fe',
  '#a7f3d0',
  '#ddd6fe',
  '#fed7aa',
  '#e5e7eb',
] as const;

export const DEFAULT_AREA_COLOR = '#bae6fd';

export const WHEEL_STROKE = '#1a1a1a';
export const WHEEL_STROKE_WIDTH = 1.2;
export const WHEEL_GUIDE_STROKE = 'rgba(0,0,0,0.12)';
export const AXIS_FILL = '#ffffff';
export const HOLIDAY_FILL = '#e5e7eb';
export const TODAY_STROKE = '#1a1a1a';

/**
 * Sätts uttryckligen på hjulets SVG. Vid export renderas SVG:n fristående och
 * ärver ingen CSS – utan den här stacken skulle texten falla tillbaka på
 * webbläsarens standardfont och se annorlunda ut än på skärmen.
 */
export const WHEEL_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const TITLE_FONT_SIZE = 13;
export const TITLE_MIN_FONT_SIZE = 9.5;
export const COMMENT_FONT_SIZE = 10.5;
export const COMMENT_MIN_FONT_SIZE = 9;
export const AXIS_WEEK_FONT_SIZE = 12;
export const AXIS_DATE_FONT_SIZE = 10;

/** Under den här ringhöjden får kommentaren ingen plats. */
export const COMMENT_MIN_RING_HEIGHT = 34;
/** Under den här ytan ritas ingen text alls, bara färgen och en tooltip. */
export const TEXT_MIN_EXTENT = 22;

export const THEME_WHEEL_RECENT_COLORS_KEY = 'theme_wheel_recent_colors_v1';
export const MAX_RECENT_CUSTOM_COLORS = 3;
export const ACTIVE_THEME_WHEEL_KEY = 'active_theme_wheel_id';
/**
 * Utkastet som sparades lokalt innan molnsynken fanns. Läses en sista gång
 * och flyttas upp till servern, sedan tas nyckeln bort.
 */
export const THEME_WHEEL_DRAFT_KEY = 'theme_wheel_draft_v1';

/**
 * Platshållaren som visas medan hjulet hämtas. Riktiga värden kommer från
 * servern; det här är bara en giltig form att rendera mot.
 */
export const EMPTY_WHEEL: ThemeWheel = {
  id: '',
  name: 'Temakalender',
  startWeek: 34,
  startYear: 2026,
  weekCount: DEFAULT_WEEK_COUNT,
  holidayWeeks: [],
  blocks: [],
};
